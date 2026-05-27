/**
 * Local development bot — long-polling.
 *
 * Telegram supports two modes for receiving updates: webhook (production) and
 * long polling (dev). Webhook requires a public HTTPS URL — useless from
 * localhost without an ngrok-style tunnel. Long polling just opens a connection
 * to Telegram and waits for events.
 *
 * Run with:   npx tsx scripts/dev-bot.ts
 *
 * IMPORTANT: long polling is mutually exclusive with a registered webhook.
 * On startup we call deleteWebhook to make sure we own the update stream.
 */

import { config as loadEnv } from "dotenv";

// Load .env.local BEFORE importing anything that reads process.env (lib/env.ts
// parses it at module load time). ES imports are hoisted, so we use dynamic
// import for the bot module below.
loadEnv({ path: ".env.local" });
loadEnv(); // fallback to .env

async function main() {
  const { bot, botLive } = await import("@/bot");

  if (!botLive) {
    console.error(
      "TELEGRAM_BOT_TOKEN missing — set it in .env.local and re-run.",
    );
    process.exit(1);
  }

  // Make sure no webhook is registered (would block long polling).
  try {
    await bot.api.deleteWebhook({ drop_pending_updates: false });
  } catch (e) {
    console.warn("[dev-bot] deleteWebhook failed:", (e as Error).message);
  }

  const me = await bot.api.getMe();
  console.log(`[dev-bot] connected as @${me.username} (id ${me.id})`);
  console.log("[dev-bot] long polling started — Ctrl+C to stop");

  const stop = async () => {
    console.log("\n[dev-bot] stopping…");
    await bot.stop();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);

  await bot.start();
}

main().catch((e) => {
  console.error("[dev-bot] fatal:", e);
  process.exit(1);
});
