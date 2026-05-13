/**
 * Morpho vault integration — ONE vault for v1 (Steakhouse USDC on Base).
 *
 * Morpho vaults are ERC-4626. We expose tx-builders for the two onchain
 * actions a stake-flow needs:
 *   - approve USDC spending against the vault (spender = vault address)
 *   - deposit USDC → receive vault shares
 *
 * IMPORTANT: addresses below are mainnet. Treat as constants and verify
 * against https://app.morpho.org before any real funds are used. The vault
 * address is intentionally kept in code (not env) so a single source review
 * surface — never let an env var redirect deposits.
 */

import { encodeFunctionData, type Address, type Hex } from "viem";
import { BASE_TOKENS } from "@/lib/zeroex";

/**
 * Steakhouse USDC vault on Base (curator: Steakhouse Financial).
 * Source: https://app.morpho.org/base/vault/0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183/steakhouse-usdc
 *
 * If you want to support another vault, add it here as a separate const and
 * surface it via a registry. Do NOT make this configurable from outside the file.
 */
export const MORPHO_USDC_VAULT: Address =
  "0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183";

export const USDC_BASE: Address = BASE_TOKENS.USDC as Address;

/** Minimal ABI subset we actually call. */
export const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

/** ERC-4626 vault subset. */
export const VAULT_ABI = [
  {
    type: "function",
    name: "deposit",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ name: "shares", type: "uint256" }],
  },
  {
    type: "function",
    name: "asset",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "totalAssets",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "convertToAssets",
    stateMutability: "view",
    inputs: [{ name: "shares", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export interface PreparedTx {
  to: Address;
  data: Hex;
  value: bigint;
}

/**
 * Build the calldata for `USDC.approve(MORPHO_USDC_VAULT, amount)`.
 * Caller wallet sends this from its own address.
 */
export function buildApproveTx(amount: bigint): PreparedTx {
  return {
    to: USDC_BASE,
    data: encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [MORPHO_USDC_VAULT, amount],
    }),
    value: 0n,
  };
}

/**
 * Build the calldata for `vault.deposit(amount, receiver)`.
 * Returns a tx ready to be passed to `walletClient.sendTransaction`.
 */
export function buildDepositTx(
  amount: bigint,
  receiver: Address,
): PreparedTx {
  if (amount <= 0n) throw new Error("amount must be > 0");
  if (!/^0x[0-9a-fA-F]{40}$/.test(receiver)) {
    throw new Error("receiver must be a 0x-prefixed 20-byte address");
  }
  return {
    to: MORPHO_USDC_VAULT,
    data: encodeFunctionData({
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [amount, receiver],
    }),
    value: 0n,
  };
}

/** Display-friendly metadata. */
export const MORPHO_USDC_VAULT_META = {
  slug: "morpho-usdc",
  name: "Steakhouse USDC",
  curator: "Steakhouse Financial",
  asset: "USDC",
  assetAddress: USDC_BASE,
  vaultAddress: MORPHO_USDC_VAULT,
  chain: "base",
  url: `https://app.morpho.org/base/vault/${MORPHO_USDC_VAULT}/steakhouse-usdc`,
  decimals: 6,
} as const;
