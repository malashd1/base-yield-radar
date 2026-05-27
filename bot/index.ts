/**
 * Telegram bot setup (grammy).
 *
 * Single source of truth for the bot instance. Cron handlers, the webhook
 * route, and the dry-run test harness all import `bot` from here.
 *
 * Token policy:
 * - If TELEGRAM_BOT_TOKEN is missing, we instantiate the bot with a placeholder
 *   token. Handlers still register and can be exercised via grammy's
 *   `bot.handleUpdate(...)` for tests, but ANY outbound call to TG (sendMessage
 *   etc.) will fail. Notification dispatch (lib/notify) checks the same flag
 *   and logs instead of throwing in dry-run mode.
 * - In production, .env.local must set TELEGRAM_BOT_TOKEN.
 */

import { Bot } from "grammy";
import { env, features } from "@/lib/env";
import { registerStart } from "./handlers/start";
import { registerTop } from "./handlers/top";
import { registerWatch } from "./handlers/watch";
import { registerWallet } from "./handlers/wallet";
import { registerAlerts } from "./handlers/alerts";
import { registerCallbacks } from "./handlers/callbacks";
import { registerHelp } from "./handlers/help";

const TOKEN_PLACEHOLDER = "0000000000:dry-run-no-token";

function createBot(): Bot {
  const token = env.TELEGRAM_BOT_TOKEN || TOKEN_PLACEHOLDER;
  const b = new Bot(
    token,
    features.telegram
      ? {}
      : {
          // Dry-run: skip the auth round-trip to TG by faking botInfo.
          // grammy then accepts handleUpdate calls without bot.init().
          // Cast to satisfy any UserFromGetMe field additions in future
          // grammy/types versions — we only ever read this via handlers,
          // never echo it back to TG.
          botInfo: {
            id: 0,
            is_bot: true,
            first_name: "DryRunBot",
            username: "dry_run_bot",
            can_join_groups: false,
            can_read_all_group_messages: false,
            supports_inline_queries: false,
            can_connect_to_business: false,
            has_main_web_app: false,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        },
  );

  // Order matters only for /start (we want welcome before any catch-all).
  registerStart(b);
  registerTop(b);
  registerWatch(b);
  registerWallet(b);
  registerAlerts(b);
  registerHelp(b);
  registerCallbacks(b);

  // Generic catch-all so unknown commands don't silently die.
  b.on("message:text", async (ctx) => {
    if (ctx.message.text.startsWith("/")) {
      await ctx.reply(
        "Unknown command. Try /help to see what I can do.",
      );
    }
  });

  // Surface errors instead of crashing the runtime.
  b.catch((err) => {
    console.error("[bot] error", err);
  });

  return b;
}

// Cache one bot per process (Next dev hot-reload safety).
const globalForBot = globalThis as unknown as {
  __radar_bot?: Bot;
};

export const bot: Bot =
  globalForBot.__radar_bot ?? (globalForBot.__radar_bot = createBot());

/** True when the bot can actually call Telegram. False = dry-run. */
export const botLive = features.telegram;
