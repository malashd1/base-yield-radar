# Base Yield Radar

Discovery + safety alerts + one-click stake for yields on Base.

- **Web app** — top yields page, sortable/filterable, with per-protocol pages and 30d APY history charts.
- **Telegram bot** — `/top`, `/watch <protocol>`, `/alerts on` for live updates.
- **Safety cron** — snapshots top-50 Base pools, detects ≥20% TVL drops in 6h or ≥3× APY spikes, broadcasts to subscribers.
- **Stake flow** — connect wallet (Coinbase Wallet / injected), deposit USDC into Steakhouse USDC vault on Morpho. Non-custodial; you sign every transaction.

Built with Next.js 16, wagmi + viem, grammy (Telegram), better-sqlite3, recharts, Tailwind v4.

## Quick start

```bash
npm install
cp .env.example .env.local        # then fill what you have
npm run dev                       # http://localhost:3000
```

Without any keys the app is fully usable in dev — the bot runs dry-run, 0x quotes are stubbed, alerts log to console instead of TG. Add keys to graduate features.

Run `npx tsx scripts/preflight.ts` to see exactly which features are LIVE vs degraded.

## Routes

| Path | What |
|---|---|
| `/` | Landing |
| `/yields` | Top 30+ yields, client-side sortable + filtered |
| `/protocols/[slug]` | Per-protocol page with 30d APY chart |
| `/stake/morpho-usdc` | Stake USDC into Steakhouse USDC vault |
| `GET /api/yields` | JSON top yields (cached 1h) |
| `GET /api/yields/[poolId]` | Pool detail + history |
| `GET /api/quote` | 0x v2 quote with affiliate fee |
| `GET /api/cron/safety` | Snapshot + detect + alert (run every 5 min) |
| `GET /api/cron/digest` | Hourly audited top-5 to digest subscribers |
| `POST /api/telegram/webhook` | TG webhook receiver (validates secret token) |
| `GET /api/og` | OG image (Edge runtime) |

## Required env (in `.env.local`)

| Var | Why | Where to get | Without it |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Bot auth | @BotFather → /newbot | bot dry-runs (logs instead of sending) |
| `TELEGRAM_WEBHOOK_SECRET` | Verify TG calls | `openssl rand -hex 32` | webhook returns 200+error |
| `ZEROEX_API_KEY` | Real swap quotes | https://0x.org/dashboard | /api/quote returns stub |
| `AFFILIATE_FEE_RECIPIENT` | Receive 0x affiliate fees | Your Base address | no affiliate fee added |
| `ALCHEMY_API_KEY` | Better RPC | https://alchemy.com | falls back to public Base RPC |
| `NEXT_PUBLIC_SITE_URL` | OG/share URLs | your prod URL | defaults to localhost |

## Develop

```bash
npm run dev      # next dev (http://localhost:3000)
npm run build    # prod build
npx tsc --noEmit # typecheck

# CLI utils
npx tsx scripts/snapshot.ts                # take a top-50 snapshot
npx tsx scripts/snapshot.ts --limit=100    # custom N
npx tsx scripts/preflight.ts               # env audit
npx tsx scripts/preflight.ts --strict      # fail if any prod feature degraded
```

## Deploy (Vercel)

1. `vercel link` → connect to your account.
2. Set env vars in the Vercel dashboard (same names as `.env.example`).
3. `vercel deploy --prod`.
4. After deploy, point Telegram webhook to your URL:
   ```bash
   curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://YOUR.DOMAIN/api/telegram/webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```
5. Add cron schedules in `vercel.json`:
   ```json
   {
     "crons": [
       { "path": "/api/cron/safety", "schedule": "*/5 * * * *" },
       { "path": "/api/cron/digest", "schedule": "0 * * * *" }
     ]
   }
   ```

## Architecture

```
app/                Next.js App Router pages + API routes
  api/cron/         scheduled jobs (safety, digest)
  api/telegram/     bot webhook
  api/yields/       data API
  stake/[market]/   stake UI per vault
bot/                grammy bot — handlers, dispatched via webhook
  handlers/         one file per command
components/         React UI
lib/
  defillama.ts      yield/history fetchers
  cache.ts          tiny FS-backed TTL cache
  db.ts             better-sqlite3 wrapper (schema + helpers)
  safety.ts         TVL drop + APY spike detectors
  snapshot.ts       runSnapshot() shared by CLI and cron
  notify.ts         dryrun-safe sender + broadcast
  zeroex.ts         0x v2 client (stub-capable)
  morpho.ts         Steakhouse USDC vault — calldata builders
  wagmi.ts          chain config + connectors
  env.ts            zod-validated env + features flags
scripts/            CLI utils + smoke tests (prefixed `_test-` are devolopment-only)
```

## Safety / non-custodial guarantees

- The app **never holds user funds**. Every onchain action is a transaction signed by the user's wallet.
- Vault address (`MORPHO_USDC_VAULT`) is hardcoded in `lib/morpho.ts` — no env var can redirect it.
- Affiliate fee is collected by the 0x router from the buy-token at swap time. We never touch it.
- Detectors surface signals; they do not act. The user decides.

## Not in scope (yet)

- WalletConnect (needs project id)
- Multi-vault registry (only Steakhouse USDC in v1)
- Position tracking ("how much did I earn?")
- Withdraw flow (deposit only in v1)
- Mainnet beyond Base

Issues + PRs welcome.

## License

MIT.
