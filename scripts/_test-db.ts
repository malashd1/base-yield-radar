import {
  db,
  listTables,
  upsertUser,
  addSubscription,
  recordSnapshot,
  recordAlert,
} from "../lib/db";

function main() {
  const tables = listTables();
  console.log("tables:", tables);
  const expected = ["alerts", "snapshots", "subscriptions", "users"];
  for (const t of expected) {
    if (!tables.includes(t)) {
      throw new Error(`missing table: ${t}`);
    }
  }
  console.log("OK: all 4 tables present");

  // Round-trip smoke writes.
  upsertUser(424242, "test_user");
  addSubscription(424242, "protocol", "morpho-blue", null);
  addSubscription(424242, "safety", "*", 20.0);
  recordSnapshot("test-pool-id", 1_000_000, 12.34);
  const alertId = recordAlert("tvl_drop", { pool: "test-pool-id", drop: 0.3 });

  const subs = db
    .prepare("SELECT count(*) as c FROM subscriptions WHERE tg_user_id = ?")
    .get(424242) as { c: number };
  const snaps = db
    .prepare("SELECT count(*) as c FROM snapshots WHERE pool_id = ?")
    .get("test-pool-id") as { c: number };
  const alerts = db
    .prepare("SELECT count(*) as c FROM alerts WHERE id = ?")
    .get(alertId) as { c: number };

  console.log("subs:", subs.c, "snaps:", snaps.c, "alerts:", alerts.c);
  if (subs.c < 2 || snaps.c < 1 || alerts.c !== 1) {
    throw new Error("write round-trip failed");
  }
  console.log("OK: writes round-trip");

  // Cleanup.
  db.prepare("DELETE FROM users WHERE tg_user_id = ?").run(424242);
  db.prepare("DELETE FROM snapshots WHERE pool_id = ?").run("test-pool-id");
  db.prepare("DELETE FROM alerts WHERE id = ?").run(alertId);
  console.log("OK: cleanup done");
}

try {
  main();
} catch (e) {
  console.error("FAIL:", e);
  process.exit(1);
}
