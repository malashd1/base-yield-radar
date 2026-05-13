import { NextResponse } from "next/server";
import { runSnapshot } from "@/lib/snapshot";
import { detectTvlDrops, detectApySpikes } from "@/lib/safety";
import { recordAlert, db } from "@/lib/db";

/**
 * GET /api/cron/safety
 *
 * Pipeline (called by Vercel cron / manual trigger):
 *   1. Take a snapshot of top-50 Base pools (by TVL).
 *   2. Run TVL drop + APY spike detectors over the snapshots window.
 *   3. Persist any new alerts to the alerts table.
 *   4. Return a summary JSON.
 *
 * Notification dispatch (sending alerts to TG subscribers) is wired in 6.2
 * once lib/notify.ts exists. For now we record alerts to db and the digest
 * cron picks them up.
 *
 * Auth: in production Vercel passes Authorization: Bearer <CRON_SECRET>.
 * We don't enforce it yet (no CRON_SECRET in env). Add when we deploy.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // we use better-sqlite3 — needs Node, not Edge

export async function GET(req: Request) {
  const url = new URL(req.url);
  const windowHours = Number(url.searchParams.get("windowHours") ?? "6");
  const minDropPct = Number(url.searchParams.get("minDropPct") ?? "20");
  const apyWindowHours = Number(
    url.searchParams.get("apyWindowHours") ?? "24",
  );
  const spikeMultiplier = Number(
    url.searchParams.get("spikeMultiplier") ?? "3",
  );
  const limit = Number(url.searchParams.get("limit") ?? "50");

  const startedAt = Date.now();

  try {
    // 1. Snapshot
    const snap = await runSnapshot({ limit });

    // 2. Detect
    const drops = detectTvlDrops({ windowHours, minDropPct });
    const spikes = detectApySpikes({
      windowHours: apyWindowHours,
      spikeMultiplier,
    });

    // 3. Persist alerts (dedupe: skip if same kind+pool created in last hour)
    const dedupeWindow = Math.floor(Date.now() / 1000) - 3600;
    const existsStmt = db.prepare(
      `SELECT 1 FROM alerts
       WHERE kind = ? AND created_at > ? AND payload_json LIKE ?
       LIMIT 1`,
    );
    let newAlerts = 0;
    for (const d of drops) {
      const pat = `%"poolId":"${d.poolId}"%`;
      const dup = existsStmt.get("tvl_drop", dedupeWindow, pat);
      if (!dup) {
        recordAlert("tvl_drop", d);
        newAlerts++;
      }
    }
    for (const s of spikes) {
      const pat = `%"poolId":"${s.poolId}"%`;
      const dup = existsStmt.get("apy_spike", dedupeWindow, pat);
      if (!dup) {
        recordAlert("apy_spike", s);
        newAlerts++;
      }
    }

    // 4. Done. (Notification dispatch added in 6.2.)
    return NextResponse.json({
      ok: true,
      tookMs: Date.now() - startedAt,
      snapshot: {
        recorded: snap.recorded,
        totalPools: snap.totalPools,
        takenAt: snap.takenAt,
      },
      detected: {
        tvlDrops: drops.length,
        apySpikes: spikes.length,
      },
      newAlerts,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /rate.?limit|429/i.test(msg) ? 429 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
