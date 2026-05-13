/**
 * Smoke test for /top handler.
 * Verifies: command produces sendMessage with top-yields text + InlineKeyboard.
 */

import { bot } from "../bot";

interface Captured {
  method: string;
  payload: Record<string, unknown>;
}
const captured: Captured[] = [];
bot.api.config.use(async (_prev, method, payload) => {
  captured.push({ method, payload: payload as Record<string, unknown> });
  return {
    ok: true,
    result: { message_id: 1, date: 0, chat: { id: 1, type: "private" } },
  } as never;
});

async function main() {
  await bot.handleUpdate({
    update_id: 99,
    message: {
      message_id: 99,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 1, type: "private", first_name: "T" },
      from: { id: 1, is_bot: false, first_name: "T" },
      text: "/top",
      entities: [{ type: "bot_command", offset: 0, length: 4 }],
    },
  });

  const sm = captured.find((c) => c.method === "sendMessage");
  if (!sm) throw new Error("no sendMessage captured");
  const text = sm.payload.text as string;
  const kb = sm.payload.reply_markup as { inline_keyboard?: unknown[][] };

  if (!text.includes("Top yields on Base"))
    throw new Error(`bad text:\n${text}`);
  if (!text.match(/\bmorpho\b|\baerodrome\b|\byearn\b/i))
    throw new Error(`expected at least one well-known protocol in text:\n${text}`);
  if (!kb?.inline_keyboard || kb.inline_keyboard.length < 2)
    throw new Error("expected InlineKeyboard with watch buttons + open list");

  console.log("OK: /top responded with top yields and inline keyboard");
  console.log("---");
  console.log(text.split("\n").slice(0, 8).join("\n"));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  });
