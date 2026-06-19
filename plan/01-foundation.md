# Stage 1 — Foundation

**Goal:** Working auth, persistence layer, and deployable service skeleton with game account lifecycle.

**Prerequisites:** [00-pre-flight.md](00-pre-flight.md)  
**Blocks:** Stages 2, 4, 6  
**Spec refs:** [16-technical-architecture.md](../spec/16-technical-architecture.md), [12-multiplayer-model.md](../spec/12-multiplayer-model.md)

**Status:** Complete — merged to `main` via [PR #1](https://github.com/willcipriano/Port-0/pull/1) on 2026-06-19

---

## 1.1 Auth Service

**Tasks:**

- [x] OAuth 2.0 authorization code flow (web redirect)
- [ ] Tauri: same flow via embedded webview or system browser + deep link *(Stage 6 client)*
- [x] On first login: create `Account` with default rig stats from `content/balance/rig.json`
- [x] Issue short-lived access JWT + refresh token; game-api validates JWT
- [x] Map OAuth subject → stable internal `account_id` (UUID)
- [x] Session revocation and logout
- [x] Rate limit auth endpoints

**Acceptance:** New OAuth user gets account + default rig; token works on game-api.

---

## 1.2 Persistence Layer

**Tasks:**

- [x] PostgreSQL migrations framework (`@port0/db` SQL migrations)
- [x] Core tables: `accounts`, `rigs`, `machines`, `machine_ownership`, `fleet_membership`
- [x] Redis: session keys `hack:{session_id}`, pub/sub channel `account:{id}:events`
- [x] Audit log table: ownership transfers, balance changes, siege outcomes
- [x] Seed script: empty subnet metadata row, market catalog from content files

**Acceptance:** Migrations run clean on empty DB; seed loads without error.

---

## 1.3 Game API Skeleton

**Tasks:**

- [x] HTTP server with JWT middleware
- [x] Health, version, authenticated `GET /me` (account + rig summary)
- [x] WebSocket upgrade endpoint (auth via query token or first message)
- [x] Centralized error format; no stack traces to client in prod
- [x] Request validation layer (zod/pydantic/etc.)
- [x] Account status gate: reject hack/scan/siege when `hospital` or `prison` per spec rules
- [x] Implement status middleware with configurable allowlist per route

---

## 1.4 Tick Worker Skeleton

**Tasks:**

- [x] Scheduled job every 15 minutes (internal timer; poll every 30s)
- [x] Idempotent tick: `tick_id = floor(unix / 900)` stored to prevent double-run
- [x] Empty tick handler logs start/end; writes `world_ticks` row
- [x] Hook for game-api notification (Redis pub/sub or polling)

**Acceptance:** Manual trigger runs one tick; duplicate trigger same window is no-op.

---

## 1.5 Deployment

**Tasks:**

- [x] Container images for auth, game-api, tick-worker
- [x] Staging environment with managed PostgreSQL + Redis *(Fly.io docs in `infra/fly/`)*
- [x] Secrets management (OAuth client secrets, JWT signing key) *(documented)*
- [x] HTTPS termination; WSS for WebSockets *(Fly proxy)*
- [x] Structured logging + basic metrics (request latency, active WS connections) *(JSON logs)*

---

## 1.6 Developer Experience

- [x] `npm run dev` starts full stack locally
- [x] Test accounts bypass (dev-only) for automated integration tests
- [x] Document local OAuth redirect URLs

---

## Acceptance Criteria (Stage 1 Complete)

- [x] OAuth login creates account with default rig and starting crypto (config)
- [x] JWT-authenticated API calls succeed; invalid token rejected
- [x] Hospital/prison middleware blocks correct action categories
- [x] PostgreSQL + Redis operational in staging
- [x] Tick worker runs on schedule (even if body is empty)
- [x] Audit log records test ownership transfer event

**Exit:** [02-world-and-machines.md](02-world-and-machines.md) and start client shell ([06-client-ui.md](06-client-ui.md) §6.1)
