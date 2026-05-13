/**
 * Preflight check — run before deploy or after editing .env.local.
 *
 *   npx tsx scripts/preflight.ts
 *
 * Lists which features are LIVE vs degraded based on env. Exits non-zero
 * only if a critical-for-prod var is missing AND --strict is passed.
 */

import { config as loadDotenv } from "dotenv";
import path from "node:path";

// Load .env.local explicitly — Next does this for the app, but plain tsx scripts don't.
loadDotenv({ path: path.resolve(process.cwd(), ".env.local") });

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { env, features, describeDegradedMode } = require("../lib/env") as typeof import("../lib/env");

const strict = process.argv.includes("--strict");

console.log("=== Base Yield Radar — preflight ===\n");

console.log("Site URL:        ", env.NEXT_PUBLIC_SITE_URL);
console.log("DB path:         ", env.DB_PATH);
console.log("");
console.log("Features:");
for (const [k, v] of Object.entries(features)) {
  console.log(`  ${(v ? "✓" : "·").padEnd(2)} ${k.padEnd(18)} ${v ? "LIVE" : "degraded"}`);
}
console.log("");

const notes = describeDegradedMode();
if (notes.length > 0) {
  console.log("Degraded notes:");
  for (const n of notes) console.log(`  · ${n}`);
  console.log("");
}

const productionCritical: Array<keyof typeof features> = [
  "telegram",
  "telegramWebhook",
  "zeroexLive",
  "affiliateFees",
];
const missing = productionCritical.filter((k) => !features[k]);

if (missing.length === 0) {
  console.log("All production-critical features are LIVE. Ready to deploy.");
  process.exit(0);
}

console.log(`Missing for production: ${missing.join(", ")}`);
if (strict) {
  console.error("\n--strict: failing.");
  process.exit(1);
} else {
  console.log("(Pass --strict to fail this check in CI.)");
  process.exit(0);
}
