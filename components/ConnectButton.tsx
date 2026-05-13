"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export default function ConnectButton() {
  const { address, isConnected, status: acctStatus } = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();

  // Hydration-safe loading.
  if (acctStatus === "connecting" || acctStatus === "reconnecting") {
    return (
      <button
        disabled
        className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/40"
      >
        Connecting…
      </button>
    );
  }

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2 py-1 font-mono text-xs text-emerald-200">
          {shortAddr(address)}
        </span>
        <button
          onClick={() => disconnect()}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs text-white/70 transition hover:bg-white/5"
        >
          Disconnect
        </button>
      </div>
    );
  }

  // Not connected — show one button per connector.
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        {connectors.map((c) => (
          <button
            key={c.uid}
            onClick={() => connect({ connector: c })}
            disabled={status === "pending"}
            className="rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-400 disabled:opacity-50"
          >
            {status === "pending"
              ? "Waiting…"
              : `Connect ${c.name}`}
          </button>
        ))}
      </div>
      {error && (
        <p className="text-xs text-rose-300">{error.message.slice(0, 120)}</p>
      )}
    </div>
  );
}
