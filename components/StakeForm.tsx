"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import {
  ERC20_ABI,
  MORPHO_USDC_VAULT,
  USDC_BASE,
  VAULT_ABI,
  buildApproveTx,
  buildDepositTx,
  MORPHO_USDC_VAULT_META,
} from "@/lib/morpho";
import ConnectButton from "@/components/ConnectButton";
import type { Hex } from "viem";

/**
 * Two-step stake flow for the Steakhouse USDC vault on Base:
 *   1. If allowance < amount  → call USDC.approve(vault, amount)
 *   2. Once allowance ≥ amount → call vault.deposit(amount, receiver=user)
 *
 * Both steps are signed by the user's wallet — we construct calldata via
 * lib/morpho and dispatch with wagmi's useWriteContract.
 *
 * Non-custodial: amounts and receivers are bound at click time; no funds ever
 * sit in our app.
 */

const USDC_DECIMALS = 6;

function parseUsdc(input: string): bigint | null {
  // Accept "0.5", "10", "10.123456" — silently truncate beyond 6 decimals.
  if (!/^\d+(\.\d{1,9})?$/.test(input)) return null;
  const [whole, frac = ""] = input.split(".");
  const padded = (frac + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
  try {
    return BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(padded || "0");
  } catch {
    return null;
  }
}

function formatUsdc(v: bigint): string {
  const s = v.toString().padStart(USDC_DECIMALS + 1, "0");
  const whole = s.slice(0, -USDC_DECIMALS);
  const frac = s.slice(-USDC_DECIMALS).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

export default function StakeForm() {
  const { address, isConnected, chainId } = useAccount();
  const [input, setInput] = useState<string>("");
  const amount = useMemo(() => parseUsdc(input), [input]);

  // Read USDC balance + current allowance.
  const balanceQuery = useReadContract({
    abi: ERC20_ABI,
    address: USDC_BASE,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  const allowanceQuery = useReadContract({
    abi: ERC20_ABI,
    address: USDC_BASE,
    functionName: "allowance",
    args: address ? [address, MORPHO_USDC_VAULT] : undefined,
    query: { enabled: !!address },
  });

  const balance = (balanceQuery.data as bigint | undefined) ?? 0n;
  const allowance = (allowanceQuery.data as bigint | undefined) ?? 0n;
  const needsApproval =
    amount !== null && amount > 0n && allowance < amount;

  // Single writeContract instance — covers both approve and deposit phases.
  // We track which one is in flight via a local `phase` state.
  const { writeContract, data: txHash, isPending, error, reset } =
    useWriteContract();
  const [phase, setPhase] = useState<"idle" | "approving" | "depositing" | "done">(
    "idle",
  );

  const receipt = useWaitForTransactionReceipt({
    hash: (txHash as Hex | undefined) ?? undefined,
    query: { enabled: !!txHash },
  });

  // Phase transitions on receipt confirmations.
  useEffect(() => {
    if (!receipt.data) return;
    if (phase === "approving") {
      // Refresh allowance — wagmi v2 caches; nudge it.
      allowanceQuery.refetch?.();
      setPhase("idle"); // user clicks Deposit again
    } else if (phase === "depositing") {
      setPhase("done");
      balanceQuery.refetch?.();
    }
  }, [receipt.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const wrongChain = isConnected && chainId !== undefined && chainId !== 8453;

  function handleMax() {
    setInput(formatUsdc(balance));
  }

  function handleApprove() {
    if (amount == null || amount <= 0n) return;
    reset();
    setPhase("approving");
    const tx = buildApproveTx(amount);
    writeContract({
      abi: ERC20_ABI,
      address: tx.to,
      functionName: "approve",
      args: [MORPHO_USDC_VAULT, amount],
    });
  }

  function handleDeposit() {
    if (amount == null || amount <= 0n || !address) return;
    reset();
    setPhase("depositing");
    const tx = buildDepositTx(amount, address);
    writeContract({
      abi: VAULT_ABI,
      address: tx.to,
      functionName: "deposit",
      args: [amount, address],
    });
  }

  // ---------- render ----------

  if (!isConnected) {
    return (
      <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-6">
        <p className="text-sm text-white/70">
          Connect your wallet to deposit USDC into the {MORPHO_USDC_VAULT_META.name}{" "}
          vault.
        </p>
        <ConnectButton />
      </div>
    );
  }

  if (wrongChain) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-6 text-sm text-amber-200">
        Switch your wallet to Base mainnet (chainId 8453) to continue.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-6">
      <div className="flex items-center justify-between text-xs text-white/50">
        <span>USDC balance</span>
        <span className="font-mono text-white/80">
          {balanceQuery.isLoading ? "…" : formatUsdc(balance)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.0"
          value={input}
          onChange={(e) => setInput(e.target.value.trim())}
          className="flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm focus:border-blue-400 focus:outline-none"
        />
        <button
          onClick={handleMax}
          className="rounded-md border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/5"
        >
          MAX
        </button>
      </div>

      {amount !== null && amount > balance && (
        <p className="text-xs text-rose-300">
          Amount exceeds balance ({formatUsdc(balance)} USDC).
        </p>
      )}

      {phase === "done" ? (
        <div className="rounded-md border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">
          Deposit confirmed onchain.{" "}
          {txHash && (
            <a
              href={`https://basescan.org/tx/${txHash}`}
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              View on Basescan ↗
            </a>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={handleApprove}
            disabled={
              !needsApproval ||
              isPending ||
              receipt.isLoading ||
              amount === null ||
              amount <= 0n ||
              amount > balance
            }
            className="flex-1 rounded-md bg-white/10 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {phase === "approving"
              ? receipt.isLoading
                ? "Confirming…"
                : "Approving…"
              : needsApproval
                ? "1. Approve USDC"
                : "✓ Approved"}
          </button>
          <button
            onClick={handleDeposit}
            disabled={
              needsApproval ||
              isPending ||
              receipt.isLoading ||
              amount === null ||
              amount <= 0n ||
              amount > balance
            }
            className="flex-1 rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {phase === "depositing"
              ? receipt.isLoading
                ? "Confirming…"
                : "Depositing…"
              : "2. Deposit"}
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-rose-300">
          {error.message.slice(0, 200)}
        </p>
      )}

      <p className="text-[11px] leading-snug text-white/40">
        You sign every transaction. We never custody your funds. Vault contract:{" "}
        <a
          href={MORPHO_USDC_VAULT_META.url}
          target="_blank"
          rel="noreferrer noopener"
          className="font-mono underline hover:text-white/60"
        >
          {MORPHO_USDC_VAULT.slice(0, 8)}…{MORPHO_USDC_VAULT.slice(-4)}
        </a>
      </p>
    </div>
  );
}
