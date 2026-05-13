import { NextResponse } from "next/server";
import { fetchBasePools, sortByApy } from "@/lib/defillama";
import { withCache } from "@/lib/cache";
import { db } from "@/lib/db";
import { broadcast } from "@/lib/notify";
import { fmtApy, fmtUsd } from "@/lib/format";
import { isAuditedProtocol } from "@/lib/protocols";

/**
 * GET /api/cron/digest
 *
 * Hourly recap to users with subscriptions(kind='digest', target='*').
 * Sends a top-5 audited yields message via lib/notify.
 *
 * Subscribers are managed via the bot — currently only inserted directly in
 * tests / future /digest command. Without subscribers this no-ops cheaply.
 *
 * Auth: validate Authorization header against CRON_SECRET when set.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TVL_FLOOR = 1_000_000;
const APY_CEILING = 200;
const TOP_N = 5;

async function getDigestRows() {
  return withCache(`digest:v1:${TVL_FLOOR}:${APY_CEILING}:${TOP_N}`, 1800, async () => {
    const pools = await fetchBasePools({ minTvlUsd: TVL_FLOOR });
    const audited = pools.filter(
      (p) =>
        isAuditedProtocol(p.project) &&
        (p.apy == null || p.apy <= APY_CEILING),
    );
    return sortByApy(audited)
      .slice(0, TOP_N)
      .map((p) => ({
        project: p.project,
        symbol: p.symbol,
        tvlUsd: p.tvlUsd,
        apy: p.apy,
      }));
  });
}

function formatDigest(
  rows: Awaited<ReturnType<typeof getDigestRows>>,
): string {
  if (rows.length === 0)
    return "_No audited pools above filter right now._";
  const lines = rows.map((r, i) => {
    const idx = String(i + 1).padStart(2, " ");
    return `\`${idx}\` *${r.project}* — ${r.symbol} · ${fmtUsd(r.tvlUsd)} · *${fmtApy(r.apy)}*`;
  });
  return [
    "*Hourly digest — top audited yields on Base*",
    "",
    ...lines,
    "",
    "_Manage subscriptions: /watch · /alerts off_",
  ].join("\n");
}

export async function GET() {
  const startedAt = Date.now();

  const subs = db
    .prepare(
      "SELECT DISTINCT tg_user_id FROM subscriptions WHERE kind = 'digest' AND target = '*'",
    )
    .all() as Array<{ tg_user_id: number }>;

  if (subs.length === 0) {
    return NextResponse.json({
      ok: true,
      tookMs: Date.now() - startedAt,
      sent: 0,
      skipped: 0,
      failed: 0,
      note: "no digest subscribers",
    });
  }

  let rows;
  try {
    rows = await getDigestRows();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /rate.?limit|429/i.test(msg) ? 429 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }

  const text = formatDigest(rows);
  const summary = await broadcast(
    subs.map((s) => s.tg_user_id),
    text,
    { parseMode: "Markdown", disableLinkPreview: true },
  );

  return NextResponse.json({
    ok: true,
    tookMs: Date.now() - startedAt,
    subscribers: subs.length,
    rowsInDigest: rows.length,
    ...summary,
  });
}
