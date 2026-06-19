# Stage 7 — MVP Ship

**Goal:** Content complete, integration validated, staging playable by outsiders — all eight MVP success criteria pass without developer assistance.

**Prerequisites:** Stages 1–6  
**Spec refs:** [15-mvp-scope.md](../spec/15-mvp-scope.md), [18-content-authoring.md](../spec/18-content-authoring.md), [11-progression-and-loot.md](../spec/11-progression-and-loot.md)

---

## 7.1 Content Pass

**Tasks:**

- [ ] Finalize subnet: machine count, zone flavor text, IPv6 map doc for team
- [ ] 3 landmarks fully authored with contracts and faction tags
- [ ] OS archetypes: command help text, MOTD, at least one loot file per tier
- [ ] Tool catalog complete with prices progression L1 → L2
- [ ] Market catalog balanced for 30-minute new player session
- [ ] 2–3 stock tickers with hook templates
- [ ] Starting crypto + rig stats playtested

**Onboarding (throw-in-deep):**

- [ ] Starting subnet skews shady/low security
- [ ] L1 CheapServer targets discoverable on first scan
- [ ] Affordable L1 tools in market
- [ ] No tutorial overlay — optional `help` command in terminal with fiction tips only

---

## 7.2 Balance Pass (balance-v1)

Replace v0 placeholders with playtested values:

| System | Tuning goal |
|--------|-------------|
| Trace | L1 hack completable with blocker + cracker on starter rig |
| Heat | Noticeable but not punishing in first hour |
| Economy | First tool purchase within ~15–20 minutes |
| Hospital | 5–10 min v0; recoverable |
| Prison | 15–30 min v0; scary enough to avoid early banks |
| Siege | Attacker win possible with 2–3 drones vs 1 undefended |
| Virus craft | 30 min real-time; worth deploying in siege |

- [ ] 3 internal playtests with fresh accounts; capture notes
- [ ] Adjust `content/balance/*` only — no code forks for tuning

---

## 7.3 Integration Test Suite

Automated end-to-end script covering MVP success criteria:

| # | Criterion | Test |
|---|-----------|------|
| 1 | OAuth login | Auth flow test account |
| 2 | Scan subnet | Queue scan, advance tick, assert IPv6 results |
| 3 | Hack L1 under trace | WS session with cracker + blocker |
| 4 | Claim and harden | Claim, raise password level, remove backdoor |
| 5 | Earn crypto, buy tool | Contract or loot sell → market purchase |
| 6 | Hospital or prison | Force trace fail on shady vs gov target |
| 7 | Siege | Two accounts, declare, interactive, resolve |
| 8 | Virus | Craft (time skip in test env), deploy in siege |

- [ ] CI runs against dockerized stack on merge to main
- [ ] Staging smoke test nightly

---

## 7.4 Operational Readiness

**Tasks:**

- [ ] Production environment (or open staging beta)
- [ ] Database backups automated
- [ ] Tick worker monitoring alert if tick missed
- [ ] Rate limits on game-api documented
- [ ] Incident runbook: session stuck, tick failed, rollback deploy
- [ ] Privacy policy + OAuth app verification if using Google
- [ ] Terms of service stub

---

## 7.5 QA Checklist (Manual)

**New player session (45–60 min):**

- [ ] Login smooth on Chrome, Firefox, Edge
- [ ] Scan returns machines within one tick (or show wait UI)
- [ ] Connect to CheapServer, use backdoor or tools
- [ ] Trace pressure feels tense; blocker clearly helps
- [ ] Claim server appears in fleet
- [ ] Hardening changes difficulty on re-hack (self-test alt account)
- [ ] Contract from landmark completable
- [ ] Buy L2 tool from market
- [ ] Get hospitalized on criminal target fail
- [ ] Second account sieges first account's drone
- [ ] Virus craft timer shows; deployment affects siege

**Edge cases:**

- [ ] Disconnect mid-hack → session cleanup
- [ ] Login during prison → blocked actions explained
- [ ] Two players claim same unowned machine race
- [ ] WebSocket reconnect during trace

---

## 7.6 Launch Modes

Pick one for MVP release:

| Mode | Requirements |
|------|--------------|
| **Closed alpha** | Invite list, staging URL, feedback channel |
| **Open staging** | Public URL, wipe policy documented |
| **Production MVP** | Prod deploy + basic monitoring |

- [ ] Decide wipe policy for world regen during alpha
- [ ] Account reset tool for testers

---

## 7.7 Documentation

- [ ] Player-facing: minimal — in-fiction email or readme on landing page
- [ ] Developer: `README` run locally, architecture diagram, content authoring guide
- [ ] Update spec Decision Log for any choices made during build

---

## MVP Done Definition

All items from [15-mvp-scope.md](../spec/15-mvp-scope.md) **MVP Success Criteria** pass via automated + manual QA without undocumented steps.

**Ship checklist:**

- [ ] 8/8 success criteria green
- [ ] No P0 bugs open
- [ ] Staging stable for 48 hours (ticks run, no data corruption)
- [ ] Balance v1 committed to content files
- [ ] Post-MVP backlog captured (zones, P2P market, comms, corporate counter-hack)

---

## Post-MVP Backlog (Capture Only)

| Phase | Features |
|-------|----------|
| PvP polish | Siege balance, recon depth, corporate security |
| Groups | Crews, shared fleets |
| Player economy | P2P market, contracts, escrow |
| Scale | Multi-subnet, partitioning, event sourcing expansion |
| Client | Tauri if skipped, layout shortcuts, accessibility audit |
