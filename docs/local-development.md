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

Then call APIs with:

```
Authorization: Bearer dev:
```

Optional account key after `dev:` (defaults to a stable dev UUID). Example:

```
Authorization: Bearer dev:00000000-0000-4000-8000-000000000001
```

Creates the account on first use with rig stats from `content/balance/rig.json` and starter crypto from `content/balance/economy.json`.

## Full local stack

```bash
cp .env.example .env
npm install
npm run dev
```

This starts Postgres + Redis via Docker, runs migrations/seed, then auth (:3001), game-api (:3002), and tick-worker (:3003).

## Manual tick trigger (dev)

```bash
curl -X POST http://localhost:3003/tick/trigger
```

Duplicate triggers within the same 15-minute window return `{ "duplicate": true }`.

## Staging (Fly.io)

See [`infra/fly/README.md`](../infra/fly/README.md) for deployment notes. Stage 1 requires:

- Managed Postgres + Redis (Upstash or Fly Redis)
- Secrets: `JWT_SECRET`, OAuth client secrets
- HTTPS/WSS via Fly proxy
