/**
 * Take a snapshot of the top-50 Base pools by TVL.
 *
 * Usage:
 *   npx tsx scripts/snapshot.ts          # take a single snapshot
 *   npx tsx scripts/snapshot.ts --limit=100  # custom top N
 *
 * Designed to be run by the cron handler (app/api/cron/safety/route.ts) too —
 * the heavy lifting is in `runSnapshot`, which the cron imports directly.
 */

import { fetchBasePools } from "../lib/defillama";
import { recordSnapshot } from "../lib/db";

interface RunOptions {
  limit?: number;
  /** Override "now" (epoch seconds). Used by tests. */
  now?: number;
}

export interface SnapshotResult {
  takenAt: number;
  totalPools: number;
  recorded: number;
  topByTvl: Array<{
    pool: string;
    project: string;
    symbol: string;
    tvlUsd: number;
    apy: number | null;
  }>;
}

export async function runSnapshot(
  opts: RunOptions = {},
): Promise<SnapshotResult> {
  const limit = opts.limit ?? 50;
  const now = opts.now ?? Math.floor(Date.now() / 1000);

  const all = await fetchBasePools();
  // Sort by TVL desc — these are the pools that matter for safety monitoring.
  const top = [...all]
    .sort((a, b) => b.tvlUsd - a.tvlUsd)
    .slice(0, limit);

  for (const p of top) {
    recordSnapshot(p.pool, p.tvlUsd, p.apy, now);
  }

  return {
    takenAt: now,
    totalPools: all.length,
    recorded: top.length,
    topByTvl: top.slice(0, 5).map((p) => ({
      pool: p.pool,
      project: p.project,
      symbol: p.symbol,
      tvlUsd: p.tvlUsd,
      apy: p.apy,
    })),
  };
}

// CLI entry — only when invoked directly.
async function cli() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 50;
  if (!Number.isFinite(limit) || limit <= 0) {
    console.error("invalid --limit");
    process.exit(2);
  }

  console.log(`Taking snapshot of top-${limit} Base pools…`);
  const r = await runSnapshot({ limit });
  console.log(
    `OK: recorded=${r.recorded}/${r.totalPools} at ${new Date(r.takenAt * 1000).toISOString()}`,
  );
  console.log("Top 5 by TVL:");
  for (const t of r.topByTvl) {
    const apy = t.apy == null ? "—" : `${t.apy.toFixed(2)}%`;
    console.log(
      `  ${t.project.padEnd(28)} ${t.symbol.padEnd(20)} TVL=$${(t.tvlUsd / 1e6).toFixed(2)}M  APY=${apy}`,
    );
  }
}

// Detect direct invocation (tsx forwards process.argv[1] to the script path).
const invokedDirectly =
  process.argv[1] && process.argv[1].endsWith("snapshot.ts");

if (invokedDirectly) {
  cli().catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  });
}
