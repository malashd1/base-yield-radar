/**
 * SQLite storage layer.
 *
 * - File-backed via better-sqlite3 (synchronous — fine for low-write radar workload).
 * - Schema is created on import. Cheap, idempotent.
 * - Path comes from env DB_PATH (default ./data/radar.db).
 *
 * Use this from server-side code only (Node runtime). Do NOT import from client
 * components or edge runtime — better-sqlite3 is a native module.
 */

import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { env } from "@/lib/env";

function openDb() {
  const dbPath = env.DB_PATH;
  // Ensure parent dir exists (fresh installs / CI).
  const dir = path.dirname(dbPath);
  mkdirSync(dir, { recursive: true });

  const _db = new Database(dbPath);
  // Reasonable defaults for a small write-mostly workload.
  _db.pragma("journal_mode = WAL");
  _db.pragma("synchronous = NORMAL");
  _db.pragma("foreign_keys = ON");

  // Schema. All `IF NOT EXISTS` so safe to re-run on every boot.
  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      tg_user_id   INTEGER PRIMARY KEY,
      username     TEXT,
      joined_at    INTEGER NOT NULL,
      prefs_json   TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      tg_user_id      INTEGER NOT NULL,
      kind            TEXT NOT NULL,        -- 'protocol' | 'pool' | 'safety'
      target          TEXT NOT NULL,        -- protocol slug, pool id, or '*'
      threshold_pct   REAL,                 -- e.g. 20.0 for "alert on 20% TVL drop"
      created_at      INTEGER NOT NULL,
      UNIQUE(tg_user_id, kind, target),
      FOREIGN KEY(tg_user_id) REFERENCES users(tg_user_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_subs_user
      ON subscriptions(tg_user_id);
    CREATE INDEX IF NOT EXISTS idx_subs_kind_target
      ON subscriptions(kind, target);

    CREATE TABLE IF NOT EXISTS snapshots (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      pool_id   TEXT NOT NULL,
      tvl_usd   REAL NOT NULL,
      apy       REAL,
      ts        INTEGER NOT NULL  -- epoch seconds
    );
    CREATE INDEX IF NOT EXISTS idx_snap_pool_ts
      ON snapshots(pool_id, ts DESC);

    CREATE TABLE IF NOT EXISTS alerts (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      kind              TEXT NOT NULL,       -- 'tvl_drop' | 'apy_spike' | 'digest'
      payload_json      TEXT NOT NULL,
      sent_to_user_id   INTEGER,             -- null until delivered
      sent_at           INTEGER,             -- null until delivered
      created_at        INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_alerts_pending
      ON alerts(sent_to_user_id) WHERE sent_at IS NULL;

    -- Wallets the user has linked. We only need the address — no signature,
    -- no proof of ownership. Watching someone else's wallet is allowed by design.
    CREATE TABLE IF NOT EXISTS wallets (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      tg_user_id   INTEGER NOT NULL,
      address      TEXT NOT NULL,        -- always stored lowercased
      label        TEXT,
      added_at     INTEGER NOT NULL,
      UNIQUE(tg_user_id, address),
      FOREIGN KEY(tg_user_id) REFERENCES users(tg_user_id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_wallets_addr ON wallets(address);

    -- Most-recent known balance of each (wallet, pool) pair. Refreshed by the
    -- positions cron (every ~30 min). A row only exists if balance was non-zero
    -- at the last scan — zero balances are deleted so we don't grow unbounded.
    CREATE TABLE IF NOT EXISTS positions (
      address       TEXT NOT NULL,
      pool_id       TEXT NOT NULL,
      balance_raw   TEXT NOT NULL,        -- bigint as string, in token base units
      asset_usd     REAL,                 -- USD-value at scan time (nullable)
      last_seen_ts  INTEGER NOT NULL,
      PRIMARY KEY (address, pool_id)
    );
    CREATE INDEX IF NOT EXISTS idx_positions_pool ON positions(pool_id);

    -- User-set mutes (per pool). until_ts = NULL means muted indefinitely.
    CREATE TABLE IF NOT EXISTS mutes (
      tg_user_id   INTEGER NOT NULL,
      pool_id      TEXT NOT NULL,
      until_ts     INTEGER,
      created_at   INTEGER NOT NULL,
      PRIMARY KEY (tg_user_id, pool_id),
      FOREIGN KEY(tg_user_id) REFERENCES users(tg_user_id) ON DELETE CASCADE
    );
  `);

  return _db;
}

// Single shared connection per process (Next dev hot-reloads modules; we cache on globalThis).
const globalForDb = globalThis as unknown as {
  __radar_db?: Database.Database;
};

export const db: Database.Database =
  globalForDb.__radar_db ?? (globalForDb.__radar_db = openDb());

/** Convenience: list all known table names. Used by smoke test. */
export function listTables(): string[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((r) => r.name);
}

// ---------- thin helpers ----------

export interface UserRow {
  tg_user_id: number;
  username: string | null;
  joined_at: number;
  prefs_json: string;
}

export interface SubscriptionRow {
  id: number;
  tg_user_id: number;
  kind: "protocol" | "pool" | "safety";
  target: string;
  threshold_pct: number | null;
  created_at: number;
}

export interface SnapshotRow {
  id: number;
  pool_id: string;
  tvl_usd: number;
  apy: number | null;
  ts: number;
}

export interface AlertRow {
  id: number;
  kind: "tvl_drop" | "apy_spike" | "digest";
  payload_json: string;
  sent_to_user_id: number | null;
  sent_at: number | null;
  created_at: number;
}

const upsertUserStmt = db.prepare(
  `INSERT INTO users (tg_user_id, username, joined_at, prefs_json)
   VALUES (?, ?, ?, '{}')
   ON CONFLICT(tg_user_id) DO UPDATE SET username = excluded.username`,
);

export function upsertUser(tgUserId: number, username?: string): void {
  upsertUserStmt.run(tgUserId, username ?? null, Math.floor(Date.now() / 1000));
}

const addSubscriptionStmt = db.prepare(
  `INSERT OR IGNORE INTO subscriptions
   (tg_user_id, kind, target, threshold_pct, created_at)
   VALUES (?, ?, ?, ?, ?)`,
);

export function addSubscription(
  tgUserId: number,
  kind: SubscriptionRow["kind"],
  target: string,
  thresholdPct: number | null = null,
): void {
  addSubscriptionStmt.run(
    tgUserId,
    kind,
    target,
    thresholdPct,
    Math.floor(Date.now() / 1000),
  );
}

const recordSnapshotStmt = db.prepare(
  `INSERT INTO snapshots (pool_id, tvl_usd, apy, ts) VALUES (?, ?, ?, ?)`,
);

export function recordSnapshot(
  poolId: string,
  tvlUsd: number,
  apy: number | null,
  ts: number = Math.floor(Date.now() / 1000),
): void {
  recordSnapshotStmt.run(poolId, tvlUsd, apy, ts);
}

const recordAlertStmt = db.prepare(
  `INSERT INTO alerts (kind, payload_json, created_at)
   VALUES (?, ?, ?)`,
);

export function recordAlert(
  kind: AlertRow["kind"],
  payload: unknown,
): number {
  const info = recordAlertStmt.run(
    kind,
    JSON.stringify(payload),
    Math.floor(Date.now() / 1000),
  );
  return info.lastInsertRowid as number;
}

// ---------- wallets ----------

export interface WalletRow {
  id: number;
  tg_user_id: number;
  address: string;
  label: string | null;
  added_at: number;
}

const addWalletStmt = db.prepare(
  `INSERT OR IGNORE INTO wallets (tg_user_id, address, label, added_at)
   VALUES (?, ?, ?, ?)`,
);
export function addWallet(
  tgUserId: number,
  address: string,
  label?: string,
): boolean {
  const info = addWalletStmt.run(
    tgUserId,
    address.toLowerCase(),
    label ?? null,
    Math.floor(Date.now() / 1000),
  );
  return info.changes > 0;
}

const removeWalletStmt = db.prepare(
  `DELETE FROM wallets WHERE tg_user_id = ? AND address = ?`,
);
export function removeWallet(tgUserId: number, address: string): boolean {
  const info = removeWalletStmt.run(tgUserId, address.toLowerCase());
  return info.changes > 0;
}

const listUserWalletsStmt = db.prepare(
  `SELECT * FROM wallets WHERE tg_user_id = ? ORDER BY added_at`,
);
export function listUserWallets(tgUserId: number): WalletRow[] {
  return listUserWalletsStmt.all(tgUserId) as WalletRow[];
}

const allWalletsStmt = db.prepare(
  `SELECT * FROM wallets ORDER BY added_at`,
);
export function allWallets(): WalletRow[] {
  return allWalletsStmt.all() as WalletRow[];
}

// ---------- positions ----------

export interface PositionRow {
  address: string;
  pool_id: string;
  balance_raw: string;
  asset_usd: number | null;
  last_seen_ts: number;
}

const upsertPositionStmt = db.prepare(
  `INSERT INTO positions (address, pool_id, balance_raw, asset_usd, last_seen_ts)
   VALUES (?, ?, ?, ?, ?)
   ON CONFLICT(address, pool_id) DO UPDATE SET
     balance_raw  = excluded.balance_raw,
     asset_usd    = excluded.asset_usd,
     last_seen_ts = excluded.last_seen_ts`,
);
export function upsertPosition(
  address: string,
  poolId: string,
  balanceRaw: bigint,
  assetUsd: number | null,
  ts: number = Math.floor(Date.now() / 1000),
): void {
  upsertPositionStmt.run(
    address.toLowerCase(),
    poolId,
    balanceRaw.toString(),
    assetUsd,
    ts,
  );
}

const deletePositionStmt = db.prepare(
  `DELETE FROM positions WHERE address = ? AND pool_id = ?`,
);
export function deletePosition(address: string, poolId: string): void {
  deletePositionStmt.run(address.toLowerCase(), poolId);
}

const walletsHoldingPoolStmt = db.prepare(
  `SELECT positions.address, positions.balance_raw, positions.asset_usd,
          wallets.tg_user_id, wallets.label
     FROM positions
     JOIN wallets ON wallets.address = positions.address
    WHERE positions.pool_id = ?`,
);
export interface WalletHolding {
  address: string;
  balance_raw: string;
  asset_usd: number | null;
  tg_user_id: number;
  label: string | null;
}
export function walletsHoldingPool(poolId: string): WalletHolding[] {
  return walletsHoldingPoolStmt.all(poolId) as WalletHolding[];
}

// ---------- mutes ----------

const addMuteStmt = db.prepare(
  `INSERT OR REPLACE INTO mutes (tg_user_id, pool_id, until_ts, created_at)
   VALUES (?, ?, ?, ?)`,
);
export function mutePool(
  tgUserId: number,
  poolId: string,
  untilTs: number | null = null,
): void {
  addMuteStmt.run(tgUserId, poolId, untilTs, Math.floor(Date.now() / 1000));
}

const isMutedStmt = db.prepare(
  `SELECT until_ts FROM mutes WHERE tg_user_id = ? AND pool_id = ?`,
);
export function isPoolMuted(tgUserId: number, poolId: string): boolean {
  const row = isMutedStmt.get(tgUserId, poolId) as
    | { until_ts: number | null }
    | undefined;
  if (!row) return false;
  if (row.until_ts == null) return true;
  return row.until_ts > Math.floor(Date.now() / 1000);
}

const removeMuteStmt = db.prepare(
  `DELETE FROM mutes WHERE tg_user_id = ? AND pool_id = ?`,
);
export function unmutePool(tgUserId: number, poolId: string): boolean {
  return removeMuteStmt.run(tgUserId, poolId).changes > 0;
}
