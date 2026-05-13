import { bot } from "../bot";
import { db } from "../lib/db";

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

const USER = 555_111_222;

async function send(text: string) {
  const cmd = text.split(" ")[0];
  await bot.handleUpdate({
    update_id: Date.now(),
    message: {
      message_id: Date.now(),
      date: Math.floor(Date.now() / 1000),
      chat: { id: USER, type: "private", first_name: "T" },
      from: { id: USER, is_bot: false, first_name: "T", username: "tester" },
      text,
      entities: [{ type: "bot_command", offset: 0, length: cmd.length }],
    },
  });
}

function lastReply(): string {
  const sm = [...captured].reverse().find((c) => c.method === "sendMessage");
  return (sm?.payload.text as string) ?? "";
}

async function main() {
  // Cleanup
  db.prepare("DELETE FROM users WHERE tg_user_id = ?").run(USER);
  db.prepare("DELETE FROM subscriptions WHERE tg_user_id = ?").run(USER);

  // /watch with no args → "not watching anything"
  await send("/watch");
  if (!lastReply().includes("not watching anything"))
    throw new Error(`empty list: ${lastReply()}`);

  // /watch morpho-blue → subscribed + audited badge
  await send("/watch morpho-blue");
  if (!lastReply().includes("Watching `morpho-blue`"))
    throw new Error(`no confirm: ${lastReply()}`);
  if (!lastReply().includes("audited"))
    throw new Error(`expected audited badge: ${lastReply()}`);

  // /watch invalid garbage → reject
  await send("/watch !!!");
  if (!lastReply().includes("Invalid protocol name"))
    throw new Error(`should reject garbage: ${lastReply()}`);

  // /watch (with arg) lists current
  await send("/watch");
  if (!lastReply().includes("morpho-blue"))
    throw new Error(`list missing morpho-blue: ${lastReply()}`);

  // /watch off morpho-blue → removed
  await send("/watch off morpho-blue");
  if (!lastReply().includes("Unwatched"))
    throw new Error(`should confirm unwatch: ${lastReply()}`);

  // /alerts → currently OFF
  await send("/alerts");
  if (!lastReply().includes("OFF"))
    throw new Error(`expected OFF state: ${lastReply()}`);

  // /alerts on
  await send("/alerts on");
  if (!lastReply().includes("ON"))
    throw new Error(`alerts on failed: ${lastReply()}`);
  const safetyRow = db
    .prepare(
      "SELECT 1 FROM subscriptions WHERE tg_user_id = ? AND kind = 'safety'",
    )
    .get(USER);
  if (!safetyRow) throw new Error("safety subscription not in db");

  // /alerts off
  await send("/alerts off");
  if (!lastReply().includes("OFF"))
    throw new Error(`alerts off failed: ${lastReply()}`);

  // /alerts wrong arg
  await send("/alerts maybe");
  if (!lastReply().includes("Usage:"))
    throw new Error(`expected usage hint: ${lastReply()}`);

  console.log("OK: /watch + /alerts full happy + sad path");

  // Cleanup
  db.prepare("DELETE FROM users WHERE tg_user_id = ?").run(USER);
  db.prepare("DELETE FROM subscriptions WHERE tg_user_id = ?").run(USER);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  });
