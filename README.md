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
| Portfolio | Paper positions with live PnL |
| Copy trading | Follow demo desks → **simulated paper fills** |
| Alerts | Price above/below → **Telegram** (with retries) |
| Watchlist | Guest/account sync — **Alert** shortcut from watchlist |
| Settings | Risk, signal style, Telegram chat ID |
| AI | Analyze token → sentiment / score / thesis |
| Chat | Session-based research assistant |
| Solana | Public wallet lookup |
| Auth | Register / login (JWT 24h) |
| Size | Paper notional → token size estimator (`/swap`) |

**Out of scope:** Docker, Redis/BullMQ, live trading, custody, real DEX swaps.

## Stack

```
apps/web   Next.js UI                 :3000
apps/api   NestJS + Prisma SQLite     :3001
apps/ai    Python AI (stdlib server)  :8001
```

Persistence: SQLite at `apps/api/data/aca.db` via Prisma. Legacy `store.json` is imported once if present.

## Setup

```bash
cp .env.example .env
npm install
```

API `start:dev` runs `prisma generate` + `prisma db push` automatically.

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
- `GET  /holders/:id` · `GET /risk/:id` · `GET /smart-money/wallets|signals|events`
- `POST /analysis` · `POST /chat` · `GET/POST /chat/sessions`
- `GET/POST/DELETE /alerts` · `GET/PATCH /settings` · Telegram test/chats
- `GET  /copy-trading/leaders` · follows · trades
- `POST /auth/register` · `/auth/login`

## Next upgrades (not in this MVP)

1. PostgreSQL instead of SQLite  
2. Redis + BullMQ for jobs  
3. HttpOnly cookie auth, Docker Compose, stronger rate limits  
