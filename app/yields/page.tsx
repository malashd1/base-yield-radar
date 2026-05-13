import Link from "next/link";
import type { Metadata } from "next";
import { fetchBasePools, sortByApy } from "@/lib/defillama";
import { withCache } from "@/lib/cache";
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

const PAGE_MIN_TVL = 0; // YieldTable applies its own TVL filter
const PAGE_MAX_APY = 10_000; // hard cap to drop obvious garbage server-side
const PAGE_LIMIT = 100; // give the client room to filter

async function getYields(): Promise<YieldRow[]> {
  return withCache(
    `page:yields:v2:limit${PAGE_LIMIT}:max${PAGE_MAX_APY}`,
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
          stablecoin: p.stablecoin,
          ilRisk: p.ilRisk,
          exposure: p.exposure,
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
            <p className="mt-1 text-sm text-white/60">
              Sorted by APY · server-capped at 10,000% to drop garbage ·
              refreshed hourly
            </p>
          </div>
          <div className="text-xs text-white/40">
            data: defillama.com/yields
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
