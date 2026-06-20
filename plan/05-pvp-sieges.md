# Stage 5 — PvP, Sieges, and Viruses

**Goal:** Fleet management, async sieges with interactive defense, virus craft/deploy, and recon for hidden ownership.

**Prerequisites:** Stages 2–4; Stage 3 for shared session infra  
**Blocks:** MVP success criteria 7–8  
**Spec refs:** [06-rig-and-fleet.md](../spec/06-rig-and-fleet.md), [08-pvp-and-sieges.md](../spec/08-pvp-and-sieges.md), [07-tools-and-viruses.md](../spec/07-tools-and-viruses.md)

---

## 5.1 Fleet Model

**Tasks:**

- [x] `GET /fleet` — list owned machines (IPv6, resources, roles, aggregate stats)
- [x] Aggregate stats: sum CPU → attack, sum RAM → MP pool, sum storage → HP
- [x] Assign role per drone: staging, passive_income, defensive (tags only at MVP)
- [x] Rig is NOT in fleet list; separate `GET /rig`
- [x] Fleet config mutations only when not in prison (offensive block)

**Acceptance:** Claiming two drones updates fleet aggregates correctly.

---

## 5.2 Recon and Hidden Ownership

**Minimum 2 recon paths** ([08-pvp-and-sieges.md](../spec/08-pvp-and-sieges.md)):

| Path | Implementation |
|------|----------------|
| Recon tool | `run_tool` recon_probe during hack; probability roll → owner handle or "unknown" |
| Log analysis | Specific files on L2+ machines contain owner fingerprint strings |

- [x] No owner field in public machine list or registry API
- [x] Recon results stored on account intel map: `ipv6 → owner_hint, confidence`
- [ ] Optional v0: registry intercept as landmark-only Easter egg

---

## 5.3 Siege Declaration

**Tasks:**

- [x] `POST /sieges` — attacker selects target IPv6 (must be player-owned drone)
- [x] Validate: attacker has intel or met minimum recon (config: allow siege without recon at MVP for testing — disable in prod)
- [x] Commit resources: allocated fleet CPU/RAM, selected viruses
- [x] Create siege record: phases `declared → interactive → resolving → complete`
- [x] Notify defender via WS push + tick email surface

**Restrictions:**

- [x] Cannot siege rig (enforce — rigs have no IPv6 on public network)
- [x] Attacker cannot be in hospital/prison

---

## 5.4 Interactive Window

**Duration:** config `interactive_window_minutes` (suggest 5)

**Attacker actions (real-time WS):**

- [x] Deploy virus to specific node
- [x] Escalate exploit (consumes fleet CPU)
- [x] Target specific defender drone

**Defender actions:**

- [x] Activate countermeasure (consumes MP)
- [x] Isolate node (remove from aggregate temporarily)
- [x] Run defensive tool from installed security software

- [x] Both sides see siege dashboard state updates
- [x] Defender offline: auto-resolve with defender AI v0 (passive defenses only)

---

## 5.5 Siege Resolution

**On tick after interactive window closes:**

- [x] Resolution formula v0 in `content/balance/siege.json`:

  ```
  attack_power = attacker_cpu + virus_effects
  defense_power = defender_cpu + firewall_levels + countermeasures
  outcome_score = attack_power - defense_power
  ```

- [x] Outcomes:
  - Attacker win → ownership transfer of target drone(s)
  - Defender win → attacker loses deployed virus uses
  - Partial → damage without transfer (optional v0: skip, binary win/loss)
- [x] Audit log + notify both parties
- [ ] Spoils: crypto transfer v0 optional

**Acceptance:** Two test accounts — siege changes ownership on attacker win.

---

## 5.6 Virus System

**Crafting (real-time):**

- [x] `POST /viruses/craft` — effect type, level
- [x] Server returns `finishes_at` wall-clock timestamp
- [x] Craft continues offline
- [x] On complete: inventory item with use count

**MVP: one fully implemented effect type** — suggest **Damage: degrade storage (HP)**

- [x] Deployment during siege reduces defender storage aggregate
- [x] Antivirus level reduces effectiveness
- [x] Limited uses (3); then virus spent

**Variants:**

- [x] If account owns `source_code` loot matching virus family → reduced craft time

---

## 5.7 Multi-Player Testing Harness

- [x] Staging script: create 2 accounts, each claim a drone, run siege end-to-end
- [ ] Load test: 10 concurrent interactive sieges (smoke)

---

## Acceptance Criteria (Stage 5 Complete)

- [x] Player A can recon or infer Player B's drone ownership
- [x] Siege notification reaches defender in real time
- [x] Interactive window accepts actions from both sides
- [x] Tick resolves siege; ownership transfers on attacker win
- [x] Virus craft completes after real-time wait; deployable in siege
- [x] Rig cannot be targeted by siege API (400 error)

**Exit:** [06-client-ui.md](06-client-ui.md) siege UI; [07-mvp-ship.md](07-mvp-ship.md)
