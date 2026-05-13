/**
 * Smoke test for /start handler in dry-run mode.
 *
 * grammy's bot.api.config.use lets us install a transformer that intercepts
 * outbound calls — we record them instead of hitting Telegram. This lets us
 * exercise the full handler pipeline (registration, command parsing, db side
 * effects, reply construction) without a real bot token.
 */

import { bot } from "../bot";
import { db } from "../lib/db";

interface Captured {
  method: string;
  payload: Record<string, unknown>;
}
const captured: Captured[] = [];

bot.api.config.use(async (_prev, method, payload) => {
  captured.push({ method, payload: payload as Record<string, unknown> });
  // Return a minimally-valid Telegram response so grammy doesn't throw.
  return {
    ok: true,
    result: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 1, type: "private" },
    },
    // grammy expects ApiResponse — cast to any to satisfy.
  } as never;
});

const TEST_USER_ID = 999_888_777;

async function main() {
  // Cleanup any prior test row.
  db.prepare("DELETE FROM users WHERE tg_user_id = ?").run(TEST_USER_ID);

  await bot.handleUpdate({
    update_id: 1,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: TEST_USER_ID, type: "private", first_name: "Test" },
      from: {
        id: TEST_USER_ID,
        is_bot: false,
        first_name: "Test",
        username: "test_user_smoke",
      },
      text: "/start",
      entities: [{ type: "bot_command", offset: 0, length: 6 }],
    },
  });

  // Verify: 1) sendMessage was called, 2) user got upserted.
  const sm = captured.find((c) => c.method === "sendMessage");
  if (!sm) throw new Error("expected sendMessage to be called");
  const text = sm.payload.text as string;
  if (!text.includes("Welcome to Base Yield Radar"))
    throw new Error(`unexpected reply text: ${text}`);
  console.log("OK: sendMessage with welcome text captured");

  const u = db
    .prepare("SELECT username FROM users WHERE tg_user_id = ?")
    .get(TEST_USER_ID) as { username: string } | undefined;
  if (!u) throw new Error("expected user row to exist");
  if (u.username !== "test_user_smoke")
    throw new Error(`expected username test_user_smoke, got ${u.username}`);
  console.log("OK: user row created with correct username");

  // Cleanup.
  db.prepare("DELETE FROM users WHERE tg_user_id = ?").run(TEST_USER_ID);
}

main()
  .then(() => {
    console.log("PASS");
    process.exit(0);
  })
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  });
