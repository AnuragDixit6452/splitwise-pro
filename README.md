# Splitwise Pro

Personal expense ledger with a React frontend, Express API, and Postgres. Unlock PIN is fixed to **1495**.

## Stack

- Frontend: Vite + React (served by Express in production)
- Backend: Express (`server/`)
- Database: Postgres

## Local development

**Prerequisites:** Node 20+, Docker (for Postgres)

1. Copy env file and start Postgres:

```bash
cp .env.example .env
docker compose up -d db
```

2. Install deps and run API + Vite (two terminals):

```bash
npm install
npm run dev:server   # API on http://localhost:4000
npm run dev          # UI on http://localhost:3000 (proxies /api → :4000)
```

3. Open http://localhost:3000 and unlock with PIN `1495`.

## Full stack with Docker

```bash
docker compose up --build
```

App: http://localhost:3000 · Postgres: `localhost:5432`

## Free hosting (recommended)

| Layer | Service | Notes |
|-------|---------|--------|
| Database | [Neon](https://neon.tech) free | Durable free Postgres |
| App | [Render](https://render.com) free Web Service | Cold-starts after ~15 min idle |

Render’s own free Postgres **expires after 30 days** — prefer Neon for the DB.

### Deploy steps

1. Create a Neon project → copy the connection string (`DATABASE_URL`). Enable SSL (Neon requires it).
2. Push this repo to GitHub.
3. On Render: **New → Blueprint** (uses [`render.yaml`](render.yaml)), or **New → Web Service** from the repo with Docker.
4. Set environment variables on the web service:
   - `DATABASE_URL` = Neon connection string
   - `DATABASE_SSL` = `true`
   - `APP_PIN` = `1495`
   - `SESSION_SECRET` = long random string (Blueprint can auto-generate)
5. Deploy. Open the Render URL and unlock with `1495`.

## API

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/api/auth/unlock` | — | `{ "pin": "1495" }` → session token |
| GET | `/api/state` | Bearer | Full ledger |
| PUT | `/api/state` | Bearer | Replace ledger |
| POST | `/api/reset` | Bearer | Clear + reseed default trip |
| GET | `/api/health` | — | Health check |
