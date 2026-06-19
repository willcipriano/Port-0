# Machines and Shells

> Status: Draft | Last updated: 2026-06-19

## Overview

Each machine on the network is a **full shell simulation** — filesystem, processes, users, logs, and services. Shell depth and complexity scale with OS archetype and owner hardening.

**Decision:** Progressive shell — simple on weak targets, richer on advanced machines.

## Machine State

Server-side, each machine maintains:

| State | Description |
|-------|-------------|
| IPv6 address | Unique identifier |
| OS archetype | Template defining behavior |
| Security components | Numeric levels per subsystem |
| Filesystem | Directories, files, logs |
| Processes | Running services (alarm daemon, SSH, HTTP, custom) |
| Owner | Account ID (hidden from other players) |
| Resources | CPU, RAM, storage capacity |

## OS Archetypes

**Decision:** Few archetypes at MVP (target: 3–5).

MVP archetype names (locked for Stage 0): CheapServer OS, Generic Linux, Corp Workstation, Mainframe.

Suggested starter set (names provisional):

| Archetype | Tier | Shell character |
|-----------|------|-----------------|
| CheapServer OS | L1 | Minimal commands, known backdoors, tutorial-adjacent |
| Generic Linux | L2 | Standard shell, configurable services |
| Corp Workstation | L3 | Hardened defaults, audit logs, corp security |
| Mainframe | L4 | Restricted command set, high component levels |
| `[TBD]` | | |

Each archetype defines:

- Available shell commands
- Default service layout
- Default security component levels
- Loot table bias
- Faction affiliation default

## Security Components

**Decision:** Numeric levels per component.

| Component | Example levels | Tool counter |
|-----------|---------------|--------------|
| Password | L1–L5 | Cracker (matching level required) |
| Firewall | L1–L5 | Port opener, exploit |
| Alarm | L1–L5 | Trace speed; disabled post-access |
| Encryption | L1–L5 | Decryptor `[TBD]` |
| Antivirus | L1–L5 | Virus effectiveness |

Overall server difficulty emerges from component mix, not a single "server level."

## Worked Example: CheapServer OS

```
CheapServer OS 1.0
> help
Available: ls, cd, cat, run, assume

> ls
/home/guest  /etc  /var/log

> cat /etc/motd
CheapServer OS 1.0 — "Security through simplicity"

> assume superuser backdoor
Access granted. UID 0.
```

This is intentional layered depth — a known shortcut on a L1 target. Claimed and hardened machines remove or patch these backdoors.

## Shell Simulation Contract

The server simulates shell semantics per archetype. Commands are **not** a real OS — they are game responses to recognized input patterns.

### What the server validates

- Command exists for this archetype and access level
- Player has sufficient access (guest vs root)
- Side effects (file read, process kill, alarm disable) update machine state

### Progressive depth

| Tier | Shell behavior |
|------|---------------|
| L1 | ~dozen commands, obvious vulnerabilities |
| L2 | Expanded command set, service interaction |
| L3+ | Log forensics, multi-step privilege escalation, custom daemons |

## Claim Flow

1. Player gains root (or equivalent) during hack session
2. Player issues claim action
3. Server updates central registry: owner = player account
4. Player gains full ownership — reconfigure, install, harden

**Decision:** Full ownership on claim.

## Harden Flow

**Decision:** Player-configured hardening only.

Post-claim actions:

- Change passwords (raises Password level)
- Install firewall rules (raises Firewall level)
- Install security software from NPC market
- Close/remove backdoors and default vulnerabilities
- Patch services

No automatic hardening over time unless the player installs software that provides it.

## Machine Lifecycle

| Event | Effect |
|-------|--------|
| Claim | Ownership transfer, player configuration enabled |
| Siege loss | Ownership transfer to attacker |
| Authority seizure | Ownership cleared or transferred to faction `[TBD]` |
| Destruction | Machine removed or reset to proc-gen default `[TBD]` |

## Content Authoring

Archetype and machine templates defined in [18-content-authoring.md](18-content-authoring.md).
