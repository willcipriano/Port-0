# Stage 1 — Foundation

**Goal:** Working auth, persistence layer, and deployable service skeleton with game account lifecycle.

**Prerequisites:** [00-pre-flight.md](00-pre-flight.md)  
**Blocks:** Stages 2, 4, 6  
**Spec refs:** [16-technical-architecture.md](../spec/16-technical-architecture.md), [12-multiplayer-model.md](../spec/12-multiplayer-model.md)

---

## 1.1 Auth Service

**Tasks:**

- [ ] OAuth 2.0 authorization code flow (web redirect)
- [ ] Tauri: same flow via embedded webview or system browser + deep link
- [ ] On first login: create `Account` with default rig stats from `content/balance/rig.json`
- [ ] Issue short-lived access JWT + refresh token; game-api validates JWT
- [ ] Map OAuth subject → stable internal `account_id` (UUID)
- [ ] Session revocation and logout
- [ ] Rate limit auth endpoints

**Data model — Account:**

| Field | Notes |
|-------|-------|
| id | UUID |
| oauth_provider, oauth_sub | Unique composite |
| display_handle | Optional; hidden from other players |
| crypto_balance | Numeric |
| rig_stats | CPU, RAM, storage, bandwidth |
| cyberware | JSON array of installed upgrades |
| status | `active`, `hospital`, `prison` |
| status_expires_at | Real-time timer |
| created_at | |

**Acceptance:** New OAuth user gets account + default rig; token works on game-api.

---

## 1.2 Persistence Layer

**Tasks:**

- [ ] PostgreSQL migrations framework (e.g. Flyway, Prisma migrate, Alembic)
- [ ] Core tables: `accounts`, `rigs`, `machines`, `machine_ownership`, `fleet_membership`
- [ ] Redis: session keys `hack:{session_id}`, pub/sub channel `account:{id}:events`
- [ ] Audit log table: ownership transfers, balance changes, siege outcomes
- [ ] Seed script: empty subnet metadata row, market catalog from content files

**Indexes:**

- `machines(ipv6)` unique
- `machine_ownership(owner_account_id)`
- `accounts(oauth_provider, oauth_sub)` unique

**Acceptance:** Migrations run clean on empty DB; seed loads without error.

---

## 1.3 Game API Skeleton

**Tasks:**

- [ ] HTTP server with JWT middleware
- [ ] Health, version, authenticated `GET /me` (account + rig summary)
- [ ] WebSocket upgrade endpoint (auth via query token or first message)
- [ ] Centralized error format; no stack traces to client in prod
- [ ] Request validation layer (zod/pydantic/etc.)
- [ ] Account status gate: reject hack/scan/siege when `hospital` or `prison` per spec rules

**Hospital vs prison enforcement** ([09-authorities-and-factions.md](../spec/09-authorities-and-factions.md)):

| Status | Block | Allow |
|--------|-------|-------|
| hospital | hack, siege attack, virus deploy | fleet mgmt, market, scan queue |
| prison | hack, scans, offensive fleet, market buy | read-only dashboards (optional) |

- [ ] Implement status middleware with configurable allowlist per route

---

## 1.4 Tick Worker Skeleton

**Tasks:**

- [ ] Scheduled job every 15 minutes (cron, Cloud Scheduler, or internal timer with leader election)
- [ ] Idempotent tick: `tick_id = floor(unix / 900)` stored to prevent double-run
- [ ] Empty tick handler logs start/end; writes `world_ticks` row
- [ ] Hook for game-api notification (Redis pub/sub or polling)

**Acceptance:** Manual trigger runs one tick; duplicate trigger same window is no-op.

---

## 1.5 Deployment

**Tasks:**

- [ ] Container images for auth, game-api, tick-worker
- [ ] Staging environment with managed PostgreSQL + Redis
- [ ] Secrets management (OAuth client secrets, JWT signing key)
- [ ] HTTPS termination; WSS for WebSockets
- [ ] Structured logging + basic metrics (request latency, active WS connections)

**Acceptance:** Staging URL loads; OAuth login completes; `/me` returns account.

---

## 1.6 Developer Experience

- [ ] `make dev` or `npm run dev` starts full stack locally
- [ ] Test accounts bypass (dev-only) for automated integration tests
- [ ] Document local OAuth redirect URLs

---

## Acceptance Criteria (Stage 1 Complete)

- [ ] OAuth login creates account with default rig and starting crypto (config)
- [ ] JWT-authenticated API calls succeed; invalid token rejected
- [ ] Hospital/prison middleware blocks correct action categories
- [ ] PostgreSQL + Redis operational in staging
- [ ] Tick worker runs on schedule (even if body is empty)
- [ ] Audit log records test ownership transfer event

**Exit:** [02-world-and-machines.md](02-world-and-machines.md) and start client shell ([06-client-ui.md](06-client-ui.md) §6.1)
