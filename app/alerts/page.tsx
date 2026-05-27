import Link from "next/link";
import type { Metadata } from "next";

const BOT_URL = "https://t.me/Basedefi_bot";

export const metadata: Metadata = {
  title: "Telegram alerts — Base Yield Radar",
  description:
    "Wallet-aware DeFi alerts on Base. Link a wallet, get pinged in Telegram only when your actual position is at risk — no spam, no noise.",
  openGraph: {
    title: "Telegram alerts that fire only when YOUR money is at risk",
    description:
      "Wallet-aware DeFi alerts on Base. Link a wallet, sleep, get pinged.",
    images: [
      {
        url: "/api/og?title=Telegram+alerts+that+watch+your+wallet&subtitle=Base+yields%2C+without+the+rugs",
        width: 1200,
        height: 630,
      },
    ],
  },
};

export default function AlertsPage() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-white/[0.06]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-32 mx-auto h-[460px] max-w-4xl opacity-60 blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(91,216,255,0.22), transparent 70%), radial-gradient(closest-side at 70% 30%, rgba(168,85,247,0.18), transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-3xl px-6 py-20 sm:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/70 backdrop-blur">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5bd8ff] opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#5bd8ff]" />
            </span>
            Companion to the yields monitor
          </div>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-6xl">
            A quiet Telegram bot that watches{" "}
            <span className="text-gradient">your wallet</span>.
          </h1>
          <p className="mt-6 max-w-2xl text-base text-white/65 sm:text-lg">
            The monitor is the main tool — you browse, you pick, you stake.
            This bot is the alarm clock on top: link a Base wallet and it pings
            you in Telegram only when a vault <em>you actually hold</em> trips a
            safety check.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/yields"
              className="btn-accent inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
            >
              Browse top yields
              <span aria-hidden>→</span>
            </Link>
            <a
              href={BOT_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-5 py-3 text-sm font-medium text-white/90 transition hover:bg-white/[0.06]"
            >
              Open @Basedefi_bot
              <span className="text-xs opacity-60">↗</span>
            </a>
          </div>
          <p className="mt-4 text-xs text-white/40">
            Non-custodial. No signature required to track. We never touch your
            funds.
          </p>
        </div>
      </section>

      {/* Why */}
      <section className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Why a wallet-aware bot
          </h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Card title="Generic alerts → muted in a week">
              "Pool X just lost 22% TVL." Cool — you don't hold it. After ten
              of those, the bot becomes background noise and you mute it.
            </Card>
            <Card title="On-chain positions move while you sleep">
              A vault can quietly drop TVL, an APY can collapse, an oracle can
              get stale. By the time you check on it next morning, it's gone.
            </Card>
            <Card title="Your wallet is public — use it">
              We don't need your private key. Just paste a Base address and
              we'll scan the receipt tokens of every vault we track every 30
              minutes.
            </Card>
            <Card title="Only ping when it matters">
              An alert fires only when a pool you hold trips a real safety
              heuristic. Tap "🔕 Mute" right in the message if you want to
              ignore a specific one.
            </Card>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="border-b border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-8 space-y-5 text-white/80">
            <Step
              n={1}
              title="Open @Basedefi_bot, send /start"
              body="No login, no signup. Bot remembers you by Telegram ID."
            />
            <Step
              n={2}
              title="/wallet add 0xYourAddress"
              body="Or `/wallet add 0xabc... main` to label it. Watch as many wallets as you want — your own, a friend's, a public whale."
            />
            <Step
              n={3}
              title="That's it. Live your life."
              body="We scan every 30 minutes. When a vault you hold trips a safety heuristic, you get a Telegram message with the affected pool, the size of your exposure, and a one-tap link to act."
            />
          </ol>
        </div>
      </section>

      {/* What we watch */}
      <section className="border-b border-white/[0.06]">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            What we monitor
          </h2>
          <p className="mt-3 max-w-xl text-sm text-white/55">
            v1 covers the biggest single-asset yield positions on Base.
            LP / NFT positions (Uniswap V3, Aerodrome Slipstream) are on the
            roadmap.
          </p>
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            <Pill>Morpho — Steakhouse USDC vault</Pill>
            <Pill>Aave V3 — USDC</Pill>
            <Pill>Spark Savings — USDS</Pill>
            <Pill>Compound V3 — USDC</Pill>
          </ul>
          <p className="mt-6 text-xs text-white/45">
            Triggers: TVL drop ≥20% in 6h · APY spike ≥3× over 24h · APY
            collapse to zero · DeFiLlama "Down" prediction.
          </p>
        </div>
      </section>

      {/* Commands */}
      <section className="border-b border-white/[0.06] bg-white/[0.015]">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Commands
          </h2>
          <div className="mt-6 space-y-3 font-mono text-sm">
            <Cmd cmd="/start" desc="register · show menu" />
            <Cmd cmd="/top" desc="top 10 yields on Base right now" />
            <Cmd cmd="/wallet add 0x… [label]" desc="track a wallet" />
            <Cmd cmd="/wallet list" desc="show tracked wallets" />
            <Cmd cmd="/wallet check 0x…" desc="scan now and reply with positions" />
            <Cmd cmd="/wallet remove 0x…" desc="stop tracking" />
            <Cmd cmd="/alerts on | off" desc="generic safety pings (no wallet needed)" />
            <Cmd cmd="/help" desc="this list, inside the bot" />
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section>
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Pick a vault, <span className="text-gradient">set the alarm.</span>
          </h2>
          <p className="mt-3 text-sm text-white/55">
            The monitor finds the yields. The bot watches them after you click
            stake.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/yields"
              className="btn-accent inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold"
            >
              Browse top yields
              <span aria-hidden>→</span>
            </Link>
            <a
              href={BOT_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.03] px-6 py-3 text-sm font-medium text-white/90 transition hover:bg-white/[0.06]"
            >
              Open @Basedefi_bot
              <span className="text-xs opacity-60">↗</span>
            </a>
          </div>
          <p className="mt-6 text-xs text-white/40">
            Open-source ·{" "}
            <a
              href="https://github.com/malashd1/base-yield-radar"
              target="_blank"
              rel="noreferrer noopener"
              className="underline hover:text-white/60"
            >
              github.com/malashd1/base-yield-radar
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 transition hover:border-white/[0.14] hover:bg-white/[0.04]">
      <div
        aria-hidden
        className="absolute -right-10 -top-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition group-hover:opacity-40"
        style={{ background: "radial-gradient(closest-side, #5bd8ff, transparent)" }}
      />
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/60">{children}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
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
        <div className="text-sm text-white/60">{body}</div>
      </div>
    </li>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <li className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white/80">
      {children}
    </li>
  );
}

function Cmd({ cmd, desc }: { cmd: string; desc: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <code className="text-[#5bd8ff]">{cmd}</code>
      <span className="text-xs text-white/55 sm:text-sm">{desc}</span>
    </div>
  );
}
