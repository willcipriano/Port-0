# Stage 0 — Pre-flight

**Goal:** Lock technical choices, scaffold the repository, and triage spec TBDs so implementation can proceed without rework.

**Prerequisites:** None  
**Blocks:** All other stages  
**Spec refs:** [16-technical-architecture.md](../spec/16-technical-architecture.md), [17-open-decisions.md](../spec/17-open-decisions.md), [15-mvp-scope.md](../spec/15-mvp-scope.md)

**Status:** Complete (2026-06-19)

---

## 0.1 Resolve Open Decisions

Fill the **Choice** row in [17-open-decisions.md](../spec/17-open-decisions.md) and copy decisions here when locked.

| Decision | MVP choice | Rationale |
|----------|------------|-----------|
| Frontend framework | React + TypeScript | Largest windowing ecosystem; shared types with backend |
| Windowing library | flexlayout-react | Docking + layout persist; active React maintenance |
| Real-time transport | WebSockets | Bidirectional; single channel; sufficient for MVP |
| Database | PostgreSQL + Redis | PG for authoritative state; Redis for sessions + pub/sub |
| Event sourcing | Audit trail only | Lowest MVP cost; log ownership/economy mutations |
| Session state | game-api + Redis | Survives restarts; no extra service |
| OAuth providers | GitHub + Google | Dev + broad reach |
| Backend language | TypeScript monorepo | Shared types with React client; single runtime ops |
| Cloud provider | Fly.io | Simplicity at small scale |

**Action:** ~~Schedule 1 decision session.~~ Done — documented in `17-open-decisions.md` Decision Log.

---

## 0.2 TBD Triage

Review [TBD-registry.md](TBD-registry.md). Classify each item:

- **Blocker** — must resolve before related stage starts  
- **Placeholder OK** — ship with config constant; tune in Stage 7  
- **Post-MVP** — explicitly defer  

Minimum blockers before Stage 2:

- [x] MVP zone name and subnet theme → **Shady Hollow**, residential mixed shady (`content/subnet/mvp-subnet.json`)
- [x] MVP machine count → **300 proc-gen + 3 landmarks**
- [x] 3–5 OS archetype names → **4 archetypes** in `content/archetypes/mvp-archetypes.json`
- [x] MVP tool catalog → **6 tools** in `content/tools/mvp-tools.json`
- [x] IPv6 allocation scheme → **`2001:db8:1:7::/64`**

---

## 0.3 Repository Scaffold

Create monorepo or multi-repo layout (decision: monorepo recommended for MVP).

```
port0/
├── packages/
│   ├── client/          # Web + Tauri shell
│   ├── game-api/        # Player actions, sessions
│   ├── tick-worker/     # 15-min simulation
│   ├── auth/            # OAuth + tokens
│   └── shared/          # Types, constants, content schemas
├── content/
│   ├── archetypes/
│   ├── landmarks/
│   ├── tools/
│   └── subnet/
├── infra/               # Docker, deploy manifests
├── docs/                # Link to ../spec
└── scripts/
```

**Tasks:**

- [x] Initialize git repo (if not already), `.gitignore`, README with run instructions
- [x] Add `packages/shared` with TypeScript types mirroring spec entities (Account, Machine, Rig, Tool, Session)
- [x] Docker Compose: PostgreSQL, Redis, all three services (stub handlers)
- [x] CI: lint, typecheck, unit test on PR
- [x] Environment template (`.env.example`): DB URL, Redis, OAuth secrets, JWT secret
- [x] Content loading: YAML/JSON schema validation on boot (`npm run validate-content`)

---

## 0.4 API Contract Sketch

Define OpenAPI or shared types for cross-team work:

| Domain | Key endpoints / messages |
|--------|--------------------------|
| Auth | `POST /auth/callback`, `POST /auth/refresh`, `GET /auth/me` |
| World | `GET /world/subnet`, `GET /machines/:ipv6` (public fingerprint only) |
| Scan | `POST /scans`, `GET /scans/:id` |
| Session | `WS /session` — connect, run_tool, shell_command, claim, disconnect |
| Fleet | `GET /fleet`, `POST /machines/:ipv6/harden` |
| Market | `GET /market`, `POST /market/purchase` |
| Siege | `POST /sieges`, `WS /siege/:id`, `GET /sieges` |
| Tick | Internal only; client receives `tick_applied` push or poll |

- [x] Publish contract doc in `packages/shared/openapi.yaml`
- [x] Mock server for client development (`npm run dev:mock`)

---

## 0.5 Design Placeholders (balance-v0)

Create `content/balance/` with documented placeholder formulas until designer tuning:

| Constant file | Placeholder |
|---------------|-------------|
| `trace.json` | base_seconds=180, heat_multiplier=1.0, blocker_extension=120 |
| `heat.json` | +5 per caught hack, -1 decay per tick |
| `economy.json` | tick_minutes=15, L1 tool prices, upkeep per drone |
| `siege.json` | resolve_ticks=2, interactive_window_minutes=5 |
| `virus.json` | craft_minutes=30, uses=3 |

Mark all values `# balance-v0` in file headers.

All files use `"balance_version": "balance-v0"`.

---

## Acceptance Criteria

- [x] All rows in [17-open-decisions.md](../spec/17-open-decisions.md) have a **Choice** or explicit "MVP default" documented
- [x] Repo runs `docker compose up` and returns health checks from all services
- [x] Shared types cover Account, Machine, HackSession, Tool, Siege
- [x] TBD blockers for Stage 2 assigned to owner with target date (see TBD-registry — machine template schema → eng, Stage 2)
- [x] API contract published for client to mock against

**Exit:** Proceed to [01-foundation.md](01-foundation.md)
