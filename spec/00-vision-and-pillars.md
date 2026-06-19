# Vision and Pillars

> Status: Draft | Last updated: 2026-06-19

## Elevator Pitch

**Port 0** is a multiplayer MMO hacking simulation inspired by the spirit of *Uplink*. Players enter a persistent online network where they take contracts, break into systems, build reputations, upgrade tools, and compete or cooperate with other hackers in real time.

The game focuses on the fantasy of operating from the shadows: tracing targets, hiding identity, exploiting vulnerable servers, stealing data, defending infrastructure, and navigating corporations, criminal groups, security agencies, and rival players.

Unlike a single-player hacking sim, Port 0 is built around a **living shared network**. Player actions affect the world, expose opportunities, create enemies, and shape the underground economy — while preserving the tense, terminal-driven feel of classic hacking games.

## Design Pillars

### 1. Rig vs. Drones

The player operates a **personal rig** — untouchable, individually powerful, upgraded through cyberware and software. **Drone servers** are fleet assets: weak alone, strong in numbers. A single server cannot hack itself; coordinated fleets provide attack power. A skilled hacker can still punch above their weight with luck, tools, and viruses.

See [06-rig-and-fleet.md](06-rig-and-fleet.md).

### 2. Multitasking Under Pressure

Real-time hacking runs on wall-clock timers. Trace pressure, limited RAM/CPU, and multiple UI surfaces mean efficiency is skill expression. The player juggles password crackers, trace blockers, and shell access while the alarm daemon counts down.

See [03-hacking-and-trace.md](03-hacking-and-trace.md), [13-ui-and-ux.md](13-ui-and-ux.md).

### 3. Hybrid Time

**Real-time** for active intrusion sessions (seconds matter). **Tick-based** (15-minute intervals) for economy, scans, offline progress, and world simulation. Different subsystems run on different clocks by design.

See [02-core-gameplay-loop.md](02-core-gameplay-loop.md).

### 4. Layered Depth

Weak targets expose script-kiddy shortcuts (`assume superuser backdoor` on CheapServer OS). Advanced targets require real configuration, forensics, and tool chains. Claimed servers get locked down by their owners — the world gets harder as players secure territory.

See [05-machines-and-shells.md](05-machines-and-shells.md).

### 5. Faction Consequences

Who you hack determines what happens when you fail. Shady illegal targets attract criminal retaliation (hospital). Legitimate banks and corporations trigger government response (prison). Subnet-wide heat accumulates. Consequences are mechanical, not cosmetic.

See [09-authorities-and-factions.md](09-authorities-and-factions.md).

### 6. Living Network

One shared world. Ownership changes hands. Scans reveal new targets. The economy ticks whether you are online or not. Other players shape the map through their claims, losses, and sieges — even when you never speak to them directly.

See [04-world-and-topology.md](04-world-and-topology.md), [12-multiplayer-model.md](12-multiplayer-model.md).

## What Port 0 Is

- A persistent multiplayer hacking MMO with a simulated internet of machines
- A multi-window, terminal-driven operator fantasy
- A game where multitasking, recon, and resource management are core skills
- A shared economy with real stakes (except the home rig)
- A long-term platform designed to scale from one subnet to a global network

## What Port 0 Is Not

- A realistic infosec training tool or CTF platform
- A single-player story game with optional multiplayer
- A game where the home base can be destroyed
- A chat-first social MMO (no comms at launch)
- A pay-to-win live service (monetization **Open:** deferred — see [17-open-decisions.md](17-open-decisions.md))

## Platform Summary

| Area | **Decision** |
|------|-------------|
| Client | Web browser + Tauri desktop wrapper |
| Auth | OAuth |
| Hosting | Cloud-managed |
| Source | Closed source |
| MVP | One subnet, vertical slice of full loop |

See [15-mvp-scope.md](15-mvp-scope.md), [16-technical-architecture.md](16-technical-architecture.md).
