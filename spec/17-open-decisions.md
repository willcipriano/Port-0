# Open Decisions

> Status: Locked (MVP) | Last updated: 2026-06-19

This document lists technical and design choices for Port 0 MVP. **Choice** rows are locked for Stage 0 pre-flight; revisit post-MVP if scale demands it.

---

## Frontend Framework

| Criteria | React | Vue | Svelte / SvelteKit | Vanilla / Canvas-heavy |
|----------|-------|-----|-------------------|------------------------|
| Multi-window UI ecosystem | Large (many dock/layout libs) | Moderate | Growing | Build yourself |
| Tauri integration maturity | High | High | High | High |
| Real-time UI update patterns | Mature | Mature | Mature | Manual |
| Team familiarity | Primary | — | — | — |
| Bundle size | Larger | Moderate | Smaller | Smallest |
| Long-term hiring/ecosystem | Largest | Large | Smaller | N/A |

**Choice:** React + TypeScript

---

## Windowing Library

Required capabilities: draggable/resizable windows, tab groups, persist layout, keyboard focus management.

| Criteria | Golden Layout | react-mosaic | flexlayout-react | rc-dock | Custom |
|----------|--------------|--------------|------------------|---------|--------|
| Framework coupling | Framework-agnostic (v2) | React-only | React | React | Any |
| Tab + split support | Yes | Yes | Yes | Yes | Build |
| Maintenance activity | Moderate | Low | Active | Active | N/A |
| Uplink-like feel achievable | Yes | Yes | Yes | Yes | Full control |
| License | MIT | Apache-2.0 | MIT | Apache-2.0 | N/A |

Depends on: Frontend Framework choice.

**Choice:** flexlayout-react (MIT, active maintenance, React-native docking)

---

## Real-Time Transport

For hack sessions, trace timers, and siege interactive windows.

| Criteria | WebSockets | SSE + WebSockets | WebRTC |
|----------|-----------|------------------|--------|
| Bidirectional | Yes | WS for actions, SSE for feeds | Yes (peer) |
| Server complexity | Moderate | Two channels to manage | High |
| Latency | Low | Low | Lowest (direct) |
| Firewall/proxy compat | Good | Good (SSE one-way) | Variable |
| Fit for server-authoritative | Strong | Strong | Overkill for MVP |
| Scale path | Well understood | Well understood | Complex |

**Choice:** WebSockets (single bidirectional channel on game-api)

---

## Database

| Criteria | PostgreSQL | PostgreSQL + Redis | PostgreSQL + Document Store |
|----------|-----------|-------------------|------------------------------|
| Relational game data | Strong | Strong | Strong |
| Hot session state | Acceptable | Redis ideal | Acceptable |
| Filesystem blobs (machine state) | JSONB | JSONB + Redis cache | Native document fit |
| Tick worker queries | Strong | Strong | Split complexity |
| Ops complexity | Lower | Moderate | Higher |
| Scale path | Read replicas, partitioning | Adds cache layer | Sharded documents |

**Choice:** PostgreSQL + Redis (PG authoritative; Redis for hack sessions + pub/sub)

---

## Event Sourcing Scope

| Criteria | Full ES | Critical-only | Audit trail only |
|----------|---------|---------------|------------------|
| All state from event log | Yes | No | No |
| Ownership/economy/combat events | Yes | Yes | Logged |
| Hot path performance | Rebuild cost | Balanced | Best |
| Replay / time travel | Full | Partial | Debug only |
| MVP implementation cost | Highest | Moderate | Lowest |
| Scale to millions | Strong long-term | Good | Limited |

**Choice:** Audit trail only (log ownership, economy, siege mutations; no event-sourced rebuild)

---

## Real-Time Session State Placement

Where active hack session state lives during a connection.

| Criteria | Dedicated session service | Sticky to game-api | Stateless workers + Redis |
|----------|--------------------------|-------------------|---------------------------|
| MVP service count | +1 service | No change | No new service |
| Horizontal scale | Good | Requires sticky sessions | Best |
| Latency | Extra hop | Lowest | Low |
| Complexity | Higher | Lowest | Moderate |
| Failure recovery | Designed | Lost on node crash | Survives node crash |

**Choice:** Stateless game-api workers + Redis (`hack:{session_id}` keys; pub/sub for push)

---

## OAuth Providers

| Provider | Notes |
|----------|-------|
| GitHub | Dev audience fit |
| Google | Broad reach |
| Discord | Gaming audience fit |
| `[other]` | |

**Choice:** GitHub + Google

---

## Backend Language

Candidate runtimes from discovery: Python, TypeScript/Node. No lock.

| Criteria | Python | TypeScript / Node | Split (e.g. Python tick, Node API) |
|----------|--------|-------------------|-------------------------------------|
| Real-time API performance | Good (async) | Good (event loop) | Best of each |
| Tick/simulation workload | Strong | Good | Strong |
| Shared types with frontend | No | Yes (if TS frontend) | Partial |
| Team familiarity | — | Primary | — |
| Ops (single runtime) | Simple | Simple | Two runtimes |

**Choice:** TypeScript monorepo (shared types across client, game-api, auth, tick-worker)

---

## Cloud Provider

**Decision:** Cloud-managed (locked). Provider not locked.

| Criteria | AWS | GCP | Fly.io | `[other]` |
|----------|-----|-----|--------|-----------|
| Managed containers | Yes | Yes | Yes | |
| Managed PostgreSQL | Yes | Yes | Yes | |
| Cost at MVP scale | Higher | Higher | Lower | |
| Region availability | Global | Global | Good | |

**Choice:** Fly.io (simplicity at MVP scale; migrate to AWS if org standard requires)

---

## Monetization

Explicitly deferred. Not blocking MVP design.

| Option | Notes |
|--------|-------|
| Buy once | No microtransactions |
| Optional subscription | Cosmetic or convenience |
| Free + cosmetics | F2P cosmetics only |
| No monetization | Pre-release decision |

**Choice:** Deferred — decide before public launch; no monetization hooks in MVP code

---

## Decision Log

When a choice is made, move it to the relevant spec doc as a **Decision:** line and record the date here.

| Date | Decision | Moved to |
|------|----------|----------|
| 2026-06-19 | React + TypeScript frontend | 16-technical-architecture.md |
| 2026-06-19 | flexlayout-react windowing | 13-ui-and-ux.md |
| 2026-06-19 | WebSockets real-time transport | 16-technical-architecture.md |
| 2026-06-19 | PostgreSQL + Redis persistence | 16-technical-architecture.md |
| 2026-06-19 | Audit trail only (no full ES) | 16-technical-architecture.md |
| 2026-06-19 | Session state in Redis via game-api | 16-technical-architecture.md |
| 2026-06-19 | GitHub + Google OAuth | 16-technical-architecture.md |
| 2026-06-19 | TypeScript monorepo backend | 16-technical-architecture.md |
| 2026-06-19 | Fly.io deployment target | 16-technical-architecture.md |
