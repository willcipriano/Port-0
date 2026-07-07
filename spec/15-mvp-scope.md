# MVP Scope

> Status: Draft | Last updated: 2026-06-19

## Boundary

**Decision:** MVP = one subnet, vertical slice of the full core loop.

MVP proves: scan → discover → connect → hack under trace pressure → claim → harden → earn crypto → expand fleet → siege/defend — in a shared world with other players.

## In Scope

### World

- One subnet in one zone: **Shady Hollow** (residential mixed shady)
- Procedural machines + at least 2–3 handcrafted landmarks (including one contract giver)
- Real IPv6 addressing (`2001:db8:1:7::/64`)
- **300** proc-gen machines + **3** landmarks

### Gameplay

- Rig-powered tick-based scanning
- Real-time hack sessions with trace timer
- Tool system with RAM/CPU limits and task manager
- Full shell sim on 3–5 OS archetypes
- Numeric security component levels
- Claim and player-configured hardening
- Hospital (criminal) and prison (government) consequences
- Subnet heat
- Async siege with interactive defense window
- Hidden ownership with at least 2 recon paths
- Virus crafting (real-time timer) with at least 1 effect type fully implemented
- NPC market (tools, basic security software)
- Single crypto economy with mixed income and basic sinks
- Stock tick movement with at least 1 mission hook type
- Throw-in-deep onboarding

### Player class

- **Operator only** — implicit default; direct hack → claim → fleet loop
- Alternate classes (e.g. **Steamer**, fan-driven fleet) are post-MVP; see [docs/ideas/01-player-classes-steamer.md](../docs/ideas/01-player-classes-steamer.md)

### Multiplayer

- Shared world, solo ops
- No comms, no leaderboards, no groups

### Client

- Web client with multi-surface UI (Uplink classic set)
- Tauri wrapper (can ship web-first if wrapper slips)
- OAuth login
- Minimal SFX

### Backend

- Three services: auth, game-api, tick-worker
- Server-authoritative validation
- Cloud-managed deployment

See [16-technical-architecture.md](16-technical-architecture.md).

## Out of Scope (MVP)

| Feature | Target phase |
|---------|-------------|
| Multiple subnets / zones | Post-MVP |
| Player classes (Steamer, etc.) | Phase 2–3 — [ideas doc](../docs/ideas/01-player-classes-steamer.md) |
| Player-to-player market | Phase 4 |
| Player contracts / escrow | Phase 4 |
| Groups / crews | Phase 3 |
| Chat / comms | Phase 3–4 |
| Leaderboards | Post-MVP |
| Full virus effect catalog | MVP implements 1; rest post-MVP |
| Corporate counter-hack (full) | Post-MVP |
| Designer authoring tools | Post-MVP (config files OK) |
| Event sourcing (full) | Audit trail only at MVP |
| Monetization | Deferred |

## Phased Roadmap

| Phase | Focus |
|-------|-------|
| **MVP** | One subnet, core loop, sieges, NPC market |
| **PvP polish** | Siege balance, recon depth, corporate security |
| **Groups** | Crews, shared fleets, crew comms |
| **Player classes** | Operator vs Steamer (fan-sourced fleet), hybrid crew comps |
| **Player economy** | P2P market, contract board, escrow |
| **Scale** | Multi-subnet, zone expansion, partitioning |

## MVP Success Criteria

MVP is done when a new player can:

1. Log in via OAuth
2. Scan the subnet and discover machines
3. Hack an L1 target under trace pressure using multiple tools
4. Claim and harden a server
5. Earn crypto and buy a better tool
6. Be caught and serve hospital or prison time
7. Participate in a siege (attack or defend)
8. Craft a virus and deploy it in a siege

Without developer intervention or undocumented steps.

## TBD Registry

Items requiring designer input before or during implementation:

| Item | Doc reference |
|------|---------------|
| Rig base stat formula and cyberware tree | [06-rig-and-fleet.md](06-rig-and-fleet.md) |
| Virus craft time: `f(effect, level) → duration` | [07-tools-and-viruses.md](07-tools-and-viruses.md) |
| Trace speed: `f(target_security, countermeasures, rig_power, heat, faction)` | [03-hacking-and-trace.md](03-hacking-and-trace.md) |
| Siege resolution: `f(attacker_fleet, defender_fleet, loadouts, actions)` | [08-pvp-and-sieges.md](08-pvp-and-sieges.md) |
| MVP subnet machine count | [04-world-and-topology.md](04-world-and-topology.md) |
| MVP zone name and character | [04-world-and-topology.md](04-world-and-topology.md) |
| MVP OS archetype names (3–5) | [05-machines-and-shells.md](05-machines-and-shells.md) |
| OAuth provider list | [17-open-decisions.md](17-open-decisions.md) |
| Monetization model | Deferred |
| Escalation ladder (hospital/prison repeat offenses) | [09-authorities-and-factions.md](09-authorities-and-factions.md) |
| Heat decay rate per tick | [09-authorities-and-factions.md](09-authorities-and-factions.md) |
| Passive fleet income rate | [10-economy-and-market.md](10-economy-and-market.md) |
| MVP tool catalog list | [07-tools-and-viruses.md](07-tools-and-viruses.md) |
| Process manager surface packaging | [13-ui-and-ux.md](13-ui-and-ux.md) |
| Landmark IPv6 assignments | [18-content-authoring.md](18-content-authoring.md) |

## Open Technical Decisions

All undecided stack choices live in [17-open-decisions.md](17-open-decisions.md). MVP can proceed once choices are filled in the "Choice" row of each matrix.
