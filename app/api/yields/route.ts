import { NextResponse } from "next/server";
import { fetchBasePools, sortByApy } from "@/lib/defillama";
import { withCache } from "@/lib/cache";

/**
 * GET /api/yields
 *
 * Query params:
 *   minTvl=100000        — minimum TVL in USD (default 100_000 to skip degen pools)
 *   limit=30             — max results (default 30, capped at 100)
 *   stableOnly=true|false — only stablecoin pools (default false)
 *   maxApy=10000         — cap APY to filter out obviously broken / scam pools (default 10_000)
 *
 * Cached server-side for 1h via lib/cache (FS). DeFiLlama itself doesn't
 * change /pools more than once per hour anyway.
 */
export const revalidate = 3600;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const minTvl = Number(url.searchParams.get("minTvl") ?? "100000");
  const limit = Math.min(
    Number(url.searchParams.get("limit") ?? "30"),
    100,
  );
  const stableOnly = url.searchParams.get("stableOnly") === "true";
  const maxApy = Number(url.searchParams.get("maxApy") ?? "10000");

  const cacheKey = `yields:v1:tvl${minTvl}:lim${limit}:stable${stableOnly}:max${maxApy}`;

  try {
    const data = await withCache(cacheKey, 3600, async () => {
      const pools = await fetchBasePools({ minTvlUsd: minTvl });
      const filtered = pools.filter((p) => {
        if (stableOnly && !p.stablecoin) return false;
        if (p.apy != null && p.apy > maxApy) return false;
        return true;
      });
      const sorted = sortByApy(filtered).slice(0, limit);
      // Trim payload — UI doesn't need everything.
      return sorted.map((p) => ({
        pool: p.pool,
        chain: p.chain,
        project: p.project,
        symbol: p.symbol,
        tvlUsd: p.tvlUsd,
        apy: p.apy,
        apyBase: p.apyBase,
        apyReward: p.apyReward,
        stablecoin: p.stablecoin,
        ilRisk: p.ilRisk,
        exposure: p.exposure,
        url: p.url,
      }));
    });

    return NextResponse.json(data, {
      headers: {
        "cache-control": "public, max-age=300, s-maxage=3600",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 429 / rate-limit detection so the loop can pause if needed.
    const status = /rate.?limit|429/i.test(msg) ? 429 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
