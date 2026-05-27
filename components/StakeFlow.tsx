"use client";

import { useState } from "react";
import StakeForm from "@/components/StakeForm";
import SwapToUsdc from "@/components/SwapToUsdc";

/**
 * Wraps the swap-to-USDC and deposit-USDC steps. Collapsed by default — most
 * users coming to a USDC vault already have USDC; the swap is a side door for
 * users who hold ETH/cbBTC/cbETH and want a single-page flow.
 *
 * When a swap confirms we bump `refreshKey` to remount StakeForm so its USDC
 * balance/allowance reads run fresh.
 */
export default function StakeFlow() {
  const [showSwap, setShowSwap] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-4">
      {showSwap ? (
        <SwapToUsdc
          onSuccess={() => setRefreshKey((k) => k + 1)}
          onClose={() => setShowSwap(false)}
        />
      ) : (
        <button
          onClick={() => setShowSwap(true)}
          className="w-full rounded-2xl border border-dashed border-white/10 bg-white/[0.015] px-4 py-3 text-left text-xs text-white/55 transition hover:border-white/[0.18] hover:bg-white/[0.03] hover:text-white/80"
        >
          <span className="font-semibold text-white/80">
            Don&rsquo;t have USDC?
          </span>{" "}
          Swap from ETH, WETH, cbETH or cbBTC → USDC, then deposit. Routed via
          0x.
        </button>
      )}
      <StakeForm key={refreshKey} />
    </div>
  );
}
