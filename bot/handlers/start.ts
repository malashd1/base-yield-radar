import type { Bot } from "grammy";
import { upsertUser } from "@/lib/db";

const WELCOME = `👋 *Welcome to Base Yield Radar*

I track yields and safety signals across the Base ecosystem.

Try:
• /top — current top yields on Base
• /watch <protocol> — get pinged on changes (e.g. /watch morpho-blue)
• /alerts on — subscribe to safety alerts (TVL drops, APY spikes)
• /help — full command list

Web app: https://baseyieldradar.app
Non-custodial. We never touch your funds.`;

export function registerStart(bot: Bot): void {
  bot.command("start", async (ctx) => {
    if (ctx.from) {
      try {
        upsertUser(ctx.from.id, ctx.from.username ?? undefined);
      } catch (e) {
        // db down shouldn't crash the handler — just log
        console.error("[start] upsertUser failed", e);
      }
    }
    await ctx.reply(WELCOME, { parse_mode: "Markdown" });
  });
}
