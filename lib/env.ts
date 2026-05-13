import { z } from "zod";

/**
 * Centralized env validation + degraded-mode signaling.
 *
 * Philosophy:
 * - The app must BUILD and RUN without any of the optional secrets.
 * - When a secret is missing, the relevant feature degrades (stub mode, dry-run, etc.)
 *   instead of crashing.
 * - This module exposes both a typed `env` object and `features` flags that callers
 *   can use to decide whether to do the real thing or the safe fallback.
 */

const EnvSchema = z.object({
  // Required for production but optional in dev (degraded mode).
  TELEGRAM_BOT_TOKEN: z.string().optional().default(""),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional().default(""),
  ZEROEX_API_KEY: z.string().optional().default(""),
  AFFILIATE_FEE_RECIPIENT: z.string().optional().default(""),

  // Fully optional.
  ALCHEMY_API_KEY: z.string().optional().default(""),
  CDP_API_KEY: z.string().optional().default(""),
  NEXT_PUBLIC_SITE_URL: z
    .string()
    .optional()
    .default("http://localhost:3000"),
  DB_PATH: z.string().optional().default("./data/radar.db"),
});

export const env = EnvSchema.parse(process.env);

const isHexAddress = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);

export const features = {
  telegram: env.TELEGRAM_BOT_TOKEN.length > 0,
  telegramWebhook:
    env.TELEGRAM_BOT_TOKEN.length > 0 &&
    env.TELEGRAM_WEBHOOK_SECRET.length > 0,
  zeroexLive: env.ZEROEX_API_KEY.length > 0,
  affiliateFees: isHexAddress(env.AFFILIATE_FEE_RECIPIENT),
  alchemy: env.ALCHEMY_API_KEY.length > 0,
};

/** Pretty-print degraded features. Used by scripts/preflight.ts. */
export function describeDegradedMode(): string[] {
  const notes: string[] = [];
  if (!features.telegram) {
    notes.push(
      "TELEGRAM_BOT_TOKEN missing — bot runs in dry-run mode (logs instead of sending).",
    );
  }
  if (!features.telegramWebhook) {
    notes.push(
      "TELEGRAM_WEBHOOK_SECRET missing — /api/telegram/webhook will reject all requests.",
    );
  }
  if (!features.zeroexLive) {
    notes.push(
      "ZEROEX_API_KEY missing — /api/quote returns stub quotes (not real prices).",
    );
  }
  if (!features.affiliateFees) {
    notes.push(
      "AFFILIATE_FEE_RECIPIENT missing or not a valid 0x address — no affiliate fees collected.",
    );
  }
  if (!features.alchemy) {
    notes.push(
      "ALCHEMY_API_KEY missing — using public Base RPC (slower, lower limits).",
    );
  }
  return notes;
}
