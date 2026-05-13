import { db, recordSnapshot } from "../lib/db";
import { detectTvlDrops, detectApySpikes } from "../lib/safety";

function main() {
  const now = 2_000_000_000; // deterministic "now" — far future so it doesn't collide with real snapshots
  const TEST_POOL = "test-pool-safety";
  const TEST_POOL_2 = "test-pool-spike";

  // Cleanup any prior test rows.
  db.prepare("DELETE FROM snapshots WHERE pool_id IN (?, ?)").run(
    TEST_POOL,
    TEST_POOL_2,
  );

  // Case 1: 30% TVL drop over 4h (within 6h window).
  recordSnapshot(TEST_POOL, 1_000_000, 5.0, now - 4 * 3600);
  recordSnapshot(TEST_POOL, 700_000, 5.0, now - 1 * 3600);

  // Case 2: APY spike — baseline 4%, latest 16% (4x).
  recordSnapshot(TEST_POOL_2, 500_000, 4.0, now - 12 * 3600);
  recordSnapshot(TEST_POOL_2, 500_000, 5.0, now - 6 * 3600);
  recordSnapshot(TEST_POOL_2, 500_000, 16.0, now - 30 * 60);

  const drops = detectTvlDrops({
    windowHours: 6,
    minDropPct: 20,
    now,
  });
  console.log("drops:", drops);
  const ourDrop = drops.find((d) => d.poolId === TEST_POOL);
  if (!ourDrop) throw new Error("expected TVL drop alert for TEST_POOL");
  if (ourDrop.dropPct !== 30)
    throw new Error(`expected 30% drop, got ${ourDrop.dropPct}`);

  const spikes = detectApySpikes({
    windowHours: 24,
    spikeMultiplier: 3,
    now,
  });
  console.log("spikes:", spikes);
  const ourSpike = spikes.find((s) => s.poolId === TEST_POOL_2);
  if (!ourSpike) throw new Error("expected APY spike alert for TEST_POOL_2");
  if (ourSpike.multiplier < 3)
    throw new Error(`expected multiplier >= 3, got ${ourSpike.multiplier}`);

  console.log("OK: TVL drop and APY spike both detected");

  // Cleanup.
  db.prepare("DELETE FROM snapshots WHERE pool_id IN (?, ?)").run(
    TEST_POOL,
    TEST_POOL_2,
  );
}

try {
  main();
} catch (e) {
  console.error("FAIL:", e);
  process.exit(1);
}
