/**
 * Registry of single-asset yield positions we know how to read onchain.
 *
 * Each entry says: "to check if wallet W has a position in DeFiLlama pool P,
 * read ERC-20 balanceOf(W) on this token address". The token is the receipt
 * a user holds after depositing (vault share, aToken, cToken, sToken, etc.).
 *
 * Why hardcoded? Because each protocol exposes positions differently and we
 * need to be SURE the mapping is correct — a wrong pool_id → token address
 * would tell the user they have a position they don't (or miss real ones).
 *
 * Pool IDs are DeFiLlama UUIDs. Discover new ones with:
 *   curl -s https://yields.llama.fi/pools | jq '.data[] | select(.chain=="Base" and .project=="...")'
 *
 * v1 covers the big single-asset markets. LP/NFT positions (Uniswap V3 NFTs,
 * Aerodrome slipstream NFTs) need per-position enumeration and are deferred.
 */

import type { Address } from "viem";

export interface TrackedVault {
  /** DeFiLlama pool UUID. */
  poolId: string;
  /** Friendly name for messages. */
  name: string;
  /** ERC-20 receipt token the user holds after depositing. */
  shareToken: Address;
  /** Decimals of the share token (used to format balance for display). */
  shareDecimals: number;
  /** Underlying asset symbol — used in messages. */
  underlyingSymbol: string;
  /** Protocol slug — matches DeFiLlama project. */
  project: string;
}

// All addresses checksummed for clarity; positionScanner lowercases them
// before passing to viem (avoids the checksum-mismatch warning on bad input).
export const TRACKED_VAULTS: TrackedVault[] = [
  // Morpho — Steakhouse USDC vault
  {
    poolId: "7820bd3c-461a-4811-9f0b-1d39c1503c3f",
    name: "Steakhouse USDC (Morpho)",
    shareToken: "0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183",
    shareDecimals: 18, // ERC-4626 shares
    underlyingSymbol: "USDC",
    project: "morpho-blue",
  },
  // Aave V3 — USDC on Base (aBasUSDC)
  {
    poolId: "7e0661bf-8cf3-45e6-9424-31916d4c7b84",
    name: "Aave V3 USDC",
    shareToken: "0x4e65fE4DbA92790696d040ac24Aa414708F5c0AB",
    shareDecimals: 6,
    underlyingSymbol: "USDC",
    project: "aave-v3",
  },
  // Spark Savings — USDS (sUSDS)
  {
    poolId: "aa2d08c0-0abd-4dcf-be93-ff8ca89d01cd",
    name: "Spark USDS",
    shareToken: "0x5875eEE11Cf8398102FdAd704C9E96607675467a",
    shareDecimals: 18,
    underlyingSymbol: "USDS",
    project: "spark-savings",
  },
  // Compound V3 — USDC on Base (cUSDCv3)
  {
    poolId: "7993b97d-12c3-4a36-b6b6-5b37bac4f8ae",
    name: "Compound V3 USDC",
    shareToken: "0xb125E6687d4313864e53df431d5425969c15Eb2F",
    shareDecimals: 6,
    underlyingSymbol: "USDC",
    project: "compound-v3",
  },
];

export function findVaultByPoolId(poolId: string): TrackedVault | null {
  return TRACKED_VAULTS.find((v) => v.poolId === poolId) ?? null;
}
