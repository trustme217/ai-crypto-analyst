# AI Crypto Analyst (MVP)

Research desk for crypto markets + Solana + AI briefs + paper alerts/copy.

## What’s in the MVP

| Area | Capability |
|------|------------|
| Market | CoinGecko **top-by-cap** overview, search, token detail, heatmap |
| Signals | **Token Score** (SM 30% / Liq 15% / Vol 15% / Mom 15% / Hold 15% / Risk 10%) — deterministic |
| Smart money | Tracked wallets + **RPC ingest → normalized events → analytics** (`/smart-money`) |
| Holders | Distribution intel (top 10/20, SM/whale/creator, concentration alerts) |
| Risk | **Risk Engine** (liq / holders / creator / sell / volume / contract) before AI |
| Jobs | **BullMQ** pipeline (blockchain → scoring → AI → alerts) on local Redis |
| Portfolio | Paper positions with live PnL |
| Copy trading | Follow demo desks → **simulated paper fills** |
| Alerts | Price above/below → **Telegram** (with retries) |
| Watchlist | Guest/account sync — **Alert** shortcut from watchlist |
| Settings | Risk, signal style, Telegram chat ID |
| AI | **Agent desk** — Token / Wallet / Risk → Research → final brief |
| Chat | Session-based research assistant |
| Solana | Public wallet lookup |
| Auth | Register / login (JWT 24h) |
| Size | Paper notional → token size estimator (`/swap`) |

**Out of scope:** Docker, live trading, custody, real DEX swaps.

## Stack

```
apps/web   Next.js UI                      :3000
apps/api   NestJS + Prisma + BullMQ        :3001
apps/ai    Python AI (stdlib server)       :8001
Postgres   local cluster (no Docker)       :5434
Redis      local process (no Docker)       :6379
```

Pipeline: Solana → Blockchain Queue → Parser → PostgreSQL → Scoring Queue → Scoring → AI Queue → AI → Alert Queue → Telegram.

Persistence: local PostgreSQL at `127.0.0.1:5434`. Jobs: local Redis at `127.0.0.1:6379` via BullMQ. Neither uses Docker. `npm run db:up` and `npm run redis:up` start them (`start.bat` does both).

## Setup

1. Install [PostgreSQL](https://www.postgresql.org/download/) locally if it is not already on PATH / `C:\Program Files\PostgreSQL`. Optional: `ACA_PG_BIN` to the `bin` folder.
2. Copy env and install:

```bash
cp .env.example .env
npm install
```

`DATABASE_URL` defaults to `postgresql://aca@127.0.0.1:5434/aca`.

API `start:dev` runs `db:up` + `redis:up` (via `npm run dev:api`) then Prisma push.

Optional: `OPENAI_API_KEY` for LLM mode. Heuristic AI works without it.

### Telegram price alerts

1. Create a bot with [BotFather](https://t.me/BotFather); set `TELEGRAM_BOT_TOKEN` in `.env`.
2. Restart API; message the bot `/start`.
3. Settings → pick chat ID → enable Telegram → Send test.
4. Create alerts on **Alerts**. Hits notify Telegram (failed sends retry with backoff).

### Auth

Set a long random `JWT_SECRET` (avoid defaults). Access tokens expire in **24h**. Register passwords require **8+** characters.

## Run

**Windows:** double-click `start.bat`

```bash
npm run dev
```

Open http://localhost:3000

```bash
npm run dev:ai
npm run dev:api
npm run dev:web
```

## API map (highlights)

- `GET  /market/overview` · `/market/search` · `/market/coins/:id`
- `GET  /signals?style=`
- `GET  /holders/:id` · `GET /risk/:id` · `GET /queue` · `POST /queue/tick`
- `GET  /smart-money/wallets|signals|events`
- `POST /analysis` · `GET /analysis/desk/:id` · `POST /chat` · `GET/POST /chat/sessions`
- `GET/POST/DELETE /alerts` · `GET/PATCH /settings` · Telegram test/chats
- `GET  /copy-trading/leaders` · follows · trades
- `POST /auth/register` · `/auth/login`

## Next upgrades (not in this MVP)

1. HttpOnly cookie auth, stronger rate limits  
