import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        {/* Decorative glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-32 mx-auto h-[480px] max-w-4xl opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(91,216,255,0.25), transparent 70%), radial-gradient(closest-side at 70% 30%, rgba(168,85,247,0.18), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-5xl px-6 py-24 sm:py-32">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/70 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5bd8ff] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#5bd8ff]" />
            </span>
            Base mainnet · live data
          </div>
          <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
            Best yields on Base.
            <br />
            <span className="text-gradient">Without the rugs.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base text-white/60 sm:text-lg">
            Real-time discovery of top APYs across Aerodrome, Morpho, Yearn and
            others on Base. Safety alerts when TVL drops or APY spikes
            suspiciously. One-click stake when you find one you trust.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/yields"
              className="btn-accent inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
            >
              Browse top yields
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/alerts"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/90 transition hover:bg-white/[0.06]"
            >
              Wallet-aware alerts
              <span className="text-xs opacity-60">→</span>
            </Link>
          </div>
          <p className="mt-4 text-xs text-white/40">
            Non-custodial. We never touch your funds.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="grid gap-4 sm:grid-cols-3">
          <Feature
            title="Curated yields"
            body="Top 30 pools sorted by APY with TVL, stable-only and APY-cap filters out of the box. Sourced from DeFiLlama."
          />
          <Feature
            title="Safety alerts"
            body="Watch your favorite protocols. Get pinged when TVL drops more than X% in a short window or when APY spikes look pre-rug."
          />
          <Feature
            title="One-click stake"
            body="Connect your Base wallet, pick a vault, deposit USDC. Routed via 0x for best price. You sign every transaction."
          />
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            How it works
          </h2>
          <ol className="mt-8 space-y-5 text-white/80">
            <Step
              n={1}
              title="Discover"
              body="Browse the top yields page or ask the TG bot for the current top 10."
            />
            <Step
              n={2}
              title="Watch"
              body="Subscribe to a protocol or pool. We snapshot TVL/APY every few minutes and alert on suspicious changes."
            />
            <Step
              n={3}
              title="Stake (optional)"
              body="When you decide, deposit straight from the app. We never custody — your wallet, your keys, your signature."
            />
          </ol>
        </div>
      </section>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 transition hover:border-white/[0.14] hover:bg-white/[0.04]">
      <div
        aria-hidden
        className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition group-hover:opacity-40"
        style={{ background: "radial-gradient(closest-side, #5bd8ff, transparent)" }}
      />
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{body}</p>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-4">
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#061018]"
        style={{
          background: "linear-gradient(180deg, #5bd8ff 0%, #38bdf8 100%)",
        }}
      >
        {n}
      </span>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-sm text-white/55">{body}</div>
      </div>
    </li>
  );
}
