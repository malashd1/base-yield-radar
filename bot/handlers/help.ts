import type { Bot } from "grammy";

// Kept short — Telegram clients render Markdown lists best when each item is one line.
const HELP = `*Base Yield Radar — commands*

*/start* — register & show menu
*/top* — top 10 yields on Base right now

*Wallet alerts* _(recommended — only alerts on pools you actually hold)_
*/wallet add 0x...* _[label]_ — track a wallet's vault positions
*/wallet list* — show tracked wallets
*/wallet check 0x...* — scan now and reply with current positions
*/wallet remove 0x...* — stop tracking

*Broad alerts*
*/alerts on* — pings on TVL drops & APY spikes (top-50 pools, no wallet)
*/alerts off* — silence safety alerts
*/watch <slug>* — subscribe to a protocol (e.g. \`/watch morpho-blue\`)

*/help* — this list

_Non-custodial. We never touch your funds._`;

export function registerHelp(bot: Bot): void {
  bot.command("help", async (ctx) => {
    await ctx.reply(HELP, { parse_mode: "Markdown" });
  });
}
