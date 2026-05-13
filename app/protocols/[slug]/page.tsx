import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchBasePools,
  fetchPoolHistory,
  type DefiLlamaPool,
} from "@/lib/defillama";
import { withCache } from "@/lib/cache";
import { fmtUsd, fmtApy, apyRiskClass } from "@/lib/format";
import { isAuditedProtocol } from "@/lib/protocols";
import Sparkline from "@/components/Sparkline";

export const revalidate = 3600;
export const dynamic = "force-dynamic";

interface ProtocolData {
  pools: DefiLlamaPool[];
  totalTvl: number;
  topPoolHistory: { timestamp: string; value: number | null }[];
  topPool: DefiLlamaPool | null;
}

async function getProtocolData(slug: string): Promise<ProtocolData | null> {
  return withCache(`protocol:v1:${slug}`, 3600, async () => {
    const all = await fetchBasePools();
    const pools = all
      .filter((p) => p.project === slug)
      .sort((a, b) => b.tvlUsd - a.tvlUsd);

    if (pools.length === 0) return null;

    const totalTvl = pools.reduce((s, p) => s + (p.tvlUsd || 0), 0);
    const topPool = pools[0];

    let topPoolHistory: { timestamp: string; value: number | null }[] = [];
    try {
      const hist = await fetchPoolHistory(topPool.pool);
      topPoolHistory = hist.map((h) => ({
        timestamp: h.timestamp,
        value: h.apy,
      }));
    } catch {
      // History fetch failure shouldn't 500 the page.
    }

    return { pools, totalTvl, topPoolHistory, topPool };
  });
}

export default async function ProtocolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const decodedSlug = decodeURIComponent(slug);

  let data: ProtocolData | null = null;
  let err: string | null = null;
  try {
    data = await getProtocolData(decodedSlug);
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  if (!err && !data) notFound();

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-5xl px-6 py-12">
        <Link
          href="/yields"
          className="text-xs text-white/50 hover:text-white/80"
        >
          ← All yields
        </Link>

        <header className="mt-2 flex items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <h1 className="text-3xl font-semibold capitalize tracking-tight">
              {decodedSlug.replace(/-/g, " ")}
              {isAuditedProtocol(decodedSlug) && (
                <span
                  title="Well-known audited protocol"
                  className="ml-3 inline-block rounded border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-xs font-medium text-emerald-300"
                >
                  ✓ audited
                </span>
              )}
            </h1>
            {data && (
              <p className="mt-2 text-sm text-white/60">
                {data.pools.length} pool{data.pools.length === 1 ? "" : "s"}{" "}
                on Base · total TVL{" "}
                <span className="text-white/80">{fmtUsd(data.totalTvl)}</span>
              </p>
            )}
          </div>
        </header>

        {err && (
          <div className="mt-6 rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
            Failed to load: {err}
          </div>
        )}

        {data && (
          <>
            {data.topPool && (
              <section className="mt-8 rounded-xl border border-white/10 bg-white/[0.02] p-6">
                <div className="mb-3 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-white/40">
                      APY history · top pool
                    </div>
                    <div className="mt-1 font-mono text-sm text-white/80">
                      {data.topPool.symbol}
                      <span className="ml-2 text-white/40">
                        · {fmtUsd(data.topPool.tvlUsd)} TVL
                      </span>
                    </div>
                  </div>
                  <div
                    className={`text-3xl font-semibold tabular-nums ${apyRiskClass(data.topPool.apy)}`}
                  >
                    {fmtApy(data.topPool.apy)}
                  </div>
                </div>
                <Sparkline
                  data={data.topPoolHistory}
                  height={140}
                  valueFormat="percent"
                />
              </section>
            )}

            <section className="mt-8">
              <h2 className="mb-3 text-sm uppercase tracking-wide text-white/40">
                All pools
              </h2>
              <div className="overflow-hidden rounded-xl border border-white/10">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-wide text-white/50">
                    <tr>
                      <th className="px-4 py-3">Pool</th>
                      <th className="px-4 py-3 text-right">TVL</th>
                      <th className="px-4 py-3 text-right">APY</th>
                      <th className="px-4 py-3">Type</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.pools.map((p) => (
                      <tr
                        key={p.pool}
                        className="transition hover:bg-white/[0.03]"
                      >
                        <td className="px-4 py-3 font-mono text-xs">
                          {p.symbol}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-white/80">
                          {fmtUsd(p.tvlUsd)}
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-semibold tabular-nums ${apyRiskClass(p.apy)}`}
                        >
                          {fmtApy(p.apy)}
                        </td>
                        <td className="px-4 py-3 text-xs text-white/60">
                          {p.stablecoin
                            ? "stable"
                            : p.exposure === "single"
                              ? "single"
                              : "LP"}
                          {p.ilRisk === "yes" && (
                            <span className="ml-1 text-amber-300/80">
                              · IL
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
