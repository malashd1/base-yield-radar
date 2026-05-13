import type { Bot } from "grammy";

const HELP = `*Base Yield Radar — commands*

*/start* — register & show menu
*/top* — top 10 yields on Base right now
*/watch* — list your subscriptions
*/watch <slug>* — subscribe to a protocol (e.g. \`/watch morpho-blue\`)
*/watch off <slug>* — unsubscribe
*/alerts* — show safety-alert state
*/alerts on* — get pings on TVL drops & APY spikes (top-50 pools)
*/alerts off* — silence safety alerts
*/help* — this list

_Web: see all 100+ pools and history charts at the link in /start._

Non-custodial. We never touch your funds.`;

export function registerHelp(bot: Bot): void {
  bot.command("help", async (ctx) => {
    await ctx.reply(HELP, { parse_mode: "Markdown" });
  });
}
