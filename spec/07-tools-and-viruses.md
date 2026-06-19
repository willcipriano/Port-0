# Tools and Viruses

> Status: Draft | Last updated: 2026-06-19

## Overview

**Tools** are installable applications on the rig (and optionally drones) that consume resources while running. **Viruses** are crafted payloads with persistent effects, limited uses, and real-time creation timers.

**Decision:** Tools behave like RPG spells. Tools are also installable apps with process semantics. Both concepts apply — a tool is software that runs as a managed process with a spell-like activation model.

## Tool Model

### Catalog schema

Each tool entry defines:

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `name` | Display name |
| `category` | scanner, cracker, exploit, trace_blocker, log_cleaner, recon, etc. |
| `max_security_level` | Highest target component level this tool can attack |
| `ram_cost` | RAM consumed while running |
| `cpu_cost` | CPU share consumed while running |
| `duration` | Fixed or estimated runtime (may depend on target level delta) |
| `target_type` | Component type required (password, firewall, service, etc.) |
| `market_price` | NPC market cost |

### Acquisition

**Decision:** Market-only at launch. All tools purchased from the NPC market if the player has sufficient crypto.

See [10-economy-and-market.md](10-economy-and-market.md), [11-progression-and-loot.md](11-progression-and-loot.md).

### Security level gating

A Password L1 cracker hacks Password L1 systems. To attack Password L3, the player buys a Password L3 cracker (or higher). Same pattern for firewalls, alarms, and other components.

### Process management

Player manages running tools via a task manager UI:

- View active tools, RAM/CPU bars
- Kill or reprioritize processes
- Start new tools if resources allow

See [13-ui-and-ux.md](13-ui-and-ux.md).

## Standard Tool Categories (MVP)

| Category | Function |
|----------|----------|
| Scanner | Subnet and port discovery (tick-based when scanning; rig-powered) |
| Cracker | Defeat password-protected access |
| Exploit | Target service vulnerabilities |
| Trace blocker | Extend trace deadline |
| Log cleaner | Remove evidence post-access |
| Recon | Reveal ownership, fingerprints, hidden data |
| Port opener | Bypass firewall restrictions |

Exact MVP catalog (6 tools): scanner L1, cracker L1, trace blocker L1, port opener L1, recon L1, log cleaner L1. See `content/tools/mvp-tools.json`.

## Viruses

**Decision:** Viruses are like RPG spells with real-time crafting, limited uses, and variant creation from source.

### Crafting

1. Player defines desired **effect** and **effect level**.
2. Server estimates **craft duration** (wall-clock real-time).
3. Player waits (can be offline for craft timer — real-time continues).
4. Finished virus enters inventory with a fixed **use count**.

Craft time formula: `[TBD — owner: designer]`

Inputs: effect type, effect level, rig crafting modifiers.

### Effect categories

**Decision:** All effect types available at design level.

| Category | Examples |
|----------|----------|
| Damage | Degrade storage (HP), destroy data, disable services |
| Control | Spread to adjacent nodes, persist backdoor, grant remote access |
| Disruption | Slow traces, corrupt logs, reduce defender CPU during siege |

### Uses and antivirus

Viruses have a **limited number of uses** before signatures are recognized (antivirus adaptation). After exhaustion, the virus is spent.

### Variants

If the player possesses **source code** (from loot or prior craft), creating a variant of an existing virus takes less time than crafting from scratch. Variants may bypass partial AV detection.

See [11-progression-and-loot.md](11-progression-and-loot.md).

## Tools vs Viruses

| | Tools | Viruses |
|---|-------|---------|
| Use context | Active hack session (real-time) | Deployment from compromised node or rig; siege |
| Resource cost | RAM/CPU while running | Craft time upfront; deployment may cost fleet resources |
| Duration | Session-scoped | Persistent effect over ticks/real-time |
| Reuse | Unlimited while owned | Limited uses per crafted instance |
| Acquisition | NPC market | Player-crafted |

## Deployment in Sieges

Viruses are primary offensive instruments in fleet vs fleet combat. See [08-pvp-and-sieges.md](08-pvp-and-sieges.md).
