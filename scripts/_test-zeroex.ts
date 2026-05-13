import { getQuote, BASE_TOKENS } from "../lib/zeroex";

async function main() {
  // No ZEROEX_API_KEY → stub mode.
  const q = await getQuote({
    sellToken: BASE_TOKENS.USDC,
    buyToken: BASE_TOKENS.WETH,
    sellAmount: 100_000_000n, // 100 USDC (6 decimals)
    taker: "0x0000000000000000000000000000000000000001",
  });

  if (q.source !== "stub") throw new Error(`expected source=stub, got ${q.source}`);
  for (const k of [
    "allowanceTarget",
    "to",
    "data",
    "value",
    "sellAmount",
    "buyAmount",
    "minBuyAmount",
    "price",
  ] as const) {
    if (!(k in q)) throw new Error(`missing field: ${k}`);
  }
  if (q.sellAmount !== "100000000")
    throw new Error(`sellAmount roundtrip broken: ${q.sellAmount}`);
  console.log("OK: stub quote shape valid");
  console.log(q);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
