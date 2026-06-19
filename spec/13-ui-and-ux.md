# UI and UX

> Status: Draft | Last updated: 2026-06-19

## Overview

Port 0 uses a **multi-surface** interface — multiple independent windows the player arranges and operates simultaneously. Multitasking across surfaces during trace pressure is core skill expression.

**Decision:** Uplink retro aesthetic — dark, minimal, blue/green terminal palette, high information density.

## MVP Window Set

**Decision:** Uplink classic surfaces at launch.

| Window | Function |
|--------|----------|
| World map | Zone/subnet overview, scan targeting |
| Server list | Discovered and owned machines, IPv6 list |
| Terminal | Shell interaction with connected target |
| Email / contracts | NPC job offers, mission briefings |
| Hardware | Rig stats, cyberware, installed software inventory |

### Post-MVP surfaces (not in MVP)

| Window | Function |
|--------|----------|
| Process manager | Running tools, RAM/CPU bars — **required for MVP hack loop; may ship as panel within Hardware or standalone** |
| Trace monitor | Countdown, heat indicator |
| Market | NPC catalog browser |
| Fleet overview | Aggregate drone stats, siege status |

Note: Process manager functionality is required for MVP even if bundled into another surface. See [03-hacking-and-trace.md](03-hacking-and-trace.md).

MVP surface packaging: `[TBD — owner: designer]` (standalone process manager vs integrated panel)

## Process Manager UX

**Decision:** Task manager style.

- List of running tools with name, target, progress, RAM/CPU usage
- Kill button per process
- Resource bars for total RAM/CPU remaining
- Cannot start tool if resources insufficient — clear error feedback

## Multitasking Design Goals

1. Player can view trace timer while operating terminal
2. Player can start/stop tools without closing shell session
3. Window layout persists between sessions `[TBD — owner: designer]`
4. Keyboard shortcuts for surface switching `[TBD — owner: designer]`

Efficiency under pressure is the skill ceiling.

## Aesthetic Direction

| Element | Direction |
|---------|-----------|
| Background | Dark (#0a–#1a range), near-black |
| Primary text | Green or cyan monospace |
| Accents | Blue for links, red for trace warnings |
| Font | Monospace terminal font |
| Chrome | Minimal window borders, title bars with system names |
| Animation | Subtle — blinking cursor, progress bars, trace pulse |

Should look like the future as imagined from a 2000s hacking game — not modern flat SaaS, not cyberpunk neon overload.

## Platform

**Decision:** Web browser primary, Tauri desktop wrapper.

Web and desktop share the same frontend. Tauri provides native window management and optional OS integration.

**Decision:** React + TypeScript frontend.

**Decision:** flexlayout-react for window docking, tabs, and layout persistence.

## Client Architecture (High Level)

- Thin client — server authoritative
- Real-time updates for hack sessions and trace timers
- Tick updates batched or polled on interval / reconnect
- OAuth login flow before game client loads

See [16-technical-architecture.md](16-technical-architecture.md).

## Accessibility and Input

`[TBD — owner: designer]`

Minimum: readable monospace at default size, high contrast trace warnings.

## Responsive Layout

Desktop-first. Minimum viewport: `[TBD — owner: designer]`. Mobile not in scope.
