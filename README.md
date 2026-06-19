# Port 0

**Port 0** is a multiplayer MMO hacking simulation inspired by the spirit of *Uplink*. Players enter a persistent online network where they take contracts, break into systems, build reputations, upgrade tools, and compete or cooperate with other hackers in real time.

## Repository layout

| Path | Purpose |
|------|---------|
| [`spec/`](spec/) | Game design specification |
| [`plan/`](plan/) | Implementation stages (start at [plan/00-pre-flight.md](plan/00-pre-flight.md)) |
| [`packages/`](packages/) | TypeScript monorepo — client, auth, game-api, tick-worker, shared |
| [`content/`](content/) | Game data — tools, archetypes, subnet, balance-v0 placeholders |
| [`infra/`](infra/) | Docker Compose and deploy manifests |

## Quick start

**Prerequisites:** Node.js 20+, Docker

```bash
# Install dependencies
npm install

# Validate content schemas
npm run validate-content

# Run typecheck and tests
npm run typecheck
npm run test

# Start backend stack (PostgreSQL, Redis, auth, game-api, tick-worker)
docker compose -f infra/docker-compose.yml up --build

# In separate terminals — local dev without Docker:
cp .env.example .env
npm run dev:auth
npm run dev:game-api
npm run dev:tick-worker
npm run dev:client

# Mock API for client development
npm run dev:mock
```

**Health checks:** `http://localhost:3001/health`, `:3002/health`, `:3003/health`

**Mock API:** `http://localhost:3099` (serves stub REST + OpenAPI at `/openapi.yaml`)

## Stack (MVP — locked Stage 0)

- **Frontend:** React + TypeScript, flexlayout-react (Stage 6)
- **Backend:** TypeScript monorepo (auth, game-api, tick-worker)
- **Data:** PostgreSQL + Redis
- **Realtime:** WebSockets on game-api
- **Auth:** GitHub + Google OAuth
- **Deploy target:** Fly.io

See [spec/17-open-decisions.md](spec/17-open-decisions.md) for the full decision log.

## Specification index

| Doc | Summary |
|-----|---------|
| [00-vision-and-pillars](spec/00-vision-and-pillars.md) | Pitch, design pillars, is/is-not boundaries |
| [15-mvp-scope](spec/15-mvp-scope.md) | One-subnet MVP boundary and roadmap |
| [16-technical-architecture](spec/16-technical-architecture.md) | Services, authority model, data flows |
| [17-open-decisions](spec/17-open-decisions.md) | Locked technical choices |

Full index in the original spec README section — all docs under [`spec/`](spec/).
