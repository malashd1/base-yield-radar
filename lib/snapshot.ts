/**
 * Capture a snapshot of top-N Base pools (by TVL) into the snapshots table.
 * Importable from server-side code (cron handlers) and CLI scripts.
 */

import { fetchBasePools } from "@/lib/defillama";
import { recordSnapshot } from "@/lib/db";

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
  opts: { limit?: number; now?: number } = {},
): Promise<SnapshotResult> {
  const limit = opts.limit ?? 50;
  const now = opts.now ?? Math.floor(Date.now() / 1000);

  const all = await fetchBasePools();
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
