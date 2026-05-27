import type { Bot, CommandContext, Context } from "grammy";
import {
  addWallet,
  listUserWallets,
  removeWallet,
  upsertUser,
} from "@/lib/db";
import { scanAndDescribeWallet } from "@/lib/positionScanner";

/**
 * /wallet add 0x... [label]   — register a wallet for position-based alerts
 * /wallet list                — show your wallets
 * /wallet remove 0x...        — stop tracking
 * /wallet check 0x...         — scan now and reply with current positions
 *
 * "Watching" someone else's wallet is allowed by design — no signature/proof,
 * just an address. This is a privacy-friendly choice (we never custody, we
 * just monitor public state) but be loud about it in the UX.
 */
const ADDR_RE = /0x[0-9a-fA-F]{40}/;

function short(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function fmtUsd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1) return `$${n.toFixed(2)}`;
  if (n < 1000) return `$${n.toFixed(0)}`;
  if (n < 1_000_000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${(n / 1_000_000).toFixed(2)}M`;
}

export function registerWallet(bot: Bot): void {
  bot.command("wallet", async (ctx) => {
    if (!ctx.from) {
      await ctx.reply("Couldn't identify you.");
      return;
    }
    const raw = (ctx.match ?? "").trim();

    // No args → show usage + list
    if (raw.length === 0) {
      await replyList(ctx);
      return;
    }

    const parts = raw.split(/\s+/);
    const sub = parts[0].toLowerCase();

    if (sub === "list") {
      await replyList(ctx);
      return;
    }

    if (sub === "add") {
      const addrPart = parts[1];
      if (!addrPart || !ADDR_RE.test(addrPart)) {
        await ctx.reply(
          "Usage: `/wallet add 0xabc...` (optionally followed by a label)",
          { parse_mode: "Markdown" },
        );
        return;
      }
      const label = parts.slice(2).join(" ") || null;
      upsertUser(ctx.from.id, ctx.from.username ?? undefined);
      const added = addWallet(ctx.from.id, addrPart, label ?? undefined);
      if (!added) {
        await ctx.reply(
          `Already watching \`${short(addrPart)}\`.`,
          { parse_mode: "Markdown" },
        );
        return;
      }
      await ctx.reply(
        [
          `Watching \`${short(addrPart)}\`${label ? ` (${label})` : ""}.`,
          "",
          "I'll alert you when any tracked vault you hold shows a TVL drop or APY spike. Run `/wallet check ` + the address to see current positions.",
        ].join("\n"),
        { parse_mode: "Markdown" },
      );
      return;
    }

    if (sub === "remove" || sub === "rm" || sub === "off") {
      const addrPart = parts[1];
      if (!addrPart || !ADDR_RE.test(addrPart)) {
        await ctx.reply("Usage: `/wallet remove 0xabc...`", {
          parse_mode: "Markdown",
        });
        return;
      }
      const ok = removeWallet(ctx.from.id, addrPart);
      await ctx.reply(
        ok
          ? `Stopped watching \`${short(addrPart)}\`.`
          : `Wasn't watching \`${short(addrPart)}\`.`,
        { parse_mode: "Markdown" },
      );
      return;
    }

    if (sub === "check") {
      const addrPart = parts[1];
      if (!addrPart || !ADDR_RE.test(addrPart)) {
        await ctx.reply("Usage: `/wallet check 0xabc...`", {
          parse_mode: "Markdown",
        });
        return;
      }
      await ctx.reply(`Scanning \`${short(addrPart)}\`…`, {
        parse_mode: "Markdown",
      });
      try {
        const { positions, vaultsChecked } = await scanAndDescribeWallet(
          addrPart,
        );
        if (positions.length === 0) {
          await ctx.reply(
            `No positions found in the ${vaultsChecked} tracked vaults. (LP/NFT positions like Uniswap V3 not yet supported.)`,
          );
          return;
        }
        const lines = [
          `*Positions for ${short(addrPart)}:*`,
          ...positions.map(
            (p) =>
              `• ${p.vault.name}: ${fmtUsd(p.assetUsd)} (~${p.vault.underlyingSymbol})`,
          ),
          "",
          `_Scanned ${vaultsChecked} known vaults._`,
        ];
        await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await ctx.reply(`Scan failed: ${msg.slice(0, 200)}`);
      }
      return;
    }

    // Bare address → treat as `add` for friendlier UX.
    if (ADDR_RE.test(parts[0])) {
      upsertUser(ctx.from.id, ctx.from.username ?? undefined);
      const ok = addWallet(ctx.from.id, parts[0]);
      await ctx.reply(
        ok
          ? `Watching \`${short(parts[0])}\`. (Tip: \`/wallet add ${short(parts[0])} mywallet\` to label it.)`
          : `Already watching \`${short(parts[0])}\`.`,
        { parse_mode: "Markdown" },
      );
      return;
    }

    await ctx.reply(
      [
        "*Wallet alerts*",
        "Track a Base wallet's vault positions. Alerts only fire on pools you actually hold.",
        "",
        "`/wallet add 0x...` _[label]_",
        "`/wallet list`",
        "`/wallet remove 0x...`",
        "`/wallet check 0x...` _— scan now_",
      ].join("\n"),
      { parse_mode: "Markdown" },
    );
  });
}

async function replyList(ctx: CommandContext<Context>): Promise<void> {
  if (!ctx.from) return;
  const rows = listUserWallets(ctx.from.id);
  if (rows.length === 0) {
    await ctx.reply(
      "No wallets linked. Add one with `/wallet add 0x...`",
      { parse_mode: "Markdown" },
    );
    return;
  }
  const lines = [
    "*Your wallets:*",
    ...rows.map(
      (r) => `• \`${short(r.address)}\`${r.label ? ` — ${r.label}` : ""}`,
    ),
    "",
    "_Remove with `/wallet remove 0x...`_",
  ];
  await ctx.reply(lines.join("\n"), { parse_mode: "Markdown" });
}
