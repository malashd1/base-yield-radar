import { NextResponse } from "next/server";
import { runSnapshot } from "@/lib/snapshot";
import {
  detectTvlDrops,
  detectApySpikes,
  type TvlDropAlert,
  type ApySpikeAlert,
} from "@/lib/safety";
import {
  recordAlert,
  db,
  walletsHoldingPool,
  isPoolMuted,
} from "@/lib/db";
import { broadcast, sendToUser, type InlineButton } from "@/lib/notify";
import { fmtUsd, fmtApy } from "@/lib/format";
import { resolvePoolLink } from "@/lib/poolLinks";
import { findVaultByPoolId } from "@/lib/positionTokens";

/**
 * GET /api/cron/safety
 *
 * Pipeline:
 *   1. Snapshot top-50 Base pools.
 *   2. Run TVL drop + APY spike detectors.
 *   3. Dedupe and persist new alerts.
 *   4a. For each alerted pool: find wallets that hold a position in it; DM
 *       their owners a personalized message with inline [Open / Mute] buttons.
 *   4b. For the generic safety='*' subscribers (no wallet linked), fall back
 *       to the old broadcast.
 *
 * Auth: production should enforce Bearer CRON_SECRET. Not wired yet.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PoolAlertSummary {
  poolId: string;
  kind: "tvl_drop" | "apy_spike";
  text: string; // ready-to-send markdown body for one pool
}

function formatPoolMeta(poolId: string): { name: string; href: string } {
  const vault = findVaultByPoolId(poolId);
  if (vault) {
    const link = resolvePoolLink({
      project: vault.project,
      pool: poolId,
      symbol: vault.underlyingSymbol,
      underlyingTokens: null,
    });
    return { name: vault.name, href: link.href };
  }
  // Unknown vault: fall back to defillama pool page.
  return {
    name: `pool ${poolId.slice(0, 8)}…`,
    href: `https://defillama.com/yields/pool/${poolId}`,
  };
}

function buildAlertBody(d: TvlDropAlert | null, s: ApySpikeAlert | null): {
  body: string;
  href: string;
  name: string;
} {
  const poolId = (d?.poolId ?? s?.poolId) as string;
  const meta = formatPoolMeta(poolId);
  const lines: string[] = [`⚠️ *${meta.name}*`];
  if (d) {
    lines.push(
      `TVL: ${fmtUsd(d.fromTvl)} → ${fmtUsd(d.toTvl)} (−${d.dropPct}%) in 6h`,
    );
  }
  if (s) {
    lines.push(
      `APY: ${fmtApy(s.baselineApy)} → ${fmtApy(s.latestApy)} (×${s.multiplier})`,
    );
  }
  return { body: lines.join("\n"), href: meta.href, name: meta.name };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const windowHours = Number(url.searchParams.get("windowHours") ?? "6");
  const minDropPct = Number(url.searchParams.get("minDropPct") ?? "20");
  const apyWindowHours = Number(url.searchParams.get("apyWindowHours") ?? "24");
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

    // Build per-pool summaries (merging drop + spike on the same pool into one msg).
    const byPool = new Map<string, { drop: TvlDropAlert | null; spike: ApySpikeAlert | null }>();
    const newDrops: TvlDropAlert[] = [];
    const newSpikes: ApySpikeAlert[] = [];
    for (const d of drops) {
      const pat = `%"poolId":"${d.poolId}"%`;
      if (!existsStmt.get("tvl_drop", dedupeWindow, pat)) {
        recordAlert("tvl_drop", d);
        newDrops.push(d);
        const entry = byPool.get(d.poolId) ?? { drop: null, spike: null };
        entry.drop = d;
        byPool.set(d.poolId, entry);
      }
    }
    for (const s of spikes) {
      const pat = `%"poolId":"${s.poolId}"%`;
      if (!existsStmt.get("apy_spike", dedupeWindow, pat)) {
        recordAlert("apy_spike", s);
        newSpikes.push(s);
        const entry = byPool.get(s.poolId) ?? { drop: null, spike: null };
        entry.spike = s;
        byPool.set(s.poolId, entry);
      }
    }
    const newAlerts = newDrops.length + newSpikes.length;

    // 4. Notify.
    let walletNotified = 0;
    let walletSkippedMuted = 0;
    const perPoolSummaries: PoolAlertSummary[] = [];

    for (const [poolId, entry] of byPool) {
      const { body, href, name } = buildAlertBody(entry.drop, entry.spike);

      // 4a — per-wallet targeted alerts
      const holders = walletsHoldingPool(poolId);
      for (const h of holders) {
        if (isPoolMuted(h.tg_user_id, poolId)) {
          walletSkippedMuted++;
          continue;
        }
        const positionLine = h.asset_usd != null
          ? `\nYour position: ~${fmtUsd(h.asset_usd)}${h.label ? ` (${h.label})` : ""}`
          : `\nYou hold a position in this vault${h.label ? ` (${h.label})` : ""}.`;
        const keyboard: InlineButton[][] = [
          [
            { text: "Open pool ↗", url: href },
            { text: "🔕 Mute", callback_data: `mute:${poolId}` },
          ],
        ];
        const r = await sendToUser(
          h.tg_user_id,
          `${body}${positionLine}`,
          {
            parseMode: "Markdown",
            disableLinkPreview: true,
            inlineKeyboard: keyboard,
          },
        );
        if (r.ok && r.outcome === "sent") walletNotified++;
      }

      perPoolSummaries.push({
        poolId,
        kind: entry.drop ? "tvl_drop" : "apy_spike",
        text: `• ${name}: ${entry.drop ? `TVL −${entry.drop.dropPct}%` : ""}${entry.drop && entry.spike ? ", " : ""}${entry.spike ? `APY ×${entry.spike.multiplier}` : ""}`,
      });
    }

    // 4b — generic broadcast to safety='*' subscribers (no wallet linked).
    let broadcasted = { sent: 0, skipped: 0, failed: 0 };
    if (newAlerts > 0) {
      const subs = db
        .prepare(
          "SELECT DISTINCT tg_user_id FROM subscriptions WHERE kind = 'safety' AND target = '*'",
        )
        .all() as Array<{ tg_user_id: number }>;
      if (subs.length > 0) {
        const text = [
          "⚠️ *Safety alerts on Base*",
          "",
          ...perPoolSummaries.map((s) => s.text),
          "",
          "_Tip: link a wallet with `/wallet add 0x...` to get alerts only for pools you actually hold._",
        ].join("\n");
        broadcasted = await broadcast(
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
      walletNotified,
      walletSkippedMuted,
      broadcasted,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /rate.?limit|429/i.test(msg) ? 429 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
