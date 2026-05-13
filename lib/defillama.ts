/**
 * DeFiLlama API client for Base chain.
 *
 * Endpoints used:
 * - https://yields.llama.fi/pools          → all pools across all chains, we filter Base
 * - https://yields.llama.fi/chart/{poolId} → 30+ days of APY/TVL history per pool
 *
 * No API key required. Free tier with reasonable rate limits.
 * Docs: https://defillama.com/docs/api
 */

const POOLS_URL = "https://yields.llama.fi/pools";
const CHART_URL = (poolId: string) =>
  `https://yields.llama.fi/chart/${poolId}`;

/** Single pool record as returned by /pools (relevant fields only). */
export interface DefiLlamaPool {
  pool: string; // pool id (uuid-ish)
  chain: string; // e.g. "Base"
  project: string; // e.g. "aerodrome-v1"
  symbol: string; // e.g. "USDC-WETH"
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
  rewardTokens: string[] | null;
  underlyingTokens: string[] | null;
  poolMeta: string | null;
  url: string | null;
  stablecoin: boolean;
  ilRisk: "yes" | "no" | string;
  exposure: "single" | "multi" | string;
  predictions?: {
    predictedClass?: string;
    predictedProbability?: number;
    binnedConfidence?: number;
  };
}

/** Single point in /chart/{poolId} response. */
export interface DefiLlamaPoolHistoryPoint {
  timestamp: string; // ISO date
  tvlUsd: number;
  apy: number | null;
  apyBase: number | null;
  apyReward: number | null;
}

interface PoolsResponse {
  status: string;
  data: DefiLlamaPool[];
}

interface ChartResponse {
  status: string;
  data: DefiLlamaPoolHistoryPoint[];
}

/**
 * Fetch all yield pools and return only those on Base chain.
 * Optional minimum TVL filter for noise reduction.
 */
export async function fetchBasePools(
  opts: { minTvlUsd?: number } = {},
): Promise<DefiLlamaPool[]> {
  const { minTvlUsd = 0 } = opts;
  const res = await fetch(POOLS_URL, {
    headers: { accept: "application/json" },
    // We use our own FS cache (lib/cache.ts) — Next's data cache can't hold the
    // >2MB pools payload anyway. Disable Next-side caching to silence warnings.
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(
      `DeFiLlama /pools failed: ${res.status} ${res.statusText}`,
    );
  }
  const json = (await res.json()) as PoolsResponse;
  if (!json?.data || !Array.isArray(json.data)) {
    throw new Error("DeFiLlama /pools: unexpected payload shape");
  }
  return json.data.filter(
    (p) => p.chain === "Base" && p.tvlUsd >= minTvlUsd,
  );
}

/** Fetch ~30 days of TVL/APY history for a single pool. */
export async function fetchPoolHistory(
  poolId: string,
): Promise<DefiLlamaPoolHistoryPoint[]> {
  const res = await fetch(CHART_URL(poolId), {
    headers: { accept: "application/json" },
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(
      `DeFiLlama /chart/${poolId} failed: ${res.status} ${res.statusText}`,
    );
  }
  const json = (await res.json()) as ChartResponse;
  if (!json?.data || !Array.isArray(json.data)) {
    throw new Error(`DeFiLlama /chart/${poolId}: unexpected payload shape`);
  }
  return json.data;
}

/** Sort pools by APY descending; pools without APY go to the bottom. */
export function sortByApy(pools: DefiLlamaPool[]): DefiLlamaPool[] {
  return [...pools].sort((a, b) => {
    const av = a.apy ?? -1;
    const bv = b.apy ?? -1;
    return bv - av;
  });
}
