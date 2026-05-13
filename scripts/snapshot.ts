/**
 * CLI wrapper around lib/snapshot.ts.
 *
 * Usage:
 *   npx tsx scripts/snapshot.ts                # top 50
 *   npx tsx scripts/snapshot.ts --limit=100    # custom top N
 */

import { runSnapshot } from "../lib/snapshot";

async function cli() {
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 50;
  if (!Number.isFinite(limit) || limit <= 0) {
    console.error("invalid --limit");
    process.exit(2);
  }

  console.log(`Taking snapshot of top-${limit} Base pools…`);
  const r = await runSnapshot({ limit });
  console.log(
    `OK: recorded=${r.recorded}/${r.totalPools} at ${new Date(r.takenAt * 1000).toISOString()}`,
  );
  console.log("Top 5 by TVL:");
  for (const t of r.topByTvl) {
    const apy = t.apy == null ? "—" : `${t.apy.toFixed(2)}%`;
    console.log(
      `  ${t.project.padEnd(28)} ${t.symbol.padEnd(20)} TVL=$${(t.tvlUsd / 1e6).toFixed(2)}M  APY=${apy}`,
    );
  }
}

cli().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
