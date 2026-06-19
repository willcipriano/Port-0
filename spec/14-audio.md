# Audio

> Status: Draft | Last updated: 2026-06-19

## Overview

**Decision:** Minimal SFX at launch. No music. No voice lines. Audio exists to signal critical state changes the player might miss while multitasking.

## MVP Sound Events

| Event | Purpose | Priority |
|-------|---------|----------|
| Trace warning | Trace timer crosses threshold (e.g. 50%, 25%) | Required |
| Trace imminent | Trace < 10 seconds | Required |
| Hack success | Access gained, alarm disabled, claim complete | Required |
| Hack failure / caught | Trace expired, session terminated by authorities | Required |
| Tool complete | Password cracker or long-running tool finished | Required |
| Siege alert | Incoming siege notification for defender | Required |
| UI click / confirm | Window open, button press | Optional |
| Error / denied | Invalid command, insufficient resources | Optional |

## Design Constraints

- Short samples (< 2 seconds each)
- Non-intrusive — player may run multiple tools with overlapping completion times
- Distinct profiles for warning vs success vs failure
- Mute toggle in settings
- No ambient hum or music in MVP (may add in polish phase)

## Implementation Notes

`[TBD — owner: designer]` during implementation.

- Web Audio API for browser
- Tauri-compatible asset loading for desktop
- Sound files: small compressed formats (ogg/mp3)

## Future Audio

Polish phase may add:

- Ambient terminal hum (toggleable)
- Zone-specific ambient layers
- Music tracks for menu/landing

Not in MVP scope.
