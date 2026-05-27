"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useSendTransaction,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { ERC20_ABI, USDC_BASE } from "@/lib/morpho";
import { BASE_TOKENS, NATIVE_TOKEN_SENTINEL, type ZeroExQuote } from "@/lib/zeroex";
import ConnectButton from "@/components/ConnectButton";
import type { Address, Hex } from "viem";

/**
 * Swap any supported Base token → USDC via the 0x AllowanceHolder endpoint.
 * On success the user holds USDC in their wallet and can proceed to the
 * existing vault-deposit flow on the same page.
 *
 * Affiliate fee: the 0x quote URL is built server-side in /api/quote and
 * already includes swapFeeRecipient/swapFeeBps when AFFILIATE_FEE_RECIPIENT is
 * configured — fee is taken out of the USDC the user receives, no extra tx.
 *
 * Flow:
 *   1. User picks sell token + enters amount
 *   2. We fetch a quote (debounced) — display "you receive ~X USDC"
 *   3. For ERC-20: if allowance < amount, prompt approve to allowanceTarget
 *   4. Send the swap tx (calldata + value from quote)
 *   5. onSuccess fires — parent refreshes USDC balance
 */

interface SellToken {
  symbol: "ETH" | "WETH" | "cbETH" | "cbBTC";
  address: Address;
  decimals: number;
  /** True if this is the native asset (no approve, value sent with tx). */
  native: boolean;
}

const SELL_TOKENS: SellToken[] = [
  { symbol: "ETH", address: NATIVE_TOKEN_SENTINEL as Address, decimals: 18, native: true },
  { symbol: "WETH", address: BASE_TOKENS.WETH as Address, decimals: 18, native: false },
  { symbol: "cbETH", address: BASE_TOKENS.cbETH as Address, decimals: 18, native: false },
  { symbol: "cbBTC", address: BASE_TOKENS.cbBTC as Address, decimals: 8, native: false },
];

function parseAmount(input: string, decimals: number): bigint | null {
  if (!/^\d+(\.\d+)?$/.test(input)) return null;
  const [whole, frac = ""] = input.split(".");
  const truncated = (frac + "0".repeat(decimals)).slice(0, decimals);
  try {
    return BigInt(whole) * 10n ** BigInt(decimals) + BigInt(truncated || "0");
  } catch {
    return null;
  }
}

function formatAmount(v: bigint, decimals: number, maxFrac = 6): string {
  if (v === 0n) return "0";
  const s = v.toString().padStart(decimals + 1, "0");
  const whole = s.slice(0, -decimals);
  let frac = s.slice(-decimals).replace(/0+$/, "");
  if (frac.length > maxFrac) frac = frac.slice(0, maxFrac);
  return frac ? `${whole}.${frac}` : whole;
}

