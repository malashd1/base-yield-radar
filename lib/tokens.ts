/**
 * Tickers we consider stablecoins (USD- or EUR-pegged). Used to compute our own
 * "stablecoin" flag because DeFiLlama's flag is unreliable — it sometimes marks
 * pools like USDC-AVAIL as stablecoin=true even though AVAIL is not a stable.
 */
const STABLE_TOKENS = new Set([
  "USDC",
  "USDBC",
  "USDC.E",
  "USDT",
  "DAI",
  "SDAI",
  "USDS",
  "USDE",
  "SUSDE",
  "EURC",
  "EURT",
  "PYUSD",
  "USDM",
  "CRVUSD",
  "GHO",
  "FRAX",
  "LUSD",
  "USDA",
  "USD+",
  "DOLA",
]);

/** ETH variants — used for "ETH-correlated" classification (LSTs/LRTs). */
const ETH_TOKENS = new Set([
  "ETH",
  "WETH",
  "CBETH",
  "WSTETH",
  "RETH",
  "WEETH",
  "EZETH",
  "RSETH",
  "OSETH",
]);

/** BTC variants. */
const BTC_TOKENS = new Set(["WBTC", "CBBTC", "TBTC"]);

/** Misc majors recognized for the "don't show research link" check. */
const MAJOR_TOKENS = new Set([
  "AERO",
  "MORPHO",
  "COMP",
  "AAVE",
  "UNI",
  "LDO",
  "STEAKUSDC",
]);

const KNOWN_BASE_TOKENS = new Set<string>([
  ...STABLE_TOKENS,
  ...ETH_TOKENS,
  ...BTC_TOKENS,
  ...MAJOR_TOKENS,
]);

export function isKnownToken(symbol: string): boolean {
  return KNOWN_BASE_TOKENS.has(symbol.toUpperCase());
}

export function isStableToken(symbol: string): boolean {
  return STABLE_TOKENS.has(symbol.toUpperCase());
}

/**
 * True if every token in a pool symbol is a known stablecoin. Treats vault names
 * starting with "STEAK" (Steakhouse vaults) as stable when the underlying is.
 */
export function isStablePool(symbol: string): boolean {
  const tokens = splitPoolSymbol(symbol);
  if (tokens.length === 0) return false;
  return tokens.every((t) => {
    const up = t.toUpperCase();
    if (isStableToken(up)) return true;
    // Steakhouse vault tokens like STEAKUSDC wrap a stable
    if (up.startsWith("STEAK") && Array.from(STABLE_TOKENS).some((s) => up.includes(s))) {
      return true;
    }
    return false;
  });
}

export function isEthToken(symbol: string): boolean {
  return ETH_TOKENS.has(symbol.toUpperCase());
}

/**
 * True if the pool contains at least one ETH-flavored token (ETH, WETH, or any
 * LST/LRT). "Any" rather than "all" is the practical thing — users searching for
 * ETH exposure want WETH/USDC LPs too, not just wstETH/rETH pairs.
 */
export function hasEthExposure(symbol: string): boolean {
  const tokens = splitPoolSymbol(symbol);
  return tokens.some((t) => isEthToken(t));
}

/**
 * DeFiLlama pool symbols are dash-joined, e.g. "WETH-DIEM" or "USDC-cbETH-WETH".
 * Sometimes they include an LP suffix or numeric tier — best effort split.
 */
export function splitPoolSymbol(symbol: string): string[] {
  if (!symbol) return [];
  return symbol
    .split(/[-\/]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Link to a DexScreener search page for a ticker. Fallback when we don't have
 *  a contract address — search lands the user on a multi-chain disambiguation
 *  page instead of the exact token. */
export function dexScreenerSearchUrl(symbol: string): string {
  return `https://dexscreener.com/search?q=${encodeURIComponent(symbol)}`;
}

/** Link to a specific token page on DexScreener Base using its address. */
export function dexScreenerTokenUrl(address: string): string {
  return `https://dexscreener.com/base/${address.toLowerCase()}`;
}
