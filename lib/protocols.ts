/**
 * Hardcoded list of well-audited protocols on Base.
 * Used as a "safer" filter heuristic until/unless DeFiLlama exposes audit metadata per pool.
 *
 * Source: DefiLlama protocol audit info + manual review of major Base protocols.
 * Update conservatively — false positives here are dangerous (users trust this label).
 */
export const AUDITED_BASE_PROTOCOLS: ReadonlySet<string> = new Set([
  // DEX
  "aerodrome-v1",
  "aerodrome-slipstream",
  "uniswap-v3",
  "uniswap-v4",
  "pancakeswap-amm-v3",
  "balancer-v2",
  "balancer-v3",
  "curve-dex",

  // Lending
  "morpho-blue",
  "aave-v3",
  "compound-v3",
  "fluid-lending",
  "moonwell",

  // LST / LRT / vaults
  "yearn-finance",
  "beefy",
  "pendle",
  "stader",
  "kelp-dao",
]);

export function isAuditedProtocol(project: string): boolean {
  return AUDITED_BASE_PROTOCOLS.has(project);
}