export default function SwapToUsdc({
  onSuccess,
  onClose,
}: {
  onSuccess?: () => void;
  onClose?: () => void;
}) {
  const { address, isConnected, chainId } = useAccount();
  const [sellIdx, setSellIdx] = useState(0);
  const [input, setInput] = useState("");
  const sell = SELL_TOKENS[sellIdx];

  const sellAmount = useMemo(
    () => parseAmount(input, sell.decimals),
    [input, sell.decimals],
  );

  // Balances — native ETH via useBalance, ERC-20 via useReadContract.
  const ethBalance = useBalance({
    address,
    query: { enabled: !!address && sell.native },
  });
  const ercBalance = useReadContract({
    abi: ERC20_ABI,
    address: sell.address,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && !sell.native },
  });
  const balance = sell.native
    ? ((ethBalance.data?.value as bigint | undefined) ?? 0n)
    : ((ercBalance.data as bigint | undefined) ?? 0n);

  // Quote — debounced fetch.
  const [quote, setQuote] = useState<ZeroExQuote | null>(null);
  const [quoteErr, setQuoteErr] = useState<string | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);

  useEffect(() => {
    if (!address || sellAmount == null || sellAmount <= 0n) {
      setQuote(null);
      setQuoteErr(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setQuoteLoading(true);
      setQuoteErr(null);
      try {
        const url = new URL("/api/quote", window.location.origin);
        url.searchParams.set("sellToken", sell.address);
        url.searchParams.set("buyToken", USDC_BASE);
        url.searchParams.set("sellAmount", sellAmount.toString());
        url.searchParams.set("taker", address);
        const res = await fetch(url, { signal: ctrl.signal });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? `quote failed (${res.status})`);
        setQuote(json as ZeroExQuote);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setQuote(null);
        setQuoteErr((e as Error).message);
      } finally {
        setQuoteLoading(false);
      }
    }, 350);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [address, sell.address, sellAmount]);

  // Allowance check (ERC-20 only). Refetched after approve confirms.
  const allowanceQuery = useReadContract({
    abi: ERC20_ABI,
    address: sell.address,
    functionName: "allowance",
    args:
      address && quote && !sell.native
        ? [address, quote.allowanceTarget as Address]
        : undefined,
    query: { enabled: !!(address && quote && !sell.native) },
  });
  const allowance = (allowanceQuery.data as bigint | undefined) ?? 0n;
  const needsApproval =
    !sell.native &&
    quote != null &&
    sellAmount != null &&
    allowance < sellAmount;

  // Two write paths — approve uses useWriteContract, swap uses useSendTransaction.
  const approveWrite = useWriteContract();
  const swapSend = useSendTransaction();
  const [phase, setPhase] = useState<"idle" | "approving" | "swapping" | "done">(
    "idle",
  );
  const activeHash =
    phase === "approving"
      ? approveWrite.data
      : phase === "swapping"
        ? swapSend.data
        : undefined;
  const receipt = useWaitForTransactionReceipt({
    hash: (activeHash as Hex | undefined) ?? undefined,
    query: { enabled: !!activeHash },
  });

  useEffect(() => {
    if (!receipt.data) return;
    if (phase === "approving") {
      allowanceQuery.refetch?.();
      setPhase("idle");
    } else if (phase === "swapping") {
      setPhase("done");
      // Tell parent so the USDC balance / deposit form refreshes.
      onSuccess?.();
      if (sell.native) ethBalance.refetch?.();
      else ercBalance.refetch?.();
    }
  }, [receipt.data]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleApprove() {
    if (!quote || sellAmount == null) return;
    approveWrite.reset();
    setPhase("approving");
    approveWrite.writeContract({
      abi: ERC20_ABI,
      address: sell.address,
      functionName: "approve",
      args: [quote.allowanceTarget as Address, sellAmount],
    });
  }

  function handleSwap() {
    if (!quote) return;
    swapSend.reset();
    setPhase("swapping");
    swapSend.sendTransaction({
      to: quote.to as Address,
      data: quote.data as Hex,
      value: BigInt(quote.value || "0"),
    });
  }

  function handleMax() {
    setInput(formatAmount(balance, sell.decimals));
  }

  // ---------- render ----------

  if (!isConnected) {
    return (
      <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
        <div className="text-sm font-semibold text-white">
          Swap any token → USDC
        </div>
        <p className="text-xs text-white/55">
          Connect your wallet to swap ETH, WETH, cbETH or cbBTC into USDC via 0x.
        </p>
        <ConnectButton />
      </div>
    );
  }

  const wrongChain = chainId !== undefined && chainId !== 8453;
  if (wrongChain) {
    return (
      <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-5 text-sm text-amber-200">
        Switch your wallet to Base mainnet (chainId 8453) to swap.
      </div>
    );
  }

  const insufficient =
    sellAmount != null && sellAmount > balance;
  const isStub = quote?.source === "stub";

  return (
    <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">
            Swap any token → USDC
          </div>
          <div className="text-xs text-white/50">
            Routed via 0x · 0.25% affiliate fee from output
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-full px-2 py-0.5 text-xs text-white/40 transition hover:bg-white/[0.06] hover:text-white/80"
            title="Hide swap"
          >
            ×
          </button>
        )}
      </div>

      {/* Sell token picker */}
      <div className="flex gap-1 overflow-x-auto rounded-full border border-white/10 bg-black/20 p-0.5">
        {SELL_TOKENS.map((t, i) => (
          <button
            key={t.symbol}
            onClick={() => {
              setSellIdx(i);
              setInput("");
              setQuote(null);
              setPhase("idle");
            }}
            className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              sellIdx === i
                ? "bg-[#5bd8ff]/15 text-[#5bd8ff]"
                : "text-white/60 hover:bg-white/[0.04]"
            }`}
          >
            {t.symbol}
          </button>
        ))}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-white/50">
          <span>{sell.symbol} balance</span>
          <span className="font-mono text-white/80">
            {formatAmount(balance, sell.decimals)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.0"
            value={input}
            onChange={(e) => setInput(e.target.value.trim())}
            className="flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-2 font-mono text-sm focus:border-[#5bd8ff]/50 focus:outline-none"
          />
          <button
            onClick={handleMax}
            className="rounded-md border border-white/10 px-3 py-2 text-xs text-white/70 transition hover:bg-white/5"
          >
            MAX
          </button>
        </div>
      </div>

      {/* Quote display */}
      {sellAmount != null && sellAmount > 0n && (
        <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3 text-xs">
          {quoteLoading && <div className="text-white/50">Fetching quote…</div>}
          {quoteErr && (
            <div className="text-rose-300">Quote error: {quoteErr.slice(0, 140)}</div>
          )}
          {quote && !quoteErr && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-white/50">You receive</span>
                <span className="font-mono tabular-nums text-white/90">
                  {formatAmount(BigInt(quote.buyAmount), 6)} USDC
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-white/40">Min after slippage</span>
                <span className="font-mono tabular-nums text-white/60">
                  {formatAmount(BigInt(quote.minBuyAmount), 6)} USDC
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-white/40">
                <span>Affiliate fee taken from output</span>
                <span>0.25%</span>
              </div>
              {isStub && (
                <div className="mt-1 rounded bg-amber-400/10 px-2 py-1 text-[10px] text-amber-300">
                  Stub quote — ZEROEX_API_KEY not configured
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {insufficient && (
        <p className="text-xs text-rose-300">
          Amount exceeds balance ({formatAmount(balance, sell.decimals)}{" "}
          {sell.symbol}).
        </p>
      )}

      {phase === "done" ? (
        <div className="rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3 text-xs text-emerald-200">
          Swap confirmed. USDC balance below should refresh — proceed to deposit.{" "}
          {activeHash && (
            <a
              href={`https://basescan.org/tx/${activeHash}`}
              target="_blank"
              rel="noreferrer noopener"
              className="underline"
            >
              tx ↗
            </a>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          {!sell.native && (
            <button
              onClick={handleApprove}
              disabled={
                !needsApproval ||
                !quote ||
                insufficient ||
                phase === "approving" ||
                receipt.isLoading
              }
              className="flex-1 rounded-md border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-30"
            >
              {phase === "approving"
                ? receipt.isLoading
                  ? "Confirming…"
                  : "Approving…"
                : needsApproval
                  ? "1. Approve"
                  : "✓ Approved"}
            </button>
          )}
          <button
            onClick={handleSwap}
            disabled={
              !quote ||
              insufficient ||
              needsApproval ||
              phase === "swapping" ||
              receipt.isLoading
            }
            className="btn-accent flex-1 rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === "swapping"
              ? receipt.isLoading
                ? "Confirming…"
                : "Swapping…"
              : sell.native
                ? "Swap to USDC"
                : "2. Swap to USDC"}
          </button>
        </div>
      )}

      {(approveWrite.error || swapSend.error) && (
        <p className="text-xs text-rose-300">
          {(approveWrite.error?.message || swapSend.error?.message || "").slice(
            0,
            220,
          )}
        </p>
      )}
    </div>
  );
}
