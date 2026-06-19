# TBD Registry

Consolidated open design inputs from the spec. Update status as items are resolved during [00-pre-flight.md](00-pre-flight.md) and later stages.

**Status key:** `BLOCKER` | `PLACEHOLDER` | `POST-MVP` | `RESOLVED`

---

## World and Content

| Item | Spec ref | Suggested MVP | Status | Owner | Stage |
|------|----------|---------------|--------|-------|-------|
| MVP zone name and character | 04, 15 | Shady Hollow (residential mixed shady) | RESOLVED | eng | 0 |
| MVP machine count | 04, 15, 18 | 300 proc-gen + 3 landmarks | RESOLVED | eng | 0 |
| IPv6 allocation scheme | 04 | `2001:db8:1:7::/64` | RESOLVED | eng | 0 |
| Address persistence on destroy | 04 | Defer destroy mechanic | POST-MVP | — | — |
| Starting zone assignment | 04 | Single subnet for MVP | RESOLVED | spec | — |
| Landmark IPv6 assignments | 18 | `content/landmarks/mvp-landmarks.json` | PLACEHOLDER | designer | 2 |
| Story mission landmarks | 18 | Bob's Plumbing only at MVP | POST-MVP | designer | 7 |

---

## Machines and Shells

| Item | Spec ref | Suggested MVP | Status | Owner | Stage |
|------|----------|---------------|--------|-------|-------|
| OS archetype names (3–5) | 05 | CheapServer, Generic Linux, Corp WS, Mainframe | RESOLVED | eng | 0 |
| Encryption/decryptor mechanic | 05 | Skip at MVP | POST-MVP | — | — |
| Authority seizure ownership | 05 | Not in MVP | POST-MVP | — | — |
| Machine destruction | 05 | Not in MVP | POST-MVP | — | — |
| Machine template JSON schema | 18 | Define in Stage 2 | BLOCKER | eng | 2 |

---

## Rig and Fleet

| Item | Spec ref | Suggested MVP | Status | Owner | Stage |
|------|----------|---------------|--------|-------|-------|
| Rig base stat formula | 06 | Starter: 4 CPU, 8 RAM, 100 storage (`content/balance/rig.json`) | PLACEHOLDER | designer | 0 |
| Cyberware upgrade tree | 06 | 2 items: +2 RAM, +1 CPU | PLACEHOLDER | designer | 4 |
| Bandwidth stat effect | 06 | Cosmetic / scan +0% at MVP | PLACEHOLDER | designer | 4 |
| Fleet size cap | 06 | Unlimited | RESOLVED | spec | — |
| Cyberware loss on prison | 06 | No loss at MVP | PLACEHOLDER | designer | 3 |
| Siege resolution formula | 06, 08 | See balance-v0 `siege.json` | PLACEHOLDER | designer | 5 |

---

## Hacking and Tools

| Item | Spec ref | Suggested MVP | Status | Owner | Stage |
|------|----------|---------------|--------|-------|-------|
| Trace speed formula | 03 | balance-v0 `trace.json` | PLACEHOLDER | designer | 3 |
| MVP tool catalog list | 07, 15 | 6 tools in `content/tools/mvp-tools.json` | RESOLVED | eng | 0 |
| Virus craft time formula | 07 | 30 min base × level (`virus.json`) | PLACEHOLDER | designer | 5 |
| Virus craft resource cost | 07 | Time only at MVP | PLACEHOLDER | designer | 5 |
| Full virus effect catalog | 07 | 1 damage effect | RESOLVED | spec | 5 |
| Exfil bandwidth delay | 11 | Instant exfil | PLACEHOLDER | eng | 3 |

---

## Authorities and Factions

