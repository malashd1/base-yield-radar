import { NextResponse } from "next/server";
import { runSnapshot } from "@/lib/snapshot";
import {
  detectTvlDrops,
  detectApySpikes,
  type TvlDropAlert,
  type ApySpikeAlert,
} from "@/lib/safety";
import { recordAlert, db } from "@/lib/db";
import { broadcast } from "@/lib/notify";
import { fmtUsd, fmtApy } from "@/lib/format";

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
    const newDrops: TvlDropAlert[] = [];
    const newSpikes: ApySpikeAlert[] = [];
    for (const d of drops) {
      const pat = `%"poolId":"${d.poolId}"%`;
      if (!existsStmt.get("tvl_drop", dedupeWindow, pat)) {
        recordAlert("tvl_drop", d);
        newDrops.push(d);
      }
    }
    for (const s of spikes) {
      const pat = `%"poolId":"${s.poolId}"%`;
      if (!existsStmt.get("apy_spike", dedupeWindow, pat)) {
        recordAlert("apy_spike", s);
        newSpikes.push(s);
      }
    }
    const newAlerts = newDrops.length + newSpikes.length;

    // 4. Notify safety subscribers (kind='safety', target='*').
    let notified = { sent: 0, skipped: 0, failed: 0 };
    if (newAlerts > 0) {
      const subs = db
        .prepare(
          "SELECT DISTINCT tg_user_id FROM subscriptions WHERE kind = 'safety' AND target = '*'",
        )
        .all() as Array<{ tg_user_id: number }>;

      if (subs.length > 0) {
        const lines: string[] = ["⚠️ *Safety alerts on Base*", ""];
        for (const d of newDrops) {
          lines.push(
            `• TVL drop on pool \`${d.poolId.slice(0, 8)}…\`: ${fmtUsd(d.fromTvl)} → ${fmtUsd(d.toTvl)} (-${d.dropPct}%)`,
          );
        }
        for (const s of newSpikes) {
          lines.push(
            `• APY spike on pool \`${s.poolId.slice(0, 8)}…\`: ${fmtApy(s.baselineApy)} → ${fmtApy(s.latestApy)} (×${s.multiplier})`,
          );
        }
        lines.push("", "_Always verify before reacting. Not financial advice._");
        const text = lines.join("\n");

        notified = await broadcast(
          subs.map((s) => s.tg_user_id),
          text,
          { parseMode: "Markdown", disableLinkPreview: true },
        );
      }
    }

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
      notified,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /rate.?limit|429/i.test(msg) ? 429 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
