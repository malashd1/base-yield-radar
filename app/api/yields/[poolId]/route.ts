import { NextResponse } from "next/server";
import { fetchBasePools, fetchPoolHistory } from "@/lib/defillama";
import { withCache } from "@/lib/cache";

/**
 * GET /api/yields/[poolId]
 *
 * Returns the current pool snapshot + ~30d of TVL/APY history.
 * Both halves are cached for 1h server-side.
 *
 * Shape:
 *   {
 *     pool: { pool, project, symbol, chain, tvlUsd, apy, ... },
 *     history: [{ timestamp, tvlUsd, apy, apyBase, apyReward }]
 *   }
 *
 * 404 if poolId is not a Base pool (we only serve Base in v1).
 */
export const revalidate = 3600;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ poolId: string }> },
) {
  const { poolId } = await params;
  if (!poolId || poolId.length < 8) {
    return NextResponse.json({ error: "invalid poolId" }, { status: 400 });
  }

  try {
    const [poolMeta, history] = await Promise.all([
      withCache(`pool:meta:v1:${poolId}`, 3600, async () => {
        const all = await fetchBasePools();
        const found = all.find((p) => p.pool === poolId);
        return found ?? null;
      }),
      withCache(`pool:history:v1:${poolId}`, 3600, () =>
        fetchPoolHistory(poolId),
      ),
    ]);

    if (!poolMeta) {
      return NextResponse.json(
        { error: "pool not found on Base (v1 supports Base only)" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        pool: {
          pool: poolMeta.pool,
          chain: poolMeta.chain,
          project: poolMeta.project,
          symbol: poolMeta.symbol,
          tvlUsd: poolMeta.tvlUsd,
          apy: poolMeta.apy,
          apyBase: poolMeta.apyBase,
          apyReward: poolMeta.apyReward,
          stablecoin: poolMeta.stablecoin,
          ilRisk: poolMeta.ilRisk,
          exposure: poolMeta.exposure,
          rewardTokens: poolMeta.rewardTokens,
          underlyingTokens: poolMeta.underlyingTokens,
          url: poolMeta.url,
        },
        history,
      },
      {
        headers: {
          "cache-control": "public, max-age=300, s-maxage=3600",
        },
      },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = /rate.?limit|429/i.test(msg) ? 429 : 502;
    return NextResponse.json({ error: msg }, { status });
  }
}
