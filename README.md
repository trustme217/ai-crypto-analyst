# AI Crypto Analyst (MVP)

Research desk for crypto markets + Solana + AI briefs.

Built from your shared ChatGPT prompts:

1. NestJS + Prisma schema target + Next.js + Python AI + Solana
2. No Docker, MVP only (not production)

## What’s in the MVP

| Area | Capability |
|------|------------|
| Market | CoinGecko overview, search, token detail |
| Signals | AI trading signals (long/short/neutral + SL/TP) |
| Portfolio | Paper positions with live PnL |
| Copy trading | Follow demo desks (paper only) |
| Alerts | Price above/below alerts |
| Watchlist | Guest browser save or account sync — Watch on token page |
| Settings | Risk, signal style, preferences |
| AI | Analyze token → sentiment / score / thesis |
| Chat | Research assistant |
| Solana | Public wallet lookup |
| Auth | Register / login (JWT) |

**Skipped for MVP:** Docker, Redis/BullMQ, trading, custody, production hardening.

## Stack

```
apps/web   Next.js UI                 :3000
apps/api   NestJS API + JSON store    :3001
apps/ai    Python AI (stdlib server)  :8001
```

Persistence is a local JSON file (`apps/api/data/store.json`) so the MVP runs with zero DB install.
The Prisma-shaped schema lives at `apps/api/prisma/schema.prisma` for when you move to PostgreSQL.

## Setup

```bash
cp .env.example .env
npm install
```

Optional: set `OPENAI_API_KEY` in `.env` for LLM mode. Heuristic mode works without it.

Python uses only the standard library (works on Python 3.14 with no pip packages).

## Run (one click)

**Windows:** double-click `start.bat`

Or from a terminal:

```bash
npm run dev
```

That starts AI (:8001), API (:3001), and Web (:3000) together.

Open http://localhost:3000

Optional individual processes:

```bash
npm run dev:ai
npm run dev:api
npm run dev:web
```

## API map

- `GET  /health`
- `GET  /market/overview`
- `GET  /market/search?q=`
- `GET  /market/coins/:id`
- `POST /analysis` `{ "coingeckoId": "solana" }`
- `GET  /analysis/recent`
- `POST /chat` `{ "message": "..." }`
- `GET  /solana/wallet?address=`
- `POST /auth/register` · `POST /auth/login`
- `GET/POST/DELETE /watchlist` (JWT)

## Next upgrades

1. Wire Prisma + PostgreSQL using `apps/api/prisma/schema.prisma`
2. Add Redis + BullMQ for async analysis jobs
3. Docker Compose, rate limits, stronger auth
