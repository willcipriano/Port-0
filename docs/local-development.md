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

This starts Postgres + Redis via Docker, runs migrations/seed, then auth (:3001), game-api (:3002), and tick-worker (:3003).

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

## Staging (Fly.io)

See [`infra/fly/README.md`](../infra/fly/README.md) for deployment notes. Stage 1 requires:

- Managed Postgres + Redis (Upstash or Fly Redis)
- Secrets: `JWT_SECRET`, OAuth client secrets
- HTTPS/WSS via Fly proxy
