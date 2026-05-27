import Link from "next/link";
import type { Metadata } from "next";
import { fetchBasePools, sortByApy } from "@/lib/defillama";
import { withCache } from "@/lib/cache";
import { isStablePool } from "@/lib/tokens";
import YieldTable, { type YieldRow } from "@/components/YieldTable";

export const metadata: Metadata = {
  title: "Top yields",
  description:
    "Sortable, filterable list of the top yield pools on Base — Aerodrome, Morpho, Yearn, and more. Refreshed hourly.",
  openGraph: {
    title: "Top yields on Base",
    images: [
      {
        url: "/api/og?title=Top+yields+on+Base&subtitle=Filter+by+TVL%2C+stable%2C+audited",
        width: 1200,
        height: 630,
      },
    ],
  },
};

export const revalidate = 3600;
export const dynamic = "force-dynamic";

// Server-side cuts so the client filters have something meaningful to chew on.
// Without minTvl, "top 100 by APY" is dominated by tiny emission-driven farms.
// We need a fairly large limit so low-APY stablecoin pools also make it into
// the dataset (otherwise the "stable only" filter looks broken — the real
// stable yields like Aave USDC live at 3-8% APY, well below the farm spike zone).
const PAGE_MIN_TVL = 100_000;
const PAGE_MAX_APY = 5_000;
const PAGE_LIMIT = 800;

async function getYields(): Promise<YieldRow[]> {
  return withCache(
    `page:yields:v6:tvl${PAGE_MIN_TVL}:limit${PAGE_LIMIT}:max${PAGE_MAX_APY}`,
    3600,
    async () => {
      const pools = await fetchBasePools({ minTvlUsd: PAGE_MIN_TVL });
      const filtered = pools.filter(
        (p) => p.apy == null || p.apy <= PAGE_MAX_APY,
      );
      return sortByApy(filtered)
        .slice(0, PAGE_LIMIT)
        .map((p) => ({
          pool: p.pool,
          project: p.project,
          symbol: p.symbol,
          tvlUsd: p.tvlUsd,
          apy: p.apy,
          apyBase: p.apyBase,
          apyReward: p.apyReward,
          // DeFiLlama's stablecoin flag is unreliable (e.g. marks USDC-AVAIL as
          // stable). Use our own ticker-based classifier instead.
          stablecoin: isStablePool(p.symbol),
          ilRisk: p.ilRisk,
          exposure: p.exposure,
          predictedClass: p.predictions?.predictedClass ?? null,
          apyMean30d: p.apyMean30d ?? null,
          apyPct30D: p.apyPct30D ?? null,
          underlyingTokens: p.underlyingTokens ?? null,
        }));
    },
  );
}

export default async function YieldsPage() {
  let pools: YieldRow[] = [];
  let err: string | null = null;
  try {
    pools = await getYields();
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <header className="mb-8 flex items-end justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-xs text-white/50 hover:text-white/80"
            >
              ← Home
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">
              Top yields on Base
            </h1>
            <p className="mt-1 text-sm text-white/55">
              Sorted by APY · refreshed hourly · incentive farms hidden by default
            </p>
          </div>
        </header>

        {err ? (
          <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            Failed to load yields: {err}
          </div>
        ) : (
          <YieldTable rows={pools} />
        )}

        <p className="mt-6 text-xs text-white/40">
          High APYs often reflect emission rewards or tiny pools — not
          sustainable yield. Always check TVL, audit status, and history before
          depositing.
        </p>
      </div>
    </main>
  );
}
