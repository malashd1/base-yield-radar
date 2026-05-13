import type { Bot } from "grammy";
import { upsertUser, addSubscription, db } from "@/lib/db";

/**
 * /alerts on|off — toggle safety alert subscription.
 * Stored as kind='safety', target='*'.
 */
export function registerAlerts(bot: Bot): void {
  bot.command("alerts", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Couldn't identify you.");
      return;
    }
    const arg = (ctx.match ?? "").trim().toLowerCase();
    if (arg !== "on" && arg !== "off" && arg !== "") {
      await ctx.reply(
        "Usage: `/alerts on` or `/alerts off`",
        { parse_mode: "Markdown" },
      );
      return;
    }

    // No arg → show current state
    if (arg === "") {
      const row = db
        .prepare(
          "SELECT 1 FROM subscriptions WHERE tg_user_id = ? AND kind = 'safety' AND target = '*'",
        )
        .get(ctx.from.id);
      await ctx.reply(
        row ? "Safety alerts are *ON*." : "Safety alerts are *OFF*.",
        { parse_mode: "Markdown" },
      );
      return;
    }

    if (arg === "on") {
      try {
        upsertUser(ctx.from.id, ctx.from.username ?? undefined);
        addSubscription(ctx.from.id, "safety", "*", 20.0);
        await ctx.reply(
          "Safety alerts *ON*. I'll ping you when a top-50 Base pool drops TVL >20% in 6h or shows an APY spike.",
          { parse_mode: "Markdown" },
        );
      } catch (e) {
        console.error("[alerts on] db error", e);
        await ctx.reply("Couldn't enable alerts, try again later.");
      }
      return;
    }

    // off
    try {
      const info = db
        .prepare(
          "DELETE FROM subscriptions WHERE tg_user_id = ? AND kind = 'safety' AND target = '*'",
        )
        .run(ctx.from.id);
      await ctx.reply(
        info.changes > 0
          ? "Safety alerts *OFF*."
          : "Safety alerts were already off.",
        { parse_mode: "Markdown" },
      );
    } catch (e) {
      console.error("[alerts off] db error", e);
      await ctx.reply("Couldn't disable alerts, try again later.");
    }
  });
}
