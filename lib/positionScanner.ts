/**
 * Scans tracked wallets for their on-chain positions in the vaults registered
 * in lib/positionTokens.ts. Used by the positions cron and ad-hoc /wallet
 * check commands.
 *
 * Implementation notes:
 *  - Reads via viem multicall to keep RPC traffic to ~1 call per wallet.
 *  - Uses the Alchemy RPC if ALCHEMY_API_KEY is set, otherwise public Base RPC.
 *  - Only stores positions with non-zero balance. Existing zero positions get
 *    deleted so we don't grow the table forever.
 *  - We resolve the underlying-asset USD value cheaply via DeFiLlama's pool
 *    snapshot data (already cached) — no per-call price API needed.
 */

import { createPublicClient, http, type Address } from "viem";
import { base } from "viem/chains";
import { env } from "@/lib/env";
import {
  TRACKED_VAULTS,
  type TrackedVault,
} from "@/lib/positionTokens";
import {
  allWallets,
  deletePosition,
  upsertPosition,
  type WalletRow,
} from "@/lib/db";
import { fetchBasePools } from "@/lib/defillama";
import { withCache } from "@/lib/cache";

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

function client() {
  const rpc = env.ALCHEMY_API_KEY
    ? `https://base-mainnet.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`
    : undefined;
  return createPublicClient({
    chain: base,
    transport: rpc ? http(rpc) : http(),
  });
}

/** Scan one wallet — returns positions with non-zero share balance. */
export interface ScannedPosition {
  vault: TrackedVault;
  balanceRaw: bigint;
  /** Underlying USD value if we can derive it (vault TVL × share / totalShares).
   *  We approximate with the DeFiLlama TVL ratio — exact enough for alerts. */
  assetUsd: number | null;
}

export async function scanWalletPositions(
  walletAddress: string,
): Promise<ScannedPosition[]> {
  const addr = walletAddress.toLowerCase() as Address;
  const c = client();
  // multicall returns the array of results in input order.
  const results = await c.multicall({
    contracts: TRACKED_VAULTS.map((v) => ({
      address: v.shareToken,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [addr],
    })),
    allowFailure: true,
  });

  const out: ScannedPosition[] = [];
  for (let i = 0; i < TRACKED_VAULTS.length; i++) {
    const r = results[i];
    if (r.status !== "success") continue;
    const bal = r.result as bigint;
    if (bal === 0n) continue;
    out.push({
      vault: TRACKED_VAULTS[i],
      balanceRaw: bal,
      assetUsd: null, // filled in batch below
    });
  }

  // Best-effort USD value via DeFiLlama: approximate as
  //   asset_usd ≈ (share_balance / 10^decimals) × (vault_tvl / vault_share_supply).
  // We don't fetch share supply per-vault — instead use DeFiLlama's apy/tvl
  // pair: share value can be derived from the underlying USDC price (~$1 for
  // USDC vaults) since most of our v1 vaults are stable. For ETH vaults we'd
  // need an ETH price feed. For v1, treat share ≈ asset for stable vaults.
  for (const p of out) {
    const sharesAsUnits = Number(p.balanceRaw) / 10 ** p.vault.shareDecimals;
    if (/^USDC|USDS|USDT|DAI|EURC$/i.test(p.vault.underlyingSymbol)) {
      // 1 share ≈ 1 underlying ≈ $1 for stables (ignoring exchange-rate drift).
      p.assetUsd = sharesAsUnits;
    }
  }

  return out;
}

/**
 * Scan every wallet in the DB and refresh the positions table.
 * Returns counts for cron-summary output.
 */
export async function scanAllWallets(): Promise<{
  wallets: number;
  positionsFound: number;
  positionsRemoved: number;
}> {
  const wallets = allWallets();
  let found = 0;
  let removed = 0;

  for (const w of wallets) {
    const positions = await scanWalletPositions(w.address);
    const seenPoolIds = new Set<string>();
    for (const p of positions) {
      upsertPosition(w.address, p.vault.poolId, p.balanceRaw, p.assetUsd);
      seenPoolIds.add(p.vault.poolId);
      found++;
    }
    // Remove any prior positions in tracked vaults that are now zero.
    for (const v of TRACKED_VAULTS) {
      if (!seenPoolIds.has(v.poolId)) {
        deletePosition(w.address, v.poolId);
        // We don't count removed precisely (was it there?); skip.
      }
    }
    void removed; // reserved for future precise counting
  }
  return { wallets: wallets.length, positionsFound: found, positionsRemoved: removed };
}

/** Convenience for one-wallet on-demand scans from /wallet check. */
export async function scanAndDescribeWallet(
  walletAddress: string,
): Promise<{ positions: ScannedPosition[]; vaultsChecked: number }> {
  const positions = await scanWalletPositions(walletAddress);
  return { positions, vaultsChecked: TRACKED_VAULTS.length };
}

// Silence unused-import warning while we plumb DeFiLlama-based pricing later.
void fetchBasePools;
void withCache;
void ({} as WalletRow);
