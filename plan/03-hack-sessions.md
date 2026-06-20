# Stage 3 — Hack Sessions

**Goal:** Server-authoritative real-time intrusion: connect, trace pressure, tools, shell, claim, and authority consequences.

**Prerequisites:** [02-world-and-machines.md](02-world-and-machines.md)  
**Blocks:** Stage 5, client wire-up  
**Spec refs:** [03-hacking-and-trace.md](../spec/03-hacking-and-trace.md), [07-tools-and-viruses.md](../spec/07-tools-and-viruses.md), [09-authorities-and-factions.md](../spec/09-authorities-and-factions.md)

**Status:** Complete — merged [PR #3](https://github.com/willcipriano/Port-0/pull/3) (2026-06-20)

---

## 3.1 Session Lifecycle

**States** (implement state machine from spec):

```
Connected → Tracing → AccessGained → Secured → Claimed | Disconnected | Caught
```

**Tasks:**

- [x] `connect_to_ipv6`: validate target exists, account not locked, create session in Redis
- [x] Return: session_id, shell prompt, initial access level (guest unless shortcut)
- [x] Entry point detection: connecting may trigger alarm immediately or after threshold
- [x] `disconnect`: clean up session; no claim if not secured
- [x] `abort`: player flee; may still trigger trace consequences if alarm active *(MVP: clean disconnect; catch only on trace expiry)*
- [x] Session timeout: idle disconnect after configurable minutes
- [x] One active hack session per account (MVP simplification)

**WebSocket protocol messages:**

| Client → Server | Server → Client |
|-----------------|-----------------|
| connect | session_started |
| shell_command | shell_output |
| run_tool | tool_started, tool_progress |
| cancel_tool | tool_cancelled |
| claim | claim_result |
| disconnect | session_ended |

- [x] Push trace updates at least every 1s while tracing

---

## 3.2 Trace and Alarm

**Tasks:**

- [x] Alarm daemon process on machine; `tracing` flag on session when triggered
- [x] Trace countdown: server-side `trace_expires_at` (wall clock)
- [x] On expiry → `Caught` → apply faction consequence (Stage 3.5)
- [x] Trace speed formula v0 in `content/balance/trace.json`:

  ```
  effective_seconds = base_seconds * heat_multiplier * faction_multiplier
  (+ blocker pauses/extends deadline while running)
  ```

- [x] Failed exploit attempts accelerate trace (configurable bump)
- [x] Subnet heat read from world_state; contribute heat on catch
- [x] Disable alarm via shell → stop trace extension; session → Secured if root

**Acceptance:** Spec worked example achievable — cracker too slow, blocker extends trace, crack succeeds, alarm disabled before expiry.

---

## 3.3 Tool System

**Tasks:**

- [x] Load tool catalog from `content/tools/*.json` *(YAML also supported via content loader)*
- [x] Rig resource pool: CPU/RAM from account rig + cyberware
- [x] `run_tool`: validate tool owned (installed on rig), level ≥ target component, resources available
- [x] Running tools stored on session; progress computed server-side
- [x] CPU share affects completion rate; duration depends on level delta
- [x] `cancel_tool` frees resources
- [x] On completion: apply effect (password cracked → access upgrade, port opened, etc.)

**MVP tool minimum:**

| Tool | Category | Target |
|------|----------|--------|
| subnet_scanner | scanner | subnet (tick queue — Stage 4) |
| password_cracker_l1 | cracker | password L1 |
| trace_blocker_l1 | trace_blocker | active trace |
| port_opener_l1 | exploit | firewall L1 |
| recon_probe | recon | ownership hint |
| log_cleaner_l1 | log_cleaner | post-access |

- [x] Task manager state exposed via WS: running tools, progress %, RAM/CPU bars

---

## 3.4 Security Level Gating

- [x] Reject tool if `tool.max_security_level < target.component_level`
- [x] Clear client error: "Insufficient tool level"
- [x] Layered entry: shortcuts (backdoor) bypass password tool if archetype allows and not patched

---

## 3.5 Consequences (Hospital / Prison)

On `Caught`:

- [x] Determine faction from target machine
- [x] Apply punishment per [09-authorities-and-factions.md](../spec/09-authorities-and-factions.md):

| Faction | Punishment |
|---------|------------|
| Shady / criminal | Hospital timer + fine |
| Government / legit | Prison timer + fine + tool confiscation |

- [x] Set `account.status` + `status_expires_at` (real-time)
- [x] Confiscation: remove random or all illegal tools from rig inventory (config)
- [x] End session; notify client with fiction message

**Escalation v0:** repeat offenses multiply timer (simple counter on account)

---

## 3.6 Loot Exfiltration (Basic)

- [x] `exfil_file` command or tool: copy file from target filesystem to rig storage
- [x] MVP: instant exfil for small files; optional bandwidth delay post-MVP
- [x] Loot items stored on account; types: data, credentials, source_code

---

## 3.7 Anti-Cheat and Validation

- [x] All tool timing server-side; ignore client progress claims
- [x] Shell commands validated against session access level and archetype
- [x] Rate limit commands per second per session
- [x] Log session replay fields for debug (session_id, commands, outcome)

---

## 3.8 Integration Tests

- [x] Happy path: L1 target → tools → root → disable alarm → claim
- [x] Trace fail: timer expires → hospital on shady target
- [x] Trace fail: timer expires → prison on gov target *(via faction mapping test)*
- [x] Insufficient RAM: second tool rejected
- [x] Wrong tool level rejected

---

## Acceptance Criteria (Stage 3 Complete)

- [x] WebSocket hack session end-to-end without client (automated test)
- [x] Trace timer visible via pushed updates; expiry triggers correct punishment
- [x] Multiple concurrent tools with resource limits
- [x] Claim only after root + secured (alarm off) — or document if claim allowed with alarm on
- [x] Spec worked example passes in integration test

**Exit:** Wire client terminal ([06-client-ui.md](06-client-ui.md)); proceed [04-tick-economy.md](04-tick-economy.md) in parallel
