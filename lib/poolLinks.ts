/**
 * Pool-URL resolver: where should a click on a pool row actually take the user?
 *
 * Priority order:
 *   1. If we have a stake page for this exact vault → /stake/{slug} (we earn the
 *      0x swap fee on this page).
 *   2. If we have a deep-link template for the protocol → use it (better UX than
 *      a DeFiLlama detour; doesn't earn us anything but doesn't lose anything
 *      either).
 *   3. Fallback to DeFiLlama's pool page (always correct; has a link to the
 *      protocol's own page from there).
 *
 * Adding direct protocol URLs is a manual / per-protocol exercise because
 * DeFiLlama returns UUIDs, not pool contract addresses, so we cannot construct
 * pool-specific URLs for AMM protocols. For lending protocols we can use the
 * underlying token address.
 */

import { MORPHO_USDC_VAULT_META, USDC_BASE } from "@/lib/morpho";

export interface PoolLink {
  href: string;
  /** Where this link goes — drives UI hint ("Stake ↗" vs "Open pool ↗" vs "View ↗"). */
  kind: "stake" | "protocol" | "defillama";
  /** External target? */
  external: boolean;
}

/**
 * Map a DeFiLlama pool to its preferred destination.
 *
 * NOTE: Each branch should be conservative — sending a user to the wrong URL is
 * worse than sending them to DeFiLlama. When uncertain, fall back.
 */
export function resolvePoolLink(
  pool: { project: string; pool: string; symbol: string; underlyingTokens?: string[] | null },
): PoolLink {
  const sym = (pool.symbol || "").toUpperCase();
  const underlying = pool.underlyingTokens?.[0]?.toLowerCase();

  // 1. Supported staking flows — keep the user on our site.
  if (pool.project === "morpho-blue" && /STEAKUSDC/.test(sym)) {
    return {
      href: `/stake/${MORPHO_USDC_VAULT_META.slug}`,
      kind: "stake",
      external: false,
    };
  }

  // 2. Protocol-direct deep links.
  //    For AMM/LP pools we can't get the pool contract from DeFiLlama, but we
  //    have the underlying token addresses — that's enough for protocols whose
  //    UI accepts token0/token1 query params (Aerodrome) or whose "explore
  //    token" page lists the pools containing that token (Uniswap).
  const tokens = pool.underlyingTokens?.map((t) => t.toLowerCase()) ?? [];
  const t0 = tokens[0];
  const t1 = tokens[1];

  switch (pool.project) {
    // ---- Lending / vaults ----
    case "aave-v3":
      if (underlying) {
        return {
          href: `https://app.aave.com/reserve-overview/?underlyingAsset=${underlying}&marketName=proto_base_v3`,
          kind: "protocol",
          external: true,
        };
      }
      break;
    case "spark-savings":
      return {
        href: "https://app.spark.fi/savings",
        kind: "protocol",
        external: true,
      };
    case "fluid-lending":
      return {
        href: `https://fluid.instadapp.io/lending/8453/${sym.split(/[-/]/)[0]}`,
        kind: "protocol",
        external: true,
      };
    case "morpho-blue":
      return {
        href: "https://app.morpho.org/base/earn",
        kind: "protocol",
        external: true,
      };
    case "compound-v3":
      if (underlying && underlying === USDC_BASE.toLowerCase()) {
        return {
          href: "https://app.compound.finance/markets/usdc-basemainnet",
          kind: "protocol",
          external: true,
        };
      }
      break;

    // ---- AMM / DEX ----
    case "aerodrome-v1":
      if (t0 && t1) {
        // Aerodrome v1 deposit flow accepts token0/token1 query params and
        // shows the matching pool (stable + volatile) for the pair.
        return {
          href: `https://aerodrome.finance/deposit?token0=${t0}&token1=${t1}&chain0=8453&chain1=8453`,
          kind: "protocol",
          external: true,
        };
      }
      break;
    case "aerodrome-slipstream":
      if (t0 && t1) {
        return {
          href: `https://aerodrome.finance/pools?token0=${t0}&token1=${t1}`,
          kind: "protocol",
          external: true,
        };
      }
      break;
    case "uniswap-v3":
      if (t0 && t1) {
        // Uniswap V3 "add liquidity" deep link picks the pair automatically.
        return {
          href: `https://app.uniswap.org/positions/create/v3?currencyA=${t0}&currencyB=${t1}&chain=base`,
          kind: "protocol",
          external: true,
        };
      }
      break;
    case "uniswap-v4":
      if (t0 && t1) {
        return {
          href: `https://app.uniswap.org/positions/create/v4?currencyA=${t0}&currencyB=${t1}&chain=base`,
          kind: "protocol",
          external: true,
        };
      }
      break;
    case "pancakeswap-amm-v3":
      if (t0 && t1) {
        return {
          href: `https://pancakeswap.finance/add/${t0}/${t1}/2500?chain=base`,
          kind: "protocol",
          external: true,
        };
      }
      break;
    case "balancer-v2":
    case "balancer-v3":
      return {
        href: "https://balancer.fi/pools?networks=BASE",
        kind: "protocol",
        external: true,
      };
    case "curve-dex":
      return {
        href: "https://www.curve.finance/dex/base/pools/",
        kind: "protocol",
        external: true,
      };
  }

  // 3. Fallback — DeFiLlama pool page (always works, has link out to the
  //    protocol from there).
  return {
    href: `https://defillama.com/yields/pool/${pool.pool}`,
    kind: "defillama",
    external: true,
  };
}
