import { bot } from "../bot";
import { sendToUser, broadcast } from "../lib/notify";

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
  // /help
  await bot.handleUpdate({
    update_id: 1,
    message: {
      message_id: 1,
      date: Math.floor(Date.now() / 1000),
      chat: { id: 1, type: "private", first_name: "T" },
      from: { id: 1, is_bot: false, first_name: "T" },
      text: "/help",
      entities: [{ type: "bot_command", offset: 0, length: 5 }],
    },
  });
  const helpReply = captured.findLast?.((c) => c.method === "sendMessage");
  const helpText = (helpReply?.payload.text as string) ?? "";
  if (
    !helpText.includes("/start") ||
    !helpText.includes("/top") ||
    !helpText.includes("/watch") ||
    !helpText.includes("/alerts") ||
    !helpText.includes("Non-custodial")
  ) {
    throw new Error(`/help missing expected sections:\n${helpText}`);
  }
  console.log("OK: /help lists all commands");

  // notify dryrun
  const r = await sendToUser(123, "test message");
  if (r.outcome !== "dryrun") throw new Error(`expected dryrun, got ${r.outcome}`);
  console.log("OK: sendToUser dryrun");

  // broadcast dryrun — every send returns ok+outcome="dryrun", which counts as `sent`.
  const summary = await broadcast([1, 2, 3], "hi all");
  if (summary.sent !== 3 || summary.failed !== 0 || summary.skipped !== 0)
    throw new Error(`unexpected dryrun summary: ${JSON.stringify(summary)}`);
  console.log("OK: broadcast dryrun summary", summary);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("FAIL:", e);
    process.exit(1);
  });
