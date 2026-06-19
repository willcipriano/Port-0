# Rig and Fleet

> Status: Draft | Last updated: 2026-06-19

## Overview

Port 0 distinguishes the **personal rig** (untouchable operator machine) from **drone servers** (network assets). Power comes from both, asymmetrically.

## Personal Rig

**Decision:** The rig is untouchable. It cannot be hacked, sieged, or captured. It is not a regular server on the network — it is the player's operator console with substantially more individual capability than any single drone.

### Stat model

**Decision:** Hybrid — base rig stats + installed software + cyberware upgrades.

| Stat | Role | Notes |
|------|------|-------|
| CPU | Processing capacity | Affects tool speed, concurrent CPU-heavy operations |
| RAM | Working memory | Limits concurrent running tools |
| Storage | Local capacity | Rig inventory, cached loot, tool storage |
| Bandwidth | Connection throughput | Scan speed, session latency `[TBD — owner: designer]` |

Base stat formula: `[TBD — owner: designer]`

Cyberware upgrade tree: `[TBD — owner: designer]`

### Rig vs single drone

A hacker operating from the rig can compromise targets that a single drone could not. A drone cannot hack itself — it requires coordinated fleet resources or direct rig intervention for offensive operations.

A skilled hacker with the right virus can take down a multi-node network from the rig. Fleet owners rely on numbers.

## Drone Servers

**Decision:** Unlimited fleet size. No hard cap or diminishing returns defined yet.

Drones are standard machines on the network. When claimed, the player holds **full ownership** — root access, reconfiguration, resource contribution to fleet operations.

### Resource mapping

| Drone resource | Fleet combat role |
|----------------|-------------------|
| CPU | Attack power |
| RAM | MP pool (sustained operations, tool hosting on drones) |
| Storage | HP (data integrity, survivability under siege) |

Individual drones are weak. Aggregated fleet stats drive siege resolution.

See [08-pvp-and-sieges.md](08-pvp-and-sieges.md).

### Drone offensive capability

A single drone lacks sufficient processing to mount an effective hack against even modest targets. Offensive operations require:

- Multiple drones contributing combined CPU/RAM, or
- Rig-direct intervention, or
- Virus deployment from a compromised staging node

## Fleet Management

Players configure each drone after claim:

- Installed security software (from NPC market)
- Firewall rules, port configuration
- Password levels on services
- Assigned role (staging node, mining/passive income, defensive buffer)

**Decision:** Player-configured hardening — no automatic lockdown on claim.

## Home Node Clarification

The rig is **not** an IPv6 address on the public network. It is an abstract operator station that connects outward. Drone servers **are** public IPv6 machines with ownership tracked in the central registry.

## Loss Rules

**Decision:** Full stakes except home rig.

| Asset | Can be lost? |
|-------|-------------|
| Rig | No |
| Drone servers | Yes — siege, failed defense, authority seizure |
| Installed tools | Yes — confiscation on prison, theft on compromise |
| Crypto | Yes — fines, theft, market costs |
| Cyberware | `[TBD — owner: designer]` |

## Scaling Path

Fleet size unlimited at design level. Upkeep and maintenance costs (see [10-economy-and-market.md](10-economy-and-market.md)) provide economic pressure at scale without a hard cap.

Siege resolution formula: `[TBD — owner: designer]`

Inputs: attacker fleet aggregate stats, defender fleet stats, installed defenses, active countermeasures during interactive defense window.
