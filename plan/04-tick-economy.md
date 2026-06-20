# Stage 4 — Tick Economy

**Goal:** 15-minute world simulation: scans, passive income, market, stocks, heat decay, contracts, offline progress.

**Prerequisites:** Stages 1–2  
**Blocks:** Full MVP loop, Stage 5 siege resolution ticks  
**Spec refs:** [02-core-gameplay-loop.md](../spec/02-core-gameplay-loop.md), [10-economy-and-market.md](../spec/10-economy-and-market.md), [11-progression-and-loot.md](../spec/11-progression-and-loot.md)

**Status:** In progress — core merged [PR #4](https://github.com/willcipriano/Port-0/pull/4) (2026-06-20). Stocks, contracts, L2 catalog, and progression sim remain.

---

## 4.1 Tick Pipeline

Implement ordered sub-steps from spec:

```
TickStart → DeliverScans → PassiveIncome → DeductUpkeep → UpdateMarketPrices
         → MoveStocks → DecayHeat → GenerateMissionHooks → ResolveSieges → TickEnd
```

**Tasks:**

- [ ] Tick orchestrator with step timing metrics
- [ ] Transaction per account batch where possible; single world transaction for heat/stocks
- [ ] Write `tick_id` completion marker
- [ ] Notify connected clients: `tick_summary` with balance changes, scan results, contract updates
- [ ] Offline players: all results visible on next `GET /me/sync`

---

## 4.2 Scanning

**Tasks:**

- [ ] `POST /scans` — queue subnet scan (requires rig scanner tool installed)
- [ ] Scan queue table: account_id, subnet_id, queued_at, resolves_at_tick
- [ ] On tick: compute results — pick K random undiscovered or all public machines per config
- [ ] Result payload: IPv6 list, partial OS fingerprint, zone context — **no ownership**
- [ ] Scan speed modifier from rig CPU + scanner tool tier
- [ ] One queued scan per account at MVP (expand later)

**Acceptance:** Scan queued → next tick delivers IPv6 list to account.

---

## 4.3 Economy Core

**Currency:**

- [ ] Single crypto balance on account; all mutations server-side
- [ ] Transaction log: amount, reason, tick_id, timestamp

**Income (tick):**

- [ ] Passive fleet income: sum over owned drones × rate from `content/balance/economy.json`
- [ ] Contract payouts (4.6)
- [ ] Loot sale: `POST /inventory/sell` instant or tick-batched (pick one)

**Sinks (tick or instant):**

- [ ] Drone upkeep per tick
- [ ] Market purchases instant with balance check
- [ ] Fines applied on hospital/prison (real-time, not tick)

---

## 4.4 NPC Market

**Tasks:**

- [ ] Catalog from `content/market/*.yaml`: tools, security software, cyberware
- [ ] `GET /market` — current prices
- [ ] `POST /market/purchase` — add to rig inventory or drone config
- [ ] Price fluctuation on tick: simple random walk or demand-based v0
- [ ] Security software items apply to drone hardening (raise component levels)

**MVP catalog minimum:**

- [ ] L1 scanner, cracker, trace blocker, port opener, recon
- [ ] L2 versions of cracker and trace blocker (progression path)
- [ ] 2 security software items (firewall bundle, AV)
- [ ] 1–2 cyberware upgrades (RAM+, CPU+)

---

## 4.5 Stocks and Mission Hooks

**Tasks:**

- [ ] 3–5 fictional stocks in `content/stocks.yaml`
- [ ] Random walk on tick; store price history
- [ ] Hook rule v0: if stock drops > X% in one tick → spawn contract on landmark or random corp machine
- [ ] Contract appears in player email/contract list

**Acceptance:** Forced test tick produces at least one hook in staging.

---

## 4.6 NPC Contracts

**Tasks:**

- [ ] Contract schema: id, title, target (ipv6 or landmark), action, payout, faction, time_limit_ticks
- [ ] Landmark contract giver: accept contract → active on account
- [ ] Completion detection:
  - Exfil specific file path
  - Gain access (session flag)
  - Maintain foothold (own machine) — post-MVP simplify
- [ ] Payout on tick when conditions met
- [ ] Failure consequences optional v0

**Bob's Plumbing contract (example):**

- [ ] Target: landmark IPv6
- [ ] Action: exfil `/var/customers.db`
- [ ] Payout: 500 crypto on tick completion

---

## 4.7 Heat Decay

- [ ] Subnet heat -= decay_rate per tick (from balance config)
- [ ] Floor at baseline
- [ ] Expose heat in scan/subnet API for UI (optional hidden at MVP)

---

## 4.8 Progression Loop Validation

Simulate new player economy path:

1. Starting crypto (config: enough for L1 cracker + trace blocker)
2. Hack L1 shady targets → exfil → sell
3. Buy L2 tools
4. Passive income from 1–2 claimed drones after several ticks

- [ ] Spreadsheet or automated sim test for balance-v0 sanity

---

## Acceptance Criteria (Stage 4 Complete)

- [ ] Tick runs all sub-steps idempotently
- [ ] Queued scan delivers results on next tick
- [ ] Market purchase deducts crypto and grants tool
- [ ] Passive income and upkeep apply per owned drone
- [ ] Stock move generates contract hook (test harness)
- [ ] Contract completion pays crypto on tick
- [ ] Offline account accrues tick results correctly on login sync

**Exit:** [05-pvp-sieges.md](05-pvp-sieges.md); client market/email surfaces ([06-client-ui.md](06-client-ui.md))
