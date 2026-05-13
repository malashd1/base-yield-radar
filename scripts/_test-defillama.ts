import { fetchBasePools, fetchPoolHistory, sortByApy } from "../lib/defillama";

async function main() {
  const pools = await fetchBasePools();
  console.log("TASK 1.1 base pools:", pools.length);
  if (pools.length === 0) {
    throw new Error("expected > 0 Base pools");
  }
  const top = sortByApy(pools)[0];
  console.log(
    "top:",
    top.project,
    top.symbol,
    "APY=",
    top.apy,
    "TVL=",
    top.tvlUsd,
  );
  const history = await fetchPoolHistory(top.pool);
  console.log("TASK 1.2 history points:", history.length);
  if (history.length === 0) {
    throw new Error("expected > 0 history points");
  }
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
