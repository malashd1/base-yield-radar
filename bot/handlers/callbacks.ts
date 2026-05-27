import type { Bot } from "grammy";
import { mutePool, unmutePool } from "@/lib/db";

/**
 * Inline-keyboard callback router. Alert messages render buttons whose
 * callback_data follows `verb:arg` — we parse and dispatch here.
 *
 * Supported:
 *   mute:<poolId>     → mute pool indefinitely (24h variant TBD)
 *   unmute:<poolId>   → undo
 *   mute24h:<poolId>  → mute for 24h
 */
export function registerCallbacks(bot: Bot): void {
  bot.callbackQuery(/^mute:(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    const poolId = ctx.match![1];
    mutePool(ctx.from.id, poolId, null);
    await ctx.answerCallbackQuery({ text: "Muted." });
    try {
      await ctx.editMessageReplyMarkup({
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "🔔 Unmute",
                callback_data: `unmute:${poolId}`,
              },
            ],
          ],
        },
      });
    } catch {
      // Message may be too old to edit — ignore.
    }
  });

  bot.callbackQuery(/^mute24h:(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    const poolId = ctx.match![1];
    const until = Math.floor(Date.now() / 1000) + 24 * 3600;
    mutePool(ctx.from.id, poolId, until);
    await ctx.answerCallbackQuery({ text: "Muted for 24h." });
  });

  bot.callbackQuery(/^unmute:(.+)$/, async (ctx) => {
    if (!ctx.from) return;
    const poolId = ctx.match![1];
    unmutePool(ctx.from.id, poolId);
    await ctx.answerCallbackQuery({ text: "Unmuted." });
  });
}
