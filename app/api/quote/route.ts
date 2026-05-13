import { NextResponse } from "next/server";
import { getQuote } from "@/lib/zeroex";

/**
 * GET /api/quote?sellToken=&buyToken=&sellAmount=&taker=
 *
 * Returns a 0x v2 swap quote for Base. Stub mode kicks in if ZEROEX_API_KEY
 * is missing — useful in dev so the stake UI can render without a key.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sellToken = url.searchParams.get("sellToken");
  const buyToken = url.searchParams.get("buyToken");
  const sellAmount = url.searchParams.get("sellAmount");
  const taker = url.searchParams.get("taker");

  if (!sellToken || !buyToken || !sellAmount || !taker) {
    return NextResponse.json(
      {
        error:
          "missing required params: sellToken, buyToken, sellAmount, taker",
      },
      { status: 400 },
    );
  }

  // Validate sellAmount is a positive bigint string.
  let amt: bigint;
  try {
    amt = BigInt(sellAmount);
    if (amt <= 0n) throw new Error("sellAmount must be > 0");
  } catch {
    return NextResponse.json(
      { error: "sellAmount must be a positive integer (base units)" },
      { status: 400 },
    );
  }

  try {
    const q = await getQuote({
      sellToken,
      buyToken,
      sellAmount: amt,
      taker,
    });
    return NextResponse.json(q, {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /rate.?limit|429/i.test(msg) ? 429 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
