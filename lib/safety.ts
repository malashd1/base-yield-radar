/**
 * Safety detectors that run over the snapshots table.
 *
 * Heuristics — they are NOT proof of an exploit. They surface things worth
 * looking at. Final judgement always belongs to the user.
 *
 * Two detectors implemented:
 *   - detectTvlDrops:  TVL fell by ≥ minDropPct over the last windowHours.
 *                      Catches mass exits (potential exploit / depeg / bank-run).
 *   - detectApySpikes: latest APY is ≥ spikeMultiplier × baseline APY.
 *                      Often precedes rugs (project juices rewards before vanishing).
 */

import { db } from "@/lib/db";

export interface TvlDropAlert {
  poolId: string;
  fromTvl: number;
  toTvl: number;
  dropPct: number; // e.g. 25.5 means 25.5% drop
  fromTs: number;
  toTs: number;
}

export interface ApySpikeAlert {
  poolId: string;
  baselineApy: number;
  latestApy: number;
  multiplier: number;
  fromTs: number;
  toTs: number;
}

/**
 * For each pool, compare the OLDEST snapshot inside the last `windowHours`
 * to the NEWEST. If TVL dropped by ≥ minDropPct, surface an alert.
 *
 * `now` is overridable for deterministic tests.
 */
export function detectTvlDrops(opts: {
  windowHours?: number;
  minDropPct?: number;
  now?: number;
} = {}): TvlDropAlert[] {
  const windowHours = opts.windowHours ?? 6;
  const minDropPct = opts.minDropPct ?? 20;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const since = now - windowHours * 3600;

  const rows = db
    .prepare(
      `SELECT pool_id,
              -- newest in window
              (SELECT tvl_usd FROM snapshots s2
                 WHERE s2.pool_id = s1.pool_id AND s2.ts >= ? AND s2.ts <= ?
                 ORDER BY s2.ts DESC LIMIT 1) as latest_tvl,
              (SELECT ts FROM snapshots s2
                 WHERE s2.pool_id = s1.pool_id AND s2.ts >= ? AND s2.ts <= ?
                 ORDER BY s2.ts DESC LIMIT 1) as latest_ts,
              -- oldest in window
              (SELECT tvl_usd FROM snapshots s3
                 WHERE s3.pool_id = s1.pool_id AND s3.ts >= ? AND s3.ts <= ?
                 ORDER BY s3.ts ASC LIMIT 1) as oldest_tvl,
              (SELECT ts FROM snapshots s3
                 WHERE s3.pool_id = s1.pool_id AND s3.ts >= ? AND s3.ts <= ?
                 ORDER BY s3.ts ASC LIMIT 1) as oldest_ts
       FROM snapshots s1
       WHERE s1.ts >= ? AND s1.ts <= ?
       GROUP BY s1.pool_id`,
    )
    .all(since, now, since, now, since, now, since, now, since, now) as Array<{
    pool_id: string;
    latest_tvl: number | null;
    latest_ts: number | null;
    oldest_tvl: number | null;
    oldest_ts: number | null;
  }>;

  const alerts: TvlDropAlert[] = [];
  for (const r of rows) {
    if (
      r.latest_tvl == null ||
      r.oldest_tvl == null ||
      r.latest_ts == null ||
      r.oldest_ts == null ||
      r.latest_ts === r.oldest_ts // need at least two distinct snapshots
    ) {
      continue;
    }
    if (r.oldest_tvl <= 0) continue; // can't compute drop from zero
    const drop = ((r.oldest_tvl - r.latest_tvl) / r.oldest_tvl) * 100;
    if (drop >= minDropPct) {
      alerts.push({
        poolId: r.pool_id,
        fromTvl: r.oldest_tvl,
        toTvl: r.latest_tvl,
        dropPct: Number(drop.toFixed(2)),
        fromTs: r.oldest_ts,
        toTs: r.latest_ts,
      });
    }
  }
  return alerts;
}

/**
 * For each pool with ≥2 snapshots in the window, compare:
 *   baseline = MIN apy of the older half of the window (excluding latest)
 *   latest   = newest apy in the window
 * If latest >= baseline * spikeMultiplier (and baseline > 0), surface alert.
 *
 * Skips pools with no APY (e.g. pure-stake vaults that report null).
 */
export function detectApySpikes(opts: {
  windowHours?: number;
  spikeMultiplier?: number;
  now?: number;
} = {}): ApySpikeAlert[] {
  const windowHours = opts.windowHours ?? 24;
  const spikeMultiplier = opts.spikeMultiplier ?? 3;
  const now = opts.now ?? Math.floor(Date.now() / 1000);
  const since = now - windowHours * 3600;

  // Pull all snapshots in window, group in JS — easier than tortuous SQL.
  const rows = db
    .prepare(
      `SELECT pool_id, apy, ts
       FROM snapshots
       WHERE ts >= ? AND ts <= ? AND apy IS NOT NULL
       ORDER BY pool_id, ts ASC`,
    )
    .all(since, now) as Array<{
    pool_id: string;
    apy: number;
    ts: number;
  }>;

  const byPool = new Map<string, Array<{ apy: number; ts: number }>>();
  for (const r of rows) {
    const list = byPool.get(r.pool_id);
    if (list) list.push({ apy: r.apy, ts: r.ts });
    else byPool.set(r.pool_id, [{ apy: r.apy, ts: r.ts }]);
  }

  const alerts: ApySpikeAlert[] = [];
  for (const [poolId, list] of byPool) {
    if (list.length < 2) continue;
    const latest = list[list.length - 1];
    const earlier = list.slice(0, -1);
    const baseline = Math.min(...earlier.map((p) => p.apy));
    if (baseline <= 0) continue;
    const multiplier = latest.apy / baseline;
    if (multiplier >= spikeMultiplier) {
      alerts.push({
        poolId,
        baselineApy: Number(baseline.toFixed(4)),
        latestApy: Number(latest.apy.toFixed(4)),
        multiplier: Number(multiplier.toFixed(2)),
        fromTs: earlier[0].ts,
        toTs: latest.ts,
      });
    }
  }
  return alerts;
}
