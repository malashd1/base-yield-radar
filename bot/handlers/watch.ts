import type { Bot } from "grammy";
import { upsertUser, addSubscription, db } from "@/lib/db";
import { isAuditedProtocol } from "@/lib/protocols";

/**
 * /watch                 — list current subscriptions
 * /watch <protocol>      — subscribe to a protocol (e.g. /watch morpho-blue)
 * /watch off <protocol>  — unsubscribe
 *
 * Protocol slug = DeFiLlama project slug (lowercase, hyphenated).
 */
export function registerWatch(bot: Bot): void {
  bot.command("watch", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Couldn't identify you.");
      return;
    }
    const arg = (ctx.match ?? "").trim();

    // No arg → list current subscriptions
    if (arg.length === 0) {
      const rows = db
        .prepare(
          "SELECT kind, target, threshold_pct FROM subscriptions WHERE tg_user_id = ? ORDER BY created_at DESC",
        )
        .all(ctx.from.id) as Array<{
        kind: string;
        target: string;
        threshold_pct: number | null;
      }>;
      if (rows.length === 0) {
        await ctx.reply(
          "You're not watching anything yet.\nTry `/watch morpho-blue` or `/top` to pick one.",
          { parse_mode: "Markdown" },
        );
        return;
      }
      const lines = rows.map((r) => {
        const audited =
          r.kind === "protocol" && isAuditedProtocol(r.target) ? " ✓" : "";
        const t = r.threshold_pct != null ? ` (≥${r.threshold_pct}%)` : "";
        return `• \`${r.kind}\` → ${r.target}${audited}${t}`;
      });
      await ctx.reply(
        ["*Your watches:*", ...lines, "", "_Remove one: /watch off <name>_"].join(
          "\n",
        ),
        { parse_mode: "Markdown" },
      );
      return;
    }

    // /watch off <name> → unsubscribe
    const offMatch = arg.match(/^off\s+(\S+)/i);
    if (offMatch) {
      const target = offMatch[1].toLowerCase();
      const info = db
        .prepare(
          "DELETE FROM subscriptions WHERE tg_user_id = ? AND target = ?",
        )
        .run(ctx.from.id, target);
      if (info.changes === 0) {
        await ctx.reply(`Wasn't watching \`${target}\`.`, {
          parse_mode: "Markdown",
        });
      } else {
        await ctx.reply(`Unwatched \`${target}\`.`, {
          parse_mode: "Markdown",
        });
      }
      return;
    }

    // Sanitize: lowercase, allow letters/digits/dash. Reject anything weird.
    const target = arg.toLowerCase().split(/\s+/)[0];
    if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(target)) {
      await ctx.reply(
        "Invalid protocol name. Use the DeFiLlama slug, e.g. `morpho-blue` or `aerodrome-v1`.",
        { parse_mode: "Markdown" },
      );
      return;
    }

    try {
      upsertUser(ctx.from.id, ctx.from.username ?? undefined);
      addSubscription(ctx.from.id, "protocol", target, null);
      const audited = isAuditedProtocol(target) ? " ✓ audited" : "";
      await ctx.reply(
        `Watching \`${target}\`${audited}.\nUse /alerts on for safety pings.`,
        { parse_mode: "Markdown" },
      );
    } catch (e) {
      console.error("[watch] db error", e);
      await ctx.reply("Couldn't save subscription, try again later.");
    }
  });
}
