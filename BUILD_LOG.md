# Base Yield Radar — Build Log (loop state file)

> This is the source of truth for what's done, what's next, and what's blocked.
> Loop iteration reads this, picks the next `[ ]` task, executes it, runs its test, marks `[x]`.
> If hit external rate limit → ScheduleWakeup 1500-1800s.
> If task needs missing credential → mark `[BLOCKED]` with what's needed, move to next.
> When all tasks are `[x]` or `[BLOCKED]` → write `STATUS: COMPLETE` at top and stop loop.

---

STATUS: IN_PROGRESS
LAST_TICK: 2026-05-14 00:33 — tick 17: /start handler (welcome + upsertUser); fixed dry-run init by injecting fake botInfo into Bot ctor (grammy refuses handleUpdate w/o it); test passes end-to-end. Chunk commit 4.4/5.1/5.2.

## Product

TG bot + web app for Base yield discovery + safety alerts + 1-click stake.

- Yields data: DeFiLlama Pools API (free, no key) — https://yields.llama.fi/pools
- TVL data: DeFiLlama TVL API (free, no key)
- Swap routing: 0x Swap API (free key) with affiliate fee
- One-protocol stake v1: Morpho USDC supply
- TG framework: grammy
- Storage: better-sqlite3 (file at ./data/radar.db)
- Stack: Next.js 15 App Router + TS + Tailwind, viem/wagmi for chain

## Workflow rules (loop must follow)

1. CWD must be `/Users/malashd/Documents/base-yield-radar`. Always use absolute paths.
2. Each task is atomic. Complete fully or revert before marking done.
3. After each task: run its `Test:` command. If it fails — fix before marking `[x]`. If can't fix in 2 attempts, mark `[NEEDS_HUMAN]` with explanation.
4. Update `LAST_TICK:` field on every iteration with timestamp + 1-line summary.
5. Never edit `~/Documents/auto_invoice` or `~/Documents/builder-card` (different projects).
6. Don't add features not in this log. If you spot something useful, append it under `## Backlog (not in scope)`.
7. After every 3 completed tasks: `git add -A && git commit -m "chunk: <last task ids>"`.
8. If external API returns 429 / rate-limit text: ScheduleWakeup with delaySeconds=1700, reason="rate-limited by <api>, waiting". This pause is **only** for the rate-limited task — on next tick, continue with other tasks first.
9. **BLOCKED handling — never let this stop progress:**
   - If a task requires an env var not in `.env.local`, OR depends on something only a human can do (Vercel login, domain purchase, etc.) → mark `[BLOCKED: <reason>]` and **immediately pick the next actionable task within the SAME tick**. Do not ScheduleWakeup yet.
   - Keep skipping BLOCKED tasks within a tick until you find one you CAN complete. Only schedule the next tick after you've actually done productive work (or proven there's none left).
   - On every new tick, re-scan `.env.local` and unblock any tasks whose dependencies are now satisfied.
   - A BLOCKED task is never a stop condition — it's just "skip for now".
10. ScheduleWakeup cadence between normal ticks: 90-180s.
11. **Stop condition (only ONE):** every remaining `[ ]` task is either `[x]`, `[BLOCKED]`, or `[NEEDS_HUMAN]`. Then set `STATUS: COMPLETE` at top, write final summary in `## Done` section, do NOT ScheduleWakeup.
12. If you find yourself with nothing actionable but BLOCKED tasks remain → that IS complete for now. Mark COMPLETE and stop. Do not loop forever waiting for human.

---

## Phase 0 — Bootstrap (mostly pre-done by setup)

