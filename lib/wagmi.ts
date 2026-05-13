/**
 * Wagmi config — Base mainnet only, browser wallets only (non-custodial).
 *
 * Connectors:
 *   - coinbaseWallet → Coinbase Wallet / Smart Wallet (best UX on Base)
 *   - injected       → MetaMask / Rabby / etc.
 *
 * WalletConnect deliberately omitted in v1 — it requires a projectId from
 * https://cloud.walletconnect.com (paid above free tier) and we don't yet
 * have that env var. Drop it in when WC_PROJECT_ID is available.
 */

import { http, createConfig } from "wagmi";
import { base } from "wagmi/chains";
import { coinbaseWallet, injected } from "wagmi/connectors";
import { env } from "@/lib/env";

const ALCHEMY_RPC = env.ALCHEMY_API_KEY
  ? `https://base-mainnet.g.alchemy.com/v2/${env.ALCHEMY_API_KEY}`
  : undefined;

export const wagmiConfig = createConfig({
  chains: [base],
  connectors: [
    coinbaseWallet({
      appName: "Base Yield Radar",
      preference: "smartWalletOnly", // prefer smart wallet flow on Base
    }),
    injected({ shimDisconnect: true }),
  ],
  transports: {
    [base.id]: ALCHEMY_RPC ? http(ALCHEMY_RPC) : http(),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
