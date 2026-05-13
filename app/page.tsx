import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="border-b border-white/10 bg-gradient-to-b from-blue-950/40 to-transparent">
        <div className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-300">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            Base mainnet · live data
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-6xl">
            Best yields on Base.
            <br />
            <span className="text-blue-400">Without the rugs.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base text-white/70 sm:text-lg">
            Real-time discovery of top APYs across Aerodrome, Morpho, Yearn and
            others on Base. Safety alerts when TVL drops or APY spikes
            suspiciously. One-click stake when you find one you trust.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/yields"
              className="rounded-lg bg-blue-500 px-5 py-3 text-sm font-medium text-white shadow-sm transition hover:bg-blue-400"
            >
              Browse top yields →
            </Link>
            <a
              href="https://t.me/"
              target="_blank"
              rel="noreferrer noopener"
              className="rounded-lg border border-white/15 px-5 py-3 text-sm font-medium text-white/90 transition hover:bg-white/5"
            >
              Get the Telegram bot
            </a>
          </div>
          <p className="mt-3 text-xs text-white/40">
            Non-custodial. We never touch your funds.
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="grid gap-6 sm:grid-cols-3">
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
      <section className="border-t border-white/10 bg-white/[0.02]">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="mt-6 space-y-4 text-white/80">
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

      <footer className="border-t border-white/10 px-6 py-8 text-xs text-white/40">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <span>Base Yield Radar · data via DeFiLlama · routing via 0x</span>
          <span>
            Not financial advice. DeFi carries risk including total loss.
          </span>
        </div>
      </footer>
    </main>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-white/60">{body}</p>
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
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-xs font-semibold text-blue-300">
        {n}
      </span>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-sm text-white/60">{body}</div>
      </div>
    </li>
  );
}