- [x] 0.1 Init Next.js project with TS, Tailwind, App Router
- [x] 0.2 Install deps: grammy, viem, wagmi, @tanstack/react-query, better-sqlite3, zod, swr, recharts
- [x] 0.3 Create folder structure: lib/, app/, bot/, scripts/, data/, components/
- [x] 0.4 Add .env.example
- [x] 0.5 Add data/.gitkeep, ensure data/*.db is in .gitignore — verified during setup
- [x] 0.6 Create lib/env.ts that reads + validates env via zod (every required key has fallback or marks degraded mode) — tick 1, tsc passes
- [x] 0.7 First commit — multiple commits exist, verified via git log

## Phase 1 — DeFiLlama integration (no key needed)

- [x] 1.1 lib/defillama.ts: typed fetcher for /pools, filter chain="Base" — tick 2, returned 3133 pools
- [x] 1.2 lib/defillama.ts: add fetchPoolHistory(poolId) using /chart/{poolId} — tick 2, returned 223 points for top pool
  - Note: smoke test at scripts/_test-defillama.ts (kept for reuse).
- [x] 1.3 lib/cache.ts: simple FS-backed cache with TTL (default 1h) — tick 3, smoke-test passes (hit/miss/expire/clear)
- [x] 1.4 app/api/yields/route.ts: GET → top 30 yields filtered by minTvl, sorted by APY — tick 4, supports `?minTvl=&limit=&stableOnly=&maxApy=`, cached 1h via FS cache
- [x] 1.5 app/api/yields/[poolId]/route.ts: GET pool detail + 30d history — tick 5, verified live (yearn USDC: APY 154%, 331 history points)

## Phase 2 — Web UI

- [x] 2.1 app/page.tsx: landing — hero+CTAs+features+how-it-works+footer; dark theme; tsc clean — tick 6
- [x] 2.2 app/yields/page.tsx: server component — table of top 30 yields — tick 7, live curl returned 200 with aerodrome/uniswap names; lib/format.ts added (fmtUsd, fmtApy, risk colors)
- [x] 2.3 components/YieldTable.tsx: sortable cols (project/symbol/TVL/APY) + filters (TVL presets, stable, audited) — tick 8, "audited" backed by hardcoded set in lib/protocols.ts (aerodrome, morpho, yearn, aave, compound, …)
- [x] 2.4 components/Sparkline.tsx: 30d APY trend (recharts AreaChart with gradient fill, optional tooltip, graceful "not enough data" fallback) — tick 9, tsc clean
- [x] 2.5 app/protocols/[slug]/page.tsx: header (audited badge, total TVL, pool count) + Sparkline of top pool APY + table of all pools — tick 10, /protocols/morpho-blue → 200, /protocols/this-does-not-exist → 404
- [x] 2.6 components/Header.tsx + Footer.tsx — tick 11; mounted in layout.tsx; npm run build clean (15.2s compile, 17.1s tsc, 5 routes); /yields HTML containing protocol names verified in ticks 7-8

## Phase 3 — Storage (subscriptions, snapshots, alerts)

- [x] 3.1 lib/db.ts: better-sqlite3 wrapper, schema on import — tick 12. WAL mode, FK on, 4 tables (users, subscriptions, snapshots, alerts) + indexes; helpers upsertUser/addSubscription/recordSnapshot/recordAlert; globalThis caching to survive Next dev hot-reload. Smoke at scripts/_test-db.ts.

## Phase 4 — Safety monitor

- [x] 4.1 scripts/snapshot.ts: top-50 Base pools by TVL → snapshots table — tick 13. CLI + reusable runSnapshot() for cron import. First run: 50 distinct pools recorded; top by TVL: morpho-blue cbBTC $2.4B, STEAKUSDC $467M.
- [x] 4.2 lib/safety.ts: detectTvlDrops(windowHours=6, minDropPct=20) — tick 14, fixture (1M → 700k) → exactly 30% drop alert
- [x] 4.3 lib/safety.ts: detectApySpikes(windowHours=24, spikeMultiplier=3) — tick 14, fixture (baseline 4%, latest 16%) → 4x multiplier alert
- [x] 4.4 app/api/cron/safety/route.ts: cron endpoint, GET ?windowHours=&minDropPct=&apyWindowHours=&spikeMultiplier=&limit= — tick 15. Pipeline: runSnapshot→detectTvlDrops+detectApySpikes→recordAlert (1h LIKE-dedupe per kind+pool). Returns {ok, tookMs, snapshot, detected, newAlerts}. notify() wiring deferred to 6.2 per BUILD_LOG. Live test: 1st call 1 alert recorded, 2nd call dedup'd (newAlerts=0).

## Phase 5 — Telegram bot

- [x] 5.1 bot/index.ts: grammy setup — tick 16. Dry-run mode (placeholder token "0000…:dry-run-no-token") when TELEGRAM_BOT_TOKEN absent; registers 5 handler modules (start/top/watch/alerts/help) + catch-all + bot.catch(); globalThis cache; exports {bot, botLive}.
- [x] 5.2 bot/handlers/start.ts: /start → upsertUser + Markdown welcome menu — tick 17. Smoke at scripts/_test-bot-start.ts uses grammy api transformer to capture sendMessage; verifies both reply text and db user row.
- [ ] 5.3 bot/handlers/top.ts: /top → fetches yields API, sends top-10 with inline buttons (Watch, Stake)
- [ ] 5.4 bot/handlers/watch.ts: /watch <protocol> → adds subscription
- [ ] 5.5 bot/handlers/alerts.ts: /alerts on|off → toggles safety alert subscription for user
- [ ] 5.6 bot/handlers/help.ts: /help
- [ ] 5.7 lib/notify.ts: sendToUser(tgUserId, text, opts) using bot instance
  - Test: `npx tsx scripts/test-bot-handlers.ts` (use grammy's testing kit) — handlers respond correctly without real TG
- [ ] [BLOCKED: needs TELEGRAM_BOT_TOKEN] 5.8 app/api/telegram/webhook/route.ts: receives webhook, dispatches to bot

## Phase 6 — Alert delivery cron

- [ ] 6.1 app/api/cron/digest/route.ts: hourly digest — for each user with `digest=on`, send top-5 changes
  - Test: insert mock user + run endpoint with TELEGRAM_BOT_TOKEN unset → should log "would send" instead of crashing
- [ ] 6.2 Wire safety alerts (Phase 4.4) to notify subscribers from db
  - Test: insert mock subscription + simulate alert → notify called with right user

## Phase 7 — 0x integration

- [ ] 7.1 lib/zeroex.ts: getQuote(sellToken, buyToken, sellAmount, taker) using 0x v2 API + affiliate fee
  - If `ZEROEX_API_KEY` missing → return stub quote with realistic shape, log "STUB MODE"
  - Test: getQuote(USDC→WETH, 100 USDC) returns quote object
- [ ] 7.2 app/api/quote/route.ts: GET wrapper

## Phase 8 — Wallet + Stake (Morpho USDC vault on Base)

- [ ] 8.1 lib/wagmi.ts: chains=[base], connectors=[coinbaseWallet, injected, walletConnect (optional)]
- [ ] 8.2 components/Providers.tsx: WagmiProvider + QueryClientProvider, mount in app/layout.tsx
- [ ] 8.3 components/ConnectButton.tsx: connect/disconnect UI
- [ ] 8.4 lib/morpho.ts: hardcoded ONE Morpho vault address (use the official Morpho USDC Steakhouse vault on Base or another well-known one — pick from morpho.org), ABI for `deposit`, helper `buildDepositTx(amount, receiver)`
  - Test: `npx tsx -e "import('./lib/morpho').then(m => console.log(m.buildDepositTx(1000000n, '0x...')))"` returns valid `to/data/value`
- [ ] 8.5 app/stake/[market]/page.tsx: stake UI with amount input, balance read, approve+deposit two-step
- [ ] 8.6 components/StakeForm.tsx: handles approve→deposit state machine
  - Test: `npm run build` passes, /stake/morpho-usdc renders without errors when not connected

## Phase 9 — Polish

- [ ] 9.1 Loading + error states across pages
- [ ] 9.2 SEO metadata + OG image route at /api/og
- [ ] 9.3 Mobile responsive review (manual)
- [ ] 9.4 README.md with: what it is, setup steps, env vars, dev/build/deploy, known limits
- [ ] 9.5 scripts/preflight.ts: prints which env vars are missing and what features are degraded

## Phase 10 — Deploy (mostly BLOCKED)

- [ ] [BLOCKED: needs Vercel login] 10.1 `vercel link` + first deploy
- [ ] [BLOCKED: needs deployed URL + TELEGRAM_BOT_TOKEN] 10.2 Set TG webhook to `<url>/api/telegram/webhook` with secret
- [ ] [BLOCKED: needs Vercel project] 10.3 Add cron schedules in `vercel.json`: `/api/cron/safety` every 5 min, `/api/cron/digest` hourly
- [ ] [BLOCKED: needs domain] 10.4 Custom domain (optional)

---

## Required user credentials (collect before/during loop)

| Var | Why | Where to get | Blocks what |
|---|---|---|---|
| TELEGRAM_BOT_TOKEN | Bot must auth to TG | @BotFather → /newbot | 5.8, 6.x runtime, 10.2 |
| TELEGRAM_WEBHOOK_SECRET | Verify TG webhooks | `openssl rand -hex 32` | 10.2 |
| ZEROEX_API_KEY | Real 0x quotes | 0x.org/dashboard | 7.x runtime (stub OK in dev) |
| AFFILIATE_FEE_RECIPIENT | Receive 0x affiliate fees | Your Base address | revenue (not build) |
| ALCHEMY_API_KEY | Better RPC quality | alchemy.com | nothing critical |

If user adds these to `.env.local` mid-build, on next tick re-check BLOCKED items and unblock if env now present.

---

## Backlog (not in scope for v1, append here only)

(empty)

---

## Done

(filled in when STATUS becomes COMPLETE)
