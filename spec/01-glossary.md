# Glossary

> Status: Draft | Last updated: 2026-06-19

Terse definitions for terms used across the spec.

| Term | Definition |
|------|------------|
| **Rig** | The player's untouchable personal machine. Hybrid base stats + cyberware + installed software. Primary hacking interface. |
| **Drone** | A server on the network owned (or partially accessed) by a player. Fleet asset; maps CPU→attack, RAM→MP, storage→HP. |
| **Subnet** | A logical network segment containing many machines under a shared address prefix and theme. |
| **Zone** | A fixed thematic region within the world (residential, corporate, government, darkweb, etc.). |
| **IPv6 address** | Real-format address identifying a machine. Anyone with the address can attempt connection. |
| **Landmark** | Handcrafted machine placed in the proc-gen world (NPC contracts, story targets, unique loot). |
| **Tick** | 15-minute world simulation interval. Economy, scans, offline progress advance on ticks. |
| **Trace** | Wall-clock countdown until authorities or defenders identify the attacker. |
| **Alarm daemon** | Service on a target that initiates trace when intrusion is detected. Can be disabled after access. |
| **Heat** | Subnet-wide accumulation of suspicious activity; affects trace speed and faction response. |
| **Security level** | Numeric tier on a component (Password L1, Firewall L3, etc.). Tools must meet or exceed target level. |
| **Tool** | Installable software on the rig that consumes RAM/CPU while running. Behaves like an RPG spell. |
| **Virus** | Crafted payload with effect + level. Limited uses; source code enables faster variants. |
| **Claim** | Taking full ownership of a compromised machine. Owner can configure and harden it. |
| **Siege** | Async attack on another player's server fleet. Defender can interact during assault. |
| **Recon** | Actions to learn hidden information (ownership, defenses, loot) about a target. |
| **Hospital** | Criminal retaliation downtime. Soft lockout — fleet/market management allowed, hacking blocked. Real-time timer. |
| **Prison** | Government punishment. Hard lockout from hacking. Real-time timer. |
| **Crypto** | Single in-game currency. Earned from jobs, loot, passive sources; spent in market and sinks. |
| **NPC market** | Vendor catalog at launch. Player-to-player market deferred. |
| **Central registry** | Server-side ownership database. Owner identity hidden until recon reveals it. |
| **OS archetype** | Template defining shell behavior, services, and default security (e.g. CheapServer OS). |
| **Cyberware** | Rig hardware upgrades that modify base capabilities. `[TBD — owner: designer]` upgrade tree. |
