/**
 * User-facing notification dispatch.
 *
 * - In dry-run mode (no TELEGRAM_BOT_TOKEN), every send is logged to console.
 *   Cron jobs and bot handlers can call notify() unconditionally without
 *   crashing or polluting tests with real network traffic.
 * - In live mode, calls bot.api.sendMessage. Handles common Telegram error
 *   classes (403 user blocked, 400 chat not found) so one bad subscriber
 *   doesn't kill a batch.
 */

import { bot, botLive } from "@/bot";

/** Minimal inline-keyboard shape — matches Telegram's API. */
export interface InlineButton {
  text: string;
  /** External URL — opens in browser. */
  url?: string;
  /** Callback payload — routed to bot.callbackQuery handlers. */
  callback_data?: string;
}

export interface SendOptions {
  parseMode?: "Markdown" | "MarkdownV2" | "HTML";
  disableLinkPreview?: boolean;
  /** 2D array — each inner array is one row of buttons. */
  inlineKeyboard?: InlineButton[][];
}

export interface SendResult {
  ok: boolean;
  /** "sent", "dryrun", or "skip:<reason>" */
  outcome: string;
  error?: string;
}

export async function sendToUser(
  tgUserId: number,
  text: string,
  opts: SendOptions = {},
): Promise<SendResult> {
  if (!botLive) {
    console.log(
      `[notify dryrun → ${tgUserId}] ${text.slice(0, 120).replace(/\n/g, " ")}${text.length > 120 ? "…" : ""}`,
    );
    return { ok: true, outcome: "dryrun" };
  }

  try {
    await bot.api.sendMessage(tgUserId, text, {
      parse_mode: opts.parseMode,
      link_preview_options: opts.disableLinkPreview
        ? { is_disabled: true }
        : undefined,
      // grammy's InlineKeyboardButton is a discriminated union (url XOR
       // callback_data XOR …). We accept the looser InlineButton shape from
       // callers and let Telegram's API validate at runtime.
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
       reply_markup: opts.inlineKeyboard
        ? ({ inline_keyboard: opts.inlineKeyboard } as any)
        : undefined,
    });
    return { ok: true, outcome: "sent" };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Telegram 403: user blocked the bot. Telegram 400: chat not found / deactivated.
    // Both are "soft skip" — don't crash the caller.
    if (/403|blocked|deactivated|chat not found/i.test(msg)) {
      return { ok: true, outcome: `skip:${msg.slice(0, 80)}` };
    }
    return { ok: false, outcome: "error", error: msg };
  }
}

/**
 * Fan out a single message to many user ids. Returns a summary —
 * callers can log it or fold into job results.
 */
export async function broadcast(
  tgUserIds: number[],
  text: string,
  opts: SendOptions = {},
): Promise<{ sent: number; skipped: number; failed: number }> {
  let sent = 0,
    skipped = 0,
    failed = 0;
  for (const id of tgUserIds) {
    const r = await sendToUser(id, text, opts);
    if (!r.ok) failed++;
    else if (r.outcome.startsWith("skip:")) skipped++;
    else sent++;
  }
  return { sent, skipped, failed };
}
