# Local development

## OAuth redirect URLs

Register these callback URLs with your OAuth apps:

| Provider | Redirect URI (local) |
|----------|----------------------|
| GitHub | `http://localhost:5173/auth/callback` |
| Google | `http://localhost:5173/auth/callback` |

Set `OAUTH_REDIRECT_URI` in `.env` to match.

### GitHub OAuth app

1. GitHub → Settings → Developer settings → OAuth Apps → New
2. Authorization callback URL: `http://localhost:5173/auth/callback`
3. Copy Client ID and Client Secret to `.env`

### Google OAuth client

1. Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web)
2. Authorized redirect URI: `http://localhost:5173/auth/callback`
3. Copy Client ID and Client Secret to `.env`

## Dev auth bypass

For integration tests and local API work without OAuth:

```bash
DEV_AUTH_BYPASS=true
```

Then call REST APIs with:

```
Authorization: Bearer dev:
```

Optional account key after `dev:` (defaults to a stable dev UUID). Example:

```
Authorization: Bearer dev:00000000-0000-4000-8000-000000000001
```

For the hack session WebSocket, pass the same token as a query param:

```
ws://localhost:3002/session?token=dev:00000000-0000-4000-8000-000000000001
```

Creates the account on first use with rig stats from `content/balance/rig.json`, starter crypto from `content/balance/economy.json`, and MVP L1 tools on the rig.

Without `DEV_AUTH_BYPASS=true`, use a signed JWT access token (same secret as auth/game-api). The smoke test script mints one automatically.

## Full local stack

```bash
cp .env.example .env
npm install
npm run dev
```

This starts Postgres + Redis via Docker, runs migrations/seed, then mock API (:3099), auth (:3001), game-api (:3002), tick-worker (:3003), and the Vite client (:5173).

Open **http://localhost:5173/** in your browser and log in with any handle and access key.

Stop the stack (Node services + Docker containers):

```bash
npm run dev:down
```

`Ctrl+C` in the `npm run dev` terminal does the same thing.

## Client UI only (no Docker / real backend)

```bash
npm run dev:mock   # terminal 1 — mock API on :3099
npm run dev:client # terminal 2 — Vite on :5173
```

If login shows `CONNECTION REFUSED`, check http://localhost:5173/ and http://localhost:3099/health both return 200.

Seed also bootstraps the MVP subnet (300 proc-gen machines + 3 landmarks) if the `machines` table is empty.

## World bootstrap (dev)

Proc-gen lives in `@port0/shared`; persistence is via `@port0/db`.

```bash
# Seed subnet metadata, market catalog, and machines (skips machine insert if already populated)
npm run db:seed

# Bootstrap machines only
npm run db:bootstrap

# Force regen with a custom seed (deletes existing machines)
npm run world:bootstrap -w @port0/db -- --force --seed=42
```

Default seed is reproducible across dev/staging (`DEFAULT_WORLD_SEED` in `@port0/shared`). Landmarks keep fixed IPv6 addresses (`::1`, `::2`, `::3`); proc-gen fills from `::4` upward.

## Manual tick trigger (dev)

```bash
curl -X POST http://localhost:3003/tick/trigger
```

Duplicate triggers within the same 15-minute window return `{ "duplicate": true }`.

## Hack sessions (Stage 3)

Real-time intrusion runs on the game-api WebSocket at `/session` (port 3002). Sessions are stored in Redis; tool timing, trace, and shell state are server-authoritative.

**Smoke test** (requires `npm run dev` or game-api + Postgres + Redis):

```bash
npm run test:hack-session
```

This connects with a JWT, claims landmark `2001:db8:1:7::3` (cheap_server backdoor path), and verifies tool level rejection on `::2`.

**Manual WebSocket flow** (with dev bypass enabled):

