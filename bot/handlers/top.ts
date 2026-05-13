import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { fetchBasePools, sortByApy } from "@/lib/defillama";
import { withCache } from "@/lib/cache";
import { fmtApy, fmtUsd } from "@/lib/format";
import { env } from "@/lib/env";

/**
 * /top — show the top yields on Base.
 *
 * Defaults: minTvl $1M, max APY 1000%, top 10.
 * Cached for 1 hour via withCache (same store as the web app).
 */

const MIN_TVL = 1_000_000;
const MAX_APY = 1_000;
const LIMIT = 10;

interface TopRow {
  pool: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number | null;
}

async function getTop(): Promise<TopRow[]> {
  return withCache(`bot:top:v1:${MIN_TVL}:${MAX_APY}:${LIMIT}`, 3600, async () => {
    const pools = await fetchBasePools({ minTvlUsd: MIN_TVL });
    const filtered = pools.filter(
      (p) => p.apy == null || p.apy <= MAX_APY,
    );
    return sortByApy(filtered)
      .slice(0, LIMIT)
      .map((p) => ({
        pool: p.pool,
        project: p.project,
        symbol: p.symbol,
        tvlUsd: p.tvlUsd,
        apy: p.apy,
      }));
  });
}

function escMd(s: string): string {
  // Telegram MarkdownV1 — escape only what breaks parsing.
  return s.replace(/([_*`[])/g, "\\$1");
}

function formatList(rows: TopRow[]): string {
  if (rows.length === 0) {
    return "_No yields found right now (filters too strict)._";
  }
  const lines = rows.map((r, i) => {
    const idx = String(i + 1).padStart(2, " ");
    const proj = escMd(r.project);
    const sym = escMd(r.symbol);
    return `\`${idx}\` *${proj}* — ${sym} · ${fmtUsd(r.tvlUsd)} · *${fmtApy(r.apy)}*`;
  });
  return [
    "*Top yields on Base*",
    `_TVL ≥ ${fmtUsd(MIN_TVL)} · APY ≤ ${fmtApy(MAX_APY)}_`,
    "",
    ...lines,
  ].join("\n");
}

export function registerTop(bot: Bot): void {
  bot.command("top", async (ctx) => {
    let rows: TopRow[];
    try {
      rows = await getTop();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await ctx.reply(`Couldn't fetch yields right now: ${msg}`);
      return;
    }

    const siteUrl = env.NEXT_PUBLIC_SITE_URL;
    const kb = new InlineKeyboard();
    // Per-row Watch buttons for top 3 protocols (callback_data within 64 bytes).
    const seen = new Set<string>();
    let placed = 0;
    for (const r of rows) {
      if (placed >= 3) break;
      if (seen.has(r.project)) continue;
      seen.add(r.project);
      kb.text(`👀 Watch ${r.project}`, `watch:${r.project}`).row();
      placed++;
    }
    kb.url("📊 Open full list", `${siteUrl}/yields`);

    await ctx.reply(formatList(rows), {
      parse_mode: "Markdown",
      reply_markup: kb,
      link_preview_options: { is_disabled: true },
    });
  });

  // Handle the watch:* callback inline so /top is self-contained.
  // The /watch command itself is in 5.4.
  bot.callbackQuery(/^watch:(.+)$/, async (ctx) => {
    const project = ctx.match![1];
    const { upsertUser, addSubscription } = await import("@/lib/db");
    if (ctx.from) {
      try {
        upsertUser(ctx.from.id, ctx.from.username ?? undefined);
        addSubscription(ctx.from.id, "protocol", project, null);
        await ctx.answerCallbackQuery({
          text: `Watching ${project}. Use /alerts on for safety pings.`,
        });
      } catch (e) {
        console.error("[top callback] db error", e);
        await ctx.answerCallbackQuery({ text: "Couldn't save subscription." });
      }
    } else {
      await ctx.answerCallbackQuery({ text: "Couldn't identify you." });
    }
  });
}
