import { NextResponse } from "next/server";
import { bot } from "@/bot";
import { env, features } from "@/lib/env";
import type { Update } from "grammy/types";

/**
 * POST /api/telegram/webhook
 *
 * Telegram delivers updates here. We validate the X-Telegram-Bot-Api-Secret-Token
 * header against TELEGRAM_WEBHOOK_SECRET, then dispatch the update to the bot.
 *
 * Setup:
 *   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
 *     -d "url=https://<your-domain>/api/telegram/webhook" \
 *     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
 */
export const runtime = "nodejs"; // grammy + better-sqlite3 need Node, not Edge
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // Refuse if not configured. Returning 200 keeps TG from retrying forever.
  if (!features.telegramWebhook) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Webhook not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in env.",
      },
      { status: 200 },
    );
  }

  const provided = req.headers.get("x-telegram-bot-api-secret-token");
  if (provided !== env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "bad secret" }, { status: 401 });
  }

  let update: Update;
  try {
    update = (await req.json()) as Update;
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  try {
    await bot.handleUpdate(update);
  } catch (e) {
    // Don't 500 — TG would retry. Log and ack.
    console.error("[telegram webhook] handler error", e);
  }
  return NextResponse.json({ ok: true });
}

// Friendly probe for "is this URL alive?" checks.
export async function GET() {
  return NextResponse.json({
    ok: true,
    configured: features.telegramWebhook,
    note: "POST updates here from Telegram (with x-telegram-bot-api-secret-token).",
  });
}
