/**
 * 0x Swap API client (v2, Permit2 endpoint).
 *
 * Docs: https://0x.org/docs/api
 *
 * In stub mode (no ZEROEX_API_KEY) returns a deterministic fake quote with the
 * real response shape. This lets the rest of the app develop without burning
 * 0x rate limits or requiring a key during dev.
 *
 * Affiliate fee:
 *   - swapFeeRecipient = AFFILIATE_FEE_RECIPIENT (your Base address)
 *   - swapFeeBps       = AFFILIATE_FEE_BPS (default 25 = 0.25%)
 *   - swapFeeToken     = the BUY token (so fee comes out of what user receives)
 *   Without these set, no fee is added.
 */

import { env, features } from "@/lib/env";

const BASE_CHAIN_ID = 8453;
const QUOTE_URL = "https://api.0x.org/swap/permit2/quote";
const AFFILIATE_FEE_BPS = 25; // 0.25%

// Common Base token addresses (just for stub-mode shape sanity).
export const BASE_TOKENS = {
  USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  WETH: "0x4200000000000000000000000000000000000006",
  cbBTC: "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf",
  cbETH: "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22",
} as const;

export interface QuoteParams {
  sellToken: string; // address (or "ETH" for native)
  buyToken: string; // address
  sellAmount: string | bigint; // base units of sellToken
  taker: string; // address that will execute the swap
  /** Override default 25 bps. Set to 0 to disable. */
  feeBps?: number;
}

export interface ZeroExQuote {
  /** Where to send approval (Permit2 contract on the chain). */
  allowanceTarget: string;
  /** Tx target (router contract). */
  to: string;
  /** Calldata for the tx. */
  data: string;
  /** Tx value in wei (0 for ERC-20 → ERC-20). */
  value: string;
  /** Gas estimate. */
  gas: string | null;
  /** Amounts. */
  sellAmount: string;
  buyAmount: string;
  minBuyAmount: string;
  /** Effective price for display. */
  price: string;
  /** Was this a stub or real fetch? */
  source: "live" | "stub";
}

function stubQuote(p: QuoteParams): ZeroExQuote {
  const sell = BigInt(p.sellAmount);
  // Pretend 1 USDC = 0.0003 WETH (~ETH at $3300).
  // For other pairs we just return parity. Numbers are placeholder shape only.
  const buy = sell;
  return {
    allowanceTarget: "0x000000000022D473030F116dDEE9F6B43aC78BA3", // Permit2
    to: "0x0000000000001fF3684f28c67538d4D072C22734", // 0x AllowanceHolder placeholder
    data: "0xstub",
    value: "0",
    gas: "200000",
    sellAmount: sell.toString(),
    buyAmount: buy.toString(),
    minBuyAmount: ((buy * 99n) / 100n).toString(),
    price: "1.0000",
    source: "stub",
  };
}

export async function getQuote(p: QuoteParams): Promise<ZeroExQuote> {
  if (!features.zeroexLive) {
    console.log(
      `[zeroex stub] ${p.sellToken} → ${p.buyToken} amount=${p.sellAmount} taker=${p.taker}`,
    );
    return stubQuote(p);
  }

  const url = new URL(QUOTE_URL);
  url.searchParams.set("chainId", String(BASE_CHAIN_ID));
  url.searchParams.set("sellToken", p.sellToken);
  url.searchParams.set("buyToken", p.buyToken);
  url.searchParams.set("sellAmount", String(p.sellAmount));
  url.searchParams.set("taker", p.taker);

  // Affiliate fee — only if address is valid.
  if (features.affiliateFees) {
    const bps = p.feeBps ?? AFFILIATE_FEE_BPS;
    if (bps > 0) {
      url.searchParams.set("swapFeeRecipient", env.AFFILIATE_FEE_RECIPIENT);
      url.searchParams.set("swapFeeBps", String(bps));
      url.searchParams.set("swapFeeToken", p.buyToken);
    }
  }

  const res = await fetch(url, {
    headers: {
      "0x-api-key": env.ZEROEX_API_KEY,
      "0x-version": "v2",
      accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`0x quote failed: ${res.status} ${res.statusText} ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as Record<string, unknown> & {
    transaction?: { to: string; data: string; value: string; gas: string };
    minBuyAmount?: string;
    buyAmount?: string;
    sellAmount?: string;
    price?: string;
    permit2?: { eip712?: { domain?: { verifyingContract?: string } } };
  };

  // 0x v2 nests tx data under `.transaction`.
  const tx = json.transaction;
  if (!tx) throw new Error("0x quote: missing transaction in response");

  return {
    allowanceTarget:
      json.permit2?.eip712?.domain?.verifyingContract ??
      "0x000000000022D473030F116dDEE9F6B43aC78BA3",
    to: tx.to,
    data: tx.data,
    value: tx.value ?? "0",
    gas: tx.gas ?? null,
    sellAmount: String(json.sellAmount ?? p.sellAmount),
    buyAmount: String(json.buyAmount ?? "0"),
    minBuyAmount: String(json.minBuyAmount ?? json.buyAmount ?? "0"),
    price: String(json.price ?? "0"),
    source: "live",
  };
}
