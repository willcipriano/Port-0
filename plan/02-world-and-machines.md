# Stage 2 — World and Machines

**Goal:** One generated subnet, central registry, OS archetypes, and server-side shell simulation sufficient for L1–L3 targets.

**Prerequisites:** [01-foundation.md](01-foundation.md) ✓ (merged 2026-06-19)  
**Blocks:** Stages 3, 4, 5  
**Spec refs:** [04-world-and-topology.md](../spec/04-world-and-topology.md), [05-machines-and-shells.md](../spec/05-machines-and-shells.md), [18-content-authoring.md](../spec/18-content-authoring.md)

**Status:** Ready to start

## 2.1 World Configuration

**Tasks:**

- [ ] Define MVP subnet in `content/subnet/mvp.yaml`:
  - Zone name and theme (residential/mixed)
  - IPv6 prefix (e.g. `2001:db8:1:1::/64`)
  - Machine count target
  - Heat baseline
  - Landmark slot reservations
- [ ] World bootstrap job: generate subnet on first deploy or via admin command
- [ ] Store subnet-level heat in `world_state` table

**Acceptance:** Single subnet exists with configured prefix; heat initialized to baseline.

---

## 2.2 Procedural Generation

**Tasks:**

- [ ] Template loader from `content/archetypes/*.yaml`
- [ ] Weighted selection: OS archetype, component levels, resources (CPU/RAM/storage)
- [ ] IPv6 allocator: sequential or seeded random within prefix; collision-free
- [ ] Reserve landmark addresses before filling proc-gen slots
- [ ] Deterministic seed option for reproducible dev/staging worlds

**Proc-gen parameters (placeholder until TBD):**

| Parameter | Suggested MVP |
|-----------|---------------|
| Machine count | 300 |
| L1 bias | 60% CheapServer, 30% Generic Linux, 10% other |
| Component range L1 | password/firewall/alarm 1–2 |

- [ ] Unit tests: generation count, unique IPv6, landmark slots preserved

---

## 2.3 OS Archetypes (MVP: 3–5)

Implement minimum set from spec:

| Archetype | Tier | MVP priority |
|-----------|------|--------------|
| CheapServer OS | L1 | P0 — backdoor path |
| Generic Linux | L2 | P0 |
| Corp Workstation | L3 | P1 |
| Mainframe | L4 | P2 (1–2 landmarks only) |

**Per archetype, define in content:**

- [ ] Shell command allowlist and response table
- [ ] Default services (alarm_daemon, ssh, …)
- [ ] Default component levels
- [ ] Default filesystem template (dirs, motd, logs, fake credentials)
- [ ] Faction default
- [ ] Loot table reference

**Acceptance:** CheapServer responds to `assume superuser backdoor` with root access per spec example.

---

## 2.4 Machine State Model

Server-side state ([05-machines-and-shells.md](../spec/05-machines-and-shells.md)):

- [ ] Persist: ipv6, os_archetype, components (password/firewall/alarm/encryption/av), filesystem JSON, processes, resources, faction
- [ ] Ownership: nullable `owner_account_id` in registry; **never expose in public API**
- [ ] Public fingerprint API: OS hint, open ports, partial banner — no owner

**Security components:**

- [ ] Numeric levels L1–L5 per component type
- [ ] Validation helpers: `canToolAttack(toolLevel, componentLevel)`

---

## 2.5 Shell Simulation Engine

**Tasks:**

- [ ] Command parser: tokenize input; match against archetype command table
- [ ] Access levels: guest vs root; enforce on sensitive commands
- [ ] Side effects:
  - `cat`, `ls`, `cd` — read filesystem
  - `run` — interact with services
  - `kill` / disable — stop alarm_daemon (sets alarm inactive)
  - Admin commands gated by access level
- [ ] Output generator: deterministic text responses from templates
- [ ] Shell session scoped to hack session (see Stage 3)

**Progressive depth:**

| Tier | Commands (minimum) |
|------|-------------------|
| L1 | help, ls, cd, cat, run, assume |
| L2 | + ps, netstat, sudo (limited), service control |
| L3 | + log paths, audit forensics hooks |

- [ ] Reject unknown commands with in-fiction error
- [ ] No arbitrary code execution — pattern match only

**Acceptance:** Integration test: L1 hack path from connect → backdoor → disable alarm via shell.

---

## 2.6 Central Registry

**Tasks:**

- [ ] Atomic claim: `UPDATE machines SET owner = :account WHERE ipv6 = :ip AND owner IS NULL` (or transfer rules)
- [ ] Claim requires active hack session with root access
- [ ] Hardening mutations:
  - Set password level
  - Install firewall rules / level
  - Remove backdoor files from filesystem template
  - Install security software (refs market catalog IDs)
- [ ] Audit log every ownership change

**Acceptance:** Two concurrent claim attempts → one succeeds; audit entry exists.

---

## 2.7 Landmarks (2–3 minimum)

Hand-author in `content/landmarks/`:

| Landmark | Purpose | Priority |
|----------|---------|----------|
| Bob's Plumbing (or equivalent) | Contract giver, L1–L2 | P0 |
| Shady forum / illegal market | Hospital faction demo | P1 |
| Bank or gov workstation | Prison faction demo (harder) | P1 |

Each landmark file:

- [ ] Fixed IPv6
- [ ] OS + component overrides
- [ ] Custom filesystem snippets
- [ ] Contract definition stub (wired in Stage 4)
- [ ] Faction tag

---

## 2.8 Admin / Dev Tools

- [ ] CLI: `world regen`, `world show-machine <ipv6>`, `account grant-crypto`
- [ ] Not player-facing; dev and staging only

---

## Acceptance Criteria (Stage 2 Complete)

- [ ] Subnet bootstraps with N machines + landmarks at fixed addresses
- [ ] Public API returns machine fingerprint without owner
- [ ] CheapServer backdoor grants root; hardened machine has backdoor removed
- [ ] Shell commands update machine state (alarm disable persists)
- [ ] Claim transfers ownership atomically
- [ ] At least 3 OS archetypes with distinct command sets

**Exit:** [03-hack-sessions.md](03-hack-sessions.md)
