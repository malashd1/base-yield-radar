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
