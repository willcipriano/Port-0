# Authorities and Factions

> Status: Draft | Last updated: 2026-06-19

## Overview

Consequences for failed or detected hacking depend on **who owns the target** and **subnet heat**. The authority system creates risk gradients across the world — not all targets are equal.

## Trace and Heat

### Per-target trace

Each machine's alarm daemon runs a wall-clock trace when intrusion is detected. See [03-hacking-and-trace.md](03-hacking-and-trace.md).

### Subnet-wide heat

**Decision:** Activity in a subnet raises regional heat. Higher heat:

- Accelerates trace timers within the subnet
- Increases faction attention (more aggressive responses)
- May spawn faction-specific events on tick `[TBD — owner: designer]`

Heat decay per tick: `[TBD — owner: designer]`

## Faction Types

| Faction | Target examples | Authority response | Criminal response |
|---------|----------------|-------------------|-------------------|
| Shady / illegal | Darkweb forums, illegal markets | None or minimal | Retaliation after repeated hits |
| Criminal org | Gang-operated servers | Minimal | Hospital (soft downtime) |
| Corporate | Internal corp networks | Corp security (trace, counter-hack) `[TBD]` | N/A |
| Government / legit | Banks, gov agencies, utilities | Prison (hard lockout) | N/A |
| Player-owned | Any claimed drone | Siege/defense (player PvP) | Optional bounty `[TBD — post-MVP]` |

## Punishment: Hospital (Criminal Retaliation)

Triggered by hacking shady/criminal targets repeatedly or getting caught by criminal counter-intelligence.

**Decision:** Soft downtime — hospital.

| Allowed | Blocked |
|---------|---------|
| Fleet management | Active hacking sessions |
| Market transactions | Siege initiation |
| Scan queue management | Virus deployment |
| Crypto transfers `[TBD]` | |

Timer: **real-time wall-clock**. Continues while offline.

Flavor: "They found you. Hospital time. Money and equipment taken."

Mechanical effects on capture:

- Crypto fine
- Equipment loss/confiscation `[TBD — owner: designer]`
- Real-time hospital timer

## Punishment: Prison (Government)

Triggered by trace completion on government or legitimate corporate/financial targets.

**Decision:** Hard lockout — prison.

| Allowed | Blocked |
|---------|---------|
| View dashboards (read-only) `[TBD]` | All hacking |
| | Fleet offensive actions |
| | Market purchases `[TBD]` |
| | Scan initiation |

Timer: **real-time wall-clock**. Continues while offline.

Mechanical effects on capture:

- Crypto fine (heavier than hospital)
- Tool confiscation
- Reputation impact with factions `[TBD — owner: designer]`
- Real-time prison timer

## Escalation

Escalation ladder: `[TBD — owner: designer]`

Expected pattern:

1. First offense — lighter fine, shorter downtime
2. Repeat offenses — longer timers, heavier asset loss
3. Persistent offending — `[TBD — owner: designer]`

## Faction-Specific Trace Modifiers

Government and financial targets trace faster and impose prison on capture. Shady targets may have slower or no trace but accumulate criminal attention that triggers hospital.

Modifier table: `[TBD — owner: designer]`

## Design Intent

Operating from the shadows means **target selection is a strategic decision**. New players in low-security zones face hospital risk at worst. Hitting a bank before you can disable alarms in time means prison.

Throw-in-deep onboarding (see [11-progression-and-loot.md](11-progression-and-loot.md)) relies on this gradient — starting zones should skew shady/low-security, with dangerous targets discoverable but clearly higher-tier.

## Corporate Security

Corporate targets occupy a middle ground. Full government prison may not apply, but corporate counter-hack and asset seizure are `[TBD — owner: designer]` for MVP vs post-MVP.
