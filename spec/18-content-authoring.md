# Content Authoring

> Status: Draft | Last updated: 2026-06-19

## Overview

World content comes from **procedural generation** (most machines) and **handcrafted landmarks** (specific targets). An internal template system defines machine behavior; landmarks override or extend templates.

**Decision:** Procedural + handcrafted. Designer tools for growth deferred but architecture should support template-driven authoring.

## Machine Template Schema

Each machine template defines:

```yaml
# Illustrative — not implementation code
id: cheap_server_residential
os_archetype: cheap_server_os
zone_bias: residential
components:
  password: 1
  firewall: 1
  alarm: 1
filesystem: <template_ref>
services:
  - alarm_daemon
  - ssh
loot_table: residential_low
faction: neutral
```

Exact schema: `[TBD — owner: designer]` during implementation.

See [05-machines-and-shells.md](05-machines-and-shells.md).

## Procedural Generation

Proc-gen fills subnet slots from templates weighted by zone:

| Parameter | Source |
|-----------|--------|
| OS archetype | Zone-weighted table |
| Component levels | Base range per zone + random variance |
| Resources (CPU/RAM/storage) | Range per archetype |
| IPv6 address | Allocated from subnet prefix |
| Loot table | Zone + archetype |

Landmark slots are reserved during generation and filled from landmark definitions instead of proc templates.

MVP machine count: `[TBD — owner: designer]`

## Landmarks

**Decision:** Landmarks serve all purposes — NPC contracts, story missions, unique loot.

### Landmark types

| Type | Purpose | Example |
|------|---------|---------|
| NPC contract giver | Offers repeatable tick-paid jobs | Bob's Plumbing mainframe |
| Story mission | Multi-step scripted arc | `[TBD]` |
| Unique loot | One-time high-value target | `[TBD]` |

### Worked Example: Bob's Plumbing

Hand-placed mainframe in residential zone:

- IPv6: `[TBD — owner: designer]`
- OS: CheapServer OS or Generic Linux
- Faction: neutral/corporate
- Offers contract: "Download customer database, deliver to drop point"
- Payout: crypto on tick completion
- Security: L1–L2 (accessible to new players)

### Placement rules

- At least one contract giver near starting subnet
- Higher-value landmarks in harder zones
- Story landmarks do not respawn once completed `[TBD — owner: designer]`
- Unique loot landmarks may respawn on long tick interval `[TBD]`

## Zone Content Bias

| Zone | Archetype bias | Faction | Heat baseline |
|------|---------------|---------|---------------|
| Residential | CheapServer, Generic Linux | Neutral/shady | Low |
| Corporate | Corp Workstation, Mainframe | Corporate | Medium |
| Government | Mainframe, hardened Linux | Government | High |
| Darkweb | CheapServer, custom | Shady/criminal | Low trace, high criminal |

MVP includes subset of zones. Full table: `[TBD — owner: designer]`

## Contract Definitions

NPC contracts reference:

- Target IPv6 or landmark ID
- Required action (exfil file, gain access, maintain foothold)
- Payout amount
- Time limit (ticks or real-time) `[TBD]`
- Faction consequence on failure

## Authoring Workflow (Future)

Internal editor or DSL for:

- Defining OS archetypes and shell response tables
- Placing landmarks in subnet grid
- Writing contract chains
- Balancing loot tables

Not in MVP implementation scope. MVP landmarks can be hand-authored in config files.

## Scaling Content

As subnets are added:

- Proc-gen fills new subnets from existing templates
- New landmarks placed per zone design doc
- No manual per-machine authoring required

See [04-world-and-topology.md](04-world-and-topology.md), [15-mvp-scope.md](15-mvp-scope.md).
