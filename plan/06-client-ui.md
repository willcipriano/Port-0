# Stage 6 — Client and UI

**Goal:** Uplink-style multi-window web client, OAuth login, real-time session UX, and minimal SFX — Tauri wrapper optional for MVP ship.

**Prerequisites:** Stage 1 (auth); Stage 3+ for live APIs (mock until ready)  
**Blocks:** [07-mvp-ship.md](07-mvp-ship.md)  
**Spec refs:** [13-ui-and-ux.md](../spec/13-ui-and-ux.md), [14-audio.md](../spec/14-audio.md), [00-vision-and-pillars.md](../spec/00-vision-and-pillars.md)

---

## 6.1 Client Shell (Start Early — Week 4)

Begin with mock API per [00-pre-flight.md](00-pre-flight.md) contract.

**Tasks:**

- [ ] Vite (or chosen bundler) + React + TypeScript
- [ ] OAuth login page → token storage (memory + refresh)
- [ ] App shell: dark theme, monospace font, CSS variables per spec palette
- [ ] Window manager integration (flexlayout-react / Golden Layout)
- [ ] Default layout: World map, Server list, Terminal, Email, Hardware
- [ ] Layout persist to localStorage `[TBD confirm with designer]`
- [ ] Connection manager: REST + WebSocket with auto-reconnect

**Acceptance:** Login (mock) → five empty windows render and resize.

---

## 6.2 MVP Window Implementations

| Window | Features | API deps |
|--------|----------|----------|
| **World map** | Subnet name, heat indicator, Scan button | scans, world |
| **Server list** | Discovered + owned IPv6, connect button | scans, fleet |
| **Terminal** | Shell I/O, scrollback, prompt | hack WS |
| **Email / contracts** | NPC jobs, accept/complete status | contracts |
| **Hardware** | Rig stats, cyberware, installed tools, **process manager panel** | rig, session |

**Process manager (required for MVP):**

- [ ] Embed in Hardware window or split pane — designer TBD
- [ ] Running tools list: name, target, progress bar, RAM/CPU
- [ ] Kill tool button
- [ ] Start tool dialog: pick from inventory, select target component
- [ ] Resource bars: total RAM/CPU remaining
- [ ] Disable start when insufficient resources + error toast

**Trace monitor:**

- [ ] MVP: persistent panel (Hardware or Terminal sidebar) — countdown, red pulse < 10s
- [ ] Heat readout optional

**Market:**

- [ ] MVP: modal or 6th window tab — catalog, balance, purchase
- [ ] Not in classic Uplink set but required for progression — acceptable as overlay

**Fleet / siege:**

- [ ] Fleet tab in Hardware or Server list: owned drones, siege status
- [ ] Siege alert banner + dedicated siege panel during interactive window

---

## 6.3 Real-Time UX

**Tasks:**

- [ ] WebSocket hook: session messages → terminal output, tool progress, trace timer
- [ ] Optimistic UI only for shell input echo; server text is truth
- [ ] Trace warnings at 50%, 25%, 10s — visual + SFX
- [ ] Hospital/prison overlay: countdown, blocked action tooltips
- [ ] Tick sync: poll `/me/sync` every 60s or push on `tick_summary`

**Multitasking goals** ([13-ui-and-ux.md](../spec/13-ui-and-ux.md)):

- [ ] Trace visible while typing in terminal
- [ ] Start tool without closing terminal session
- [ ] Keyboard shortcut to focus Terminal vs Hardware `[TBD shortcuts]`

---

## 6.4 Visual Design

| Element | Implementation |
|---------|----------------|
| Background | `#0a0e14` – `#121820` |
| Text | `#00ff9f` or cyan monospace |
| Trace warning | `#ff4444` pulse animation |
| Links | `#4488ff` |
| Font | JetBrains Mono, IBM Plex Mono, or similar |

- [ ] Window title bars: system names ("Terminal", "External Gateway")
- [ ] Progress bars: ASCII or thin CSS bars
- [ ] Blinking cursor in terminal input
- [ ] No neon cyberpunk overload — restrained retro

---

## 6.5 Audio ([14-audio.md](../spec/14-audio.md))

**Required SFX:**

- [ ] Trace warning (50%/25%)
- [ ] Trace imminent (<10s)
- [ ] Hack success
- [ ] Hack failure / caught
- [ ] Tool complete
- [ ] Siege alert

- [ ] Web Audio API wrapper; `< 2s` samples
- [ ] Mute toggle in settings (localStorage)
- [ ] Optional: UI click, error denied

---

## 6.6 Tauri Desktop Wrapper

**Can slip after web MVP** per spec.

**Tasks:**

- [ ] Tauri 2 project wrapping `packages/client` build
- [ ] Native window title; optional multi-window OS integration
- [ ] Same OAuth flow via webview
- [ ] Bundle bootsound optional
- [ ] Build pipeline: web artifact → Tauri bundle

**Acceptance:** Desktop app loads staging and completes one hack session.

---

## 6.7 Client Testing

- [ ] Component tests: terminal input, process manager states
- [ ] E2E (Playwright): login → scan (mock tick) → connect → run tool → claim
- [ ] Visual regression snapshot for default layout (optional)

---

## Acceptance Criteria (Stage 6 Complete)

- [ ] OAuth login against staging auth
- [ ] Full MVP window set functional against live backend
- [ ] Hack session playable entirely from UI
- [ ] Process manager starts/kills tools; resource limits enforced in UI
- [ ] Trace timer accurate to server pushes
- [ ] Market purchase updates hardware inventory
- [ ] Required SFX fire on events; mute works
- [ ] Desktop-first layout; min viewport 1280×720 documented

**Exit:** [07-mvp-ship.md](07-mvp-ship.md)