| Item | Spec ref | Suggested MVP | Status | Owner | Stage |
|------|----------|---------------|--------|-------|-------|
| Heat decay rate per tick | 09 | -1 per tick, floor baseline (`heat.json`) | PLACEHOLDER | designer | 4 |
| Escalation ladder | 09 | 1.5× timer per repeat offense | PLACEHOLDER | designer | 3 |
| Faction trace modifiers | 09 | Gov 0.7× time, shady 1.2× | PLACEHOLDER | designer | 3 |
| Hospital equipment loss | 09 | Fine only at MVP | PLACEHOLDER | designer | 3 |
| Prison market block | 09 | Block purchases | PLACEHOLDER | designer | 1 |
| Corporate counter-hack | 09 | Trace only | POST-MVP | — | — |
| Faction tick events | 09 | Not in MVP | POST-MVP | — | — |

---

## Economy

| Item | Spec ref | Suggested MVP | Status | Owner | Stage |
|------|----------|---------------|--------|-------|-------|
| Passive fleet income rate | 10 | 10 crypto/drone/tick (`economy.json`) | PLACEHOLDER | designer | 4 |
| Upkeep rate | 10 | 5 crypto/drone/tick (`economy.json`) | PLACEHOLDER | designer | 4 |
| Stock trading for players | 10 | Hooks only; no player profit | PLACEHOLDER | designer | 4 |
| Hook generation rules | 10 | >10% drop triggers contract | PLACEHOLDER | designer | 4 |
| Inflation control | 10 | Track in spreadsheet | POST-MVP | designer | 7 |
| Bribes | 10 | Not in MVP | POST-MVP | — | — |
| NPC contract board scope | 10 | Landmark contracts only | PLACEHOLDER | designer | 4 |

---

## PvP and Recon

| Item | Spec ref | Suggested MVP | Status | Owner | Stage |
|------|----------|---------------|--------|-------|-------|
| Recon tool reliability | 08 | 40% reveal owner | PLACEHOLDER | designer | 5 |
| Partial siege outcomes | 08 | Binary win/loss at MVP | PLACEHOLDER | designer | 5 |
| Siege spoils crypto | 08 | None at MVP | PLACEHOLDER | designer | 5 |
| Player bounties | 08 | POST-MVP | POST-MVP | — | — |

---

## UI and UX

| Item | Spec ref | Suggested MVP | Status | Owner | Stage |
|------|----------|---------------|--------|-------|-------|
| Process manager packaging | 13 | Panel inside Hardware | PLACEHOLDER | designer | 6 |
| Window layout persist | 13 | localStorage yes | PLACEHOLDER | designer | 6 |
| Keyboard shortcuts | 13 | Ctrl+1..5 focus windows | PLACEHOLDER | designer | 6 |
| Min viewport | 13 | 1280×720 | PLACEHOLDER | designer | 6 |
| Accessibility | 13 | High contrast trace | PLACEHOLDER | designer | 6 |

---

## Technical (see also 17-open-decisions.md)

| Item | Spec ref | Status | Stage |
|------|----------|--------|-------|
| Frontend framework | 17 | RESOLVED — React + TypeScript | 0 |
| Windowing library | 17 | RESOLVED — flexlayout-react | 0 |
| Real-time transport | 17 | RESOLVED — WebSockets | 0 |
| Database architecture | 17 | RESOLVED — PostgreSQL + Redis | 0 |
| Event sourcing scope | 17 | RESOLVED — audit trail only | 0 |
| Session state placement | 17 | RESOLVED — game-api + Redis | 0 |
| OAuth providers | 17 | RESOLVED — GitHub + Google | 0 |
| Backend language | 17 | RESOLVED — TypeScript monorepo | 0 |
| Cloud provider | 17 | RESOLVED — Fly.io | 0 |
| Rate limit thresholds | 16 | PLACEHOLDER | 1 |
| Monetization | 17 | POST-MVP | — |

---

## Resolution Workflow

1. Designer fills **Suggested MVP** column or overrides in content files.  
2. Mark **RESOLVED** with date in this file.  
3. Copy final **Decision:** line into relevant spec doc per [17-open-decisions.md](../spec/17-open-decisions.md) Decision Log.
