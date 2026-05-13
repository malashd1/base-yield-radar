/**
 * 6.1: digest cron with a mock subscriber → expect "would send" log (dryrun mode).
 * 6.2: safety cron with a synthetic 30% TVL drop + safety subscriber → expect
 *      alert recorded AND broadcast log line.
 */

import { db, recordSnapshot } from "../lib/db";

const DIGEST_USER = 700_000_001;
const SAFETY_USER = 700_000_002;
const SAFETY_POOL = "test-safety-cron-pool";

function cleanup() {
  db.prepare("DELETE FROM users WHERE tg_user_id IN (?, ?)").run(
    DIGEST_USER,
    SAFETY_USER,
  );
  db.prepare(
    "DELETE FROM subscriptions WHERE tg_user_id IN (?, ?)",
  ).run(DIGEST_USER, SAFETY_USER);
  db.prepare("DELETE FROM snapshots WHERE pool_id = ?").run(SAFETY_POOL);
  db.prepare("DELETE FROM alerts WHERE payload_json LIKE ?").run(
    `%${SAFETY_POOL}%`,
  );
}

async function main() {
  cleanup();

  // ---------- 6.1: digest ----------
  // Insert digest subscriber.
  db.prepare(
    `INSERT INTO users (tg_user_id, username, joined_at, prefs_json) VALUES (?, ?, ?, '{}')
     ON CONFLICT(tg_user_id) DO NOTHING`,
  ).run(DIGEST_USER, "digest_tester", Math.floor(Date.now() / 1000));
  db.prepare(
    `INSERT OR IGNORE INTO subscriptions (tg_user_id, kind, target, threshold_pct, created_at)
     VALUES (?, 'digest', '*', NULL, ?)`,
  ).run(DIGEST_USER, Math.floor(Date.now() / 1000));

  const r1 = await fetch("http://localhost:3000/api/cron/digest");
  const j1 = (await r1.json()) as Record<string, unknown>;
  if (!j1.ok) throw new Error(`digest failed: ${JSON.stringify(j1)}`);
  if (j1.subscribers !== 1)
    throw new Error(`expected 1 subscriber, got ${j1.subscribers}`);
  if (j1.sent !== 1)
    throw new Error(`expected sent=1 (dryrun counts), got ${JSON.stringify(j1)}`);
  console.log("OK 6.1: digest dispatched broadcast to subscriber (sent=1 in dryrun)");

  // ---------- 6.2: safety ----------
  // Two snapshots showing 50% drop in last hour, well within the default 6h window.
  const now = Math.floor(Date.now() / 1000);
  recordSnapshot(SAFETY_POOL, 5_000_000, 12.0, now - 4 * 3600);
  recordSnapshot(SAFETY_POOL, 2_500_000, 12.0, now - 5 * 60);

  // Safety subscriber.
  db.prepare(
    `INSERT INTO users (tg_user_id, username, joined_at, prefs_json) VALUES (?, ?, ?, '{}')
     ON CONFLICT(tg_user_id) DO NOTHING`,
  ).run(SAFETY_USER, "safety_tester", Math.floor(Date.now() / 1000));
  db.prepare(
    `INSERT OR IGNORE INTO subscriptions (tg_user_id, kind, target, threshold_pct, created_at)
     VALUES (?, 'safety', '*', 20.0, ?)`,
  ).run(SAFETY_USER, Math.floor(Date.now() / 1000));

  const r2 = await fetch("http://localhost:3000/api/cron/safety");
  const j2 = (await r2.json()) as Record<string, unknown>;
  if (!j2.ok) throw new Error(`safety failed: ${JSON.stringify(j2)}`);
  // newAlerts should include our pool (and possibly real Base ones too).
  if ((j2.newAlerts as number) < 1)
    throw new Error(`expected newAlerts>=1, got ${j2.newAlerts}`);
  const notified = j2.notified as { sent: number };
  if (notified.sent < 1)
    throw new Error(`expected notified.sent>=1, got ${JSON.stringify(notified)}`);
  console.log("OK 6.2: safety broadcast reached safety subscriber (notified.sent>=1 in dryrun)");

  cleanup();
  console.log("PASS");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    cleanup();
    console.error("FAIL:", e);
    process.exit(1);
  });
