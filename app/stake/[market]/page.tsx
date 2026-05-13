import Link from "next/link";
import { notFound } from "next/navigation";
import StakeForm from "@/components/StakeForm";
import { MORPHO_USDC_VAULT_META } from "@/lib/morpho";

export const dynamic = "force-static"; // page is fully derived from constants

const MARKETS = {
  [MORPHO_USDC_VAULT_META.slug]: MORPHO_USDC_VAULT_META,
} as const;

export function generateStaticParams() {
  return Object.keys(MARKETS).map((market) => ({ market }));
}

export default async function StakePage({
  params,
}: {
  params: Promise<{ market: string }>;
}) {
  const { market } = await params;
  const meta = MARKETS[market as keyof typeof MARKETS];
  if (!meta) notFound();

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-xl px-6 py-12">
        <Link
          href="/yields"
          className="text-xs text-white/50 hover:text-white/80"
        >
          ← All yields
        </Link>

        <header className="mt-2 border-b border-white/10 pb-6">
          <div className="text-xs uppercase tracking-wide text-white/40">
            Stake — {meta.chain}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {meta.name}
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Curated by {meta.curator} · ERC-4626 vault on Morpho · deposits in{" "}
            {meta.asset}
          </p>
        </header>

        <div className="mt-6">
          <StakeForm />
        </div>

        <p className="mt-6 text-xs text-white/40">
          DeFi carries risk including total loss. Verify the vault contract
          before depositing.{" "}
          <a
            href={meta.url}
            target="_blank"
            rel="noreferrer noopener"
            className="underline hover:text-white/60"
          >
            Open on app.morpho.org ↗
          </a>
        </p>
      </div>
    </main>
  );
}
