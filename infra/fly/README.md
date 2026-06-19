# Fly.io staging (Stage 1 notes)

MVP staging target per [spec/17-open-decisions.md](../../spec/17-open-decisions.md).

## Services

Deploy three apps from the monorepo Docker image:

| App | Internal port | Public |
|-----|---------------|--------|
| port0-auth | 3001 | `https://auth.staging.example` |
| port0-game-api | 3002 | `https://api.staging.example` |
| port0-tick-worker | 3003 | internal only |

## Secrets

```bash
fly secrets set JWT_SECRET=... DATABASE_URL=... REDIS_URL=...
fly secrets set OAUTH_GITHUB_CLIENT_ID=... OAUTH_GITHUB_CLIENT_SECRET=...
fly secrets set OAUTH_GOOGLE_CLIENT_ID=... OAUTH_GOOGLE_CLIENT_SECRET=...
fly secrets set OAUTH_REDIRECT_URI=https://client.staging.example/auth/callback
```

## Health checks

Each service exposes `GET /health`. Configure Fly HTTP checks on that path.

## WebSockets

Fly supports WSS on the same port as game-api. No extra config beyond HTTPS.

## Migrations

Run before deploy or on release:

```bash
npm run db:migrate -w @port0/db
npm run db:seed -w @port0/db
```

Or run migrate from a one-off Fly machine using the same image.
