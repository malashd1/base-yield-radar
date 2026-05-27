"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function connectorLabel(name: string): string {
  // Friendlier display names for common wallet connectors.
  if (/coinbase/i.test(name)) return "Coinbase Wallet";
  if (/metamask/i.test(name)) return "MetaMask";
  if (/walletconnect/i.test(name)) return "WalletConnect";
  if (/injected/i.test(name)) return "Browser wallet";
  return name;
}

export default function ConnectButton() {
  const { address, isConnected, status: acctStatus } = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  // Close popover on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (acctStatus === "connecting" || acctStatus === "reconnecting") {
    return (
      <button
        disabled
        className="rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-white/40"
      >
        Connecting…
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/90 transition hover:bg-white/[0.08]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]" />
          <span className="font-mono tabular-nums">{shortAddr(address)}</span>
          <svg
            viewBox="0 0 12 12"
            className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M3 4.5L6 7.5L9 4.5" strokeLinecap="round" />
          </svg>
        </button>
        {open && (
          <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-48 overflow-hidden rounded-xl border border-white/10 bg-[#0c0f17]/95 p-1 shadow-2xl backdrop-blur-xl">
            <button
              onClick={() => {
                navigator.clipboard?.writeText(address);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-white/80 transition hover:bg-white/[0.06]"
            >
              Copy address
            </button>
            <button
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-rose-300 transition hover:bg-rose-500/10"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  const single = connectors.length === 1 ? connectors[0] : null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          if (single) connect({ connector: single });
          else setOpen((v) => !v);
        }}
        disabled={status === "pending"}
        className="btn-accent rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
      >
        {status === "pending" ? "Waiting…" : "Connect wallet"}
      </button>
      {open && !single && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-40 w-56 overflow-hidden rounded-xl border border-white/10 bg-[#0c0f17]/95 p-1 shadow-2xl backdrop-blur-xl">
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-white/40">
            Choose wallet
          </div>
          {connectors.map((c) => (
            <button
              key={c.uid}
              onClick={() => {
                connect({ connector: c });
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-white/90 transition hover:bg-white/[0.06]"
            >
              <span>{connectorLabel(c.name)}</span>
              <span className="text-[10px] text-white/30">→</span>
            </button>
          ))}
          {error && (
            <p className="px-3 py-2 text-[11px] text-rose-300">
              {error.message.slice(0, 120)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