1. Connect: `ws://localhost:3002/session?token=dev:00000000-0000-4000-8000-000000000001`
2. Wait for `{ "type": "session_ready" }`
3. Send `{ "type": "connect", "ipv6": "2001:db8:1:7::3" }`
4. Shell: `{ "type": "shell_command", "command": "assume superuser backdoor" }`
5. Disable alarm: `{ "type": "shell_command", "command": "disable alarm" }`
6. Claim: `{ "type": "claim" }`

Server pushes `trace_update` every second while tracing, plus `tool_progress`, `task_manager`, and `caught` on trace expiry.

Landmark targets for testing:

| IPv6 | Archetype | Notes |
|------|-----------|-------|
| `2001:db8:1:7::3` | cheap_server | Backdoor + L1; good happy path |
| `2001:db8:1:7::2` | corp_workstation | Immediate trace; L1 cracker rejected |
| `2001:db8:1:7::1` | generic_linux | Criminal faction; hospital on catch |

Balance tuning: `content/balance/trace.json` (trace speed, punishments, idle timeout).

## Tick economy (Stage 4)

15-minute world ticks run in the tick-worker (port 3003). Each tick delivers queued scans, applies drone income/upkeep, fluctuates market prices, and decays subnet heat.

**Integration test** (requires `npm run dev` or game-api + tick-worker + Postgres + Redis):

```bash
npm run test:tick-economy
```

**Manual tick trigger** (dev only):

```bash
curl -X POST "http://localhost:3003/tick/trigger?tickId=1979998"
```

Use a fresh `tickId` (e.g. `MAX(tick_id)+1` from `world_ticks`) if the current window already completed. Queue a scan first:

```bash
curl -X POST http://localhost:3002/scans \
  -H "Authorization: Bearer dev:00000000-0000-4000-8000-000000000001" \
  -H "Content-Type: application/json" \
  -d '{"subnetId":"block_7"}'
```

Offline catch-up: `GET /me/sync?sinceTick=N` returns per-tick balance and scan summaries.

Balance tuning: `content/balance/economy.json`, `content/balance/heat.json`.

## PvP sieges (Stage 5)

Fleet, recon intel, virus crafting, and async sieges with an interactive window. Resolution runs on the tick pipeline after the window closes.

**Integration test** (requires full dev stack):

```bash
npm run test:pvp-sieges
```

Creates two dev accounts, assigns drones, crafts a virus, declares a siege, applies interactive actions, triggers a tick, and verifies ownership transfer on attacker win.

**Key REST endpoints** (game-api :3002):

| Endpoint | Purpose |
|----------|---------|
| `GET /fleet` | Owned drones with resources, roles, and aggregates (attack / mpPool / hp) |
| `GET /rig` | Personal rig stats (not in fleet) |
| `PATCH /fleet/:ipv6/role` | Assign `staging`, `passive_income`, or `defensive` |
| `GET /intel` | Recon results (`ipv6 → owner_hint, confidence`) |
| `POST /sieges` | Declare siege against a player-owned drone |
| `GET /sieges/:id` | Siege state + interactive dashboard |
| `POST /sieges/:id/actions` | Deploy virus, escalate, countermeasure, isolate, etc. |
| `POST /viruses/craft` | Start offline virus craft (`storage_damage` at MVP) |
| `GET /viruses/inventory` | Crafted viruses and in-progress jobs |

**Siege WebSocket:** `ws://localhost:3002/siege?siegeId=<uuid>&token=...` — real-time dashboard updates for attacker and defender.

**Recon during hack sessions:**

- Run `recon_l1` tool against a target; results stored in `/intel`
- On L2+ machines, `cat /var/log/auth.log` after shell access reveals owner fingerprints

Redis publishes `siege_declared`, `siege_updated`, and `siege_outcome` events on `account:{id}:events`.

Balance tuning: `content/balance/siege.json`, `content/balance/virus.json`.

## Staging (Fly.io)

See [`infra/fly/README.md`](../infra/fly/README.md) for deployment notes. Stage 1 requires:

- Managed Postgres + Redis (Upstash or Fly Redis)
- Secrets: `JWT_SECRET`, OAuth client secrets
- HTTPS/WSS via Fly proxy
