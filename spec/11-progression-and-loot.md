# Progression and Loot

> Status: Draft | Last updated: 2026-06-19

## Overview

Progression is horizontal and economic — better tools, larger fleets, harder targets. No character level system defined. Power comes from rig upgrades, software inventory, fleet size, and player skill.

## Tool Progression

**Decision:** Market-only. Purchase tools from the NPC market with crypto.

Progression path:

1. Earn crypto from early targets (shady zone, L1 machines)
2. Buy L1 tools (scanner, cracker, trace blocker)
3. Access harder zones and targets
4. Buy higher-level tools and cyberware
5. Expand fleet for income and siege capability

No loot-dropped exclusive tools at launch. Source code loot enables faster virus variants, not direct tool unlocks.

See [07-tools-and-viruses.md](07-tools-and-viruses.md), [10-economy-and-market.md](10-economy-and-market.md).

## Loot Types

**Decision:** All loot types in design.

| Type | Use |
|------|-----|
| Data files | Sell on market or turn in for contracts |
| Credentials | Access to other systems (username/password, keys) |
| Source code | Faster virus variant crafting |

Loot tables vary by OS archetype, zone, and landmark. Exact tables: `[TBD — owner: designer]`

### Exfiltration

During or after a hack session, player copies files from target filesystem to rig storage. Exfil may take time and consume bandwidth `[TBD — owner: designer]`. Discovered loot persists in rig inventory.

## Onboarding

**Decision:** Throw in deep. No guided tutorial subnet.

Design constraints for survivable cold start:

- Starting zone skews shady / low-security (hospital risk, not prison)
- L1 targets with CheapServer OS backdoors exist near spawn subnet
- NPC market sells affordable L1 tools
- First landmarks include low-risk contract givers

The player learns by doing. Failure (hospital, lost drone) is expected and recoverable except for reckless bank hacking.

See [04-world-and-topology.md](04-world-and-topology.md), [09-authorities-and-factions.md](09-authorities-and-factions.md).

## Cyberware Progression

Cyberware upgrades modify rig base stats. Upgrade tree: `[TBD — owner: designer]`

Purchased from NPC market. Permanent once installed `[TBD — can cyberware be lost?]`.

See [06-rig-and-fleet.md](06-rig-and-fleet.md).

## Fleet as Progression

Unlimited drones. Fleet size is its own progression axis — more nodes, more aggregate power, more upkeep cost.

See [06-rig-and-fleet.md](06-rig-and-fleet.md).

## Reputation

Persistent account identity. Faction reputation tracks: `[TBD — owner: designer]`

Not in MVP scope as a visible system unless needed for market gating.

## What Progression Is Not

- No XP bar or character levels (unless added later)
- No class system
- No gear rarity tiers (unless added to market catalog later)

Power = tools + rig + fleet + skill.
