# Tasks — Smart Aquarium (L1 / Lab A1)

> Process: `L1/2builder.md`. Developer answers: `CLARIFICATIONS.md`. All app files go in `AquariumApp/`.

## Startup (Phases 1–3)

- [x] Phase 1: Read `Skill.md`, `L1/1requirment.md`, `L1/3api-contract.md`
  - Verify: summary given to the developer (Session 1)
- [x] Phase 2: Read the output files; decide new start or resume
  - Verify: all four files were empty → **new start**
- [x] Phase 2.5: Clarification Gate
  - Verify: Q1–Q14 each have a recorded **Answer** in `CLARIFICATIONS.md` (0 left `_Pending_`)
- [x] Phase 3: Plan the build tasks below
  - Verify: every requirement section (Login, Chart, Tiles, Alert Banner, Feed Now, CSS, Flow) maps to at least one task

## Build (Phase 4)

### Milestone 1 — Login

- [x] T1. `css/common.css`: design tokens and base styles
  - Verify: every colour, spacing, radius, shadow, font size and duration is a CSS variable; colours are HSL navy/teal; Inter 400/500/700 loads; font sizes use rem; buttons have hover/active/focus-visible/disabled states; inputs are custom styled; spinner and skeleton classes exist; touch targets ≥ 44px (`Skill.md` § Frontend Design Standards)
- [x] T2. `login.html` + `css/login.css`
  - Verify: username field, password field and a `Login to Dashboard` button on a glass card; error area with icon and `role="alert"`; layout holds at 320/768/1280 px; `login.css` starts with `@import "common.css"`
- [x] T3. `js/config.js`, `js/session.js`, `js/api.js`: shared request layer
  - Verify (code review against the contract):
    - every fetch sends `Accept`, sends `Content-Type` only with a body, uses `X-Authorization: Bearer` (except §1–§2), and has a 10 s AbortController timeout
    - on a `401`, refresh once and retry once; if the refresh fails, clear the session and redirect
    - JSON parsing sits inside try/catch
    - tokens live only in sessionStorage and nothing logs them (Q5, `Skill.md` § Auth)
- [x] T4. `js/auth.js` + `js/login.js`: login chain
  - Verify: valid login stores `token`, `refreshToken`, `customerId`, `deviceId`, `deviceAccessToken` and opens `dashboard.html`; wrong password shows "Invalid username or password"; an empty field shows an inline message without a request; failures clear the partial session; the button shows a spinner and is disabled while the chain runs; the device token is never rendered or logged (Q3, Q4, Q11)
- [x] **Checkpoint M1**: the developer runs the Login checklist in the browser

### Milestone 2 — Dashboard with live data

- [x] T5. `dashboard.html` + `css/dashboard.css`: layout
  - Verify:
    - header with the connection pill and `Logout`; the alert banner is hidden by default and has `role="alert"`
    - chart card holds a `<canvas>`; six tiles in a CSS Grid; Feed card
    - skeletons show before the first data arrives
    - 1 column at 320 px, 2 at 768 px, wider layout at 1280 px
- [x] T6. `js/telemetry.js`: parse and validate WebSocket values
  - Verify (unit check in the browser console, by the developer):
    - `"27.5"` → 27.5; `"abc"`, `"NaN"`, `"99"` (temperature) → invalid; `"true"` → true; `"TRUE"` → invalid
    - `sun` 0–100; `feedCount` must be an integer from 0 to 100000 (contract § Sensor Value Ranges)
- [x] T7. `js/ws.js`: telemetry WebSocket
  - Verify:
    - sends the exact § 7 subscribe message once after `onopen`
    - reconnect delays are 1, 2, 4… up to 30 s; a 10 s connect timeout counts as a failed attempt
    - before reconnecting, refresh the token if its `exp` is within 60 s, and on refresh failure go to Login (Q5)
    - `close()` removes listeners and clears timers
- [x] T8. `js/chart.js`: canvas temperature chart
  - Verify:
    - y-axis 20–35 °C and x-axis `-5 min` … `now`
    - labelled reference lines at 30 °C (fan ON) and 28 °C (fan OFF)
    - points older than 5 min are dropped; gaps on `sensorFault`/invalid samples and wherever points are more than 15 s apart (Q6, Q7)
    - sharp on high-DPI screens and redraws on resize
- [x] T9. `js/dashboard.js`: session guard, tiles, banner, status pill, logout
  - Verify:
    - with no session, redirect to Login
    - tiles match the requirement table (`--` when invalid, or for temperature while `sensorFault` is true); the fan spins while ON; the sun bar is filled to its value
    - banner messages appear for `waterLow` and `sensorFault`, and both when both are true
    - the pill shows Live / Reconnecting… / No data (more than 30 s since the last message)
    - Logout clears sessionStorage, closes the WebSocket and opens Login (Q8, Q9, Q12)
- [x] **Checkpoint M2**: the developer runs the Dashboard checklist with Wokwi running

### Milestone 3 — Feed Now

- [x] T10. `js/rpc.js` + Feed Now wiring
  - Verify:
    - `POST /api/rpc/twoway/{deviceId}` with body `{"method":"feed","params":{},"timeout":5000}`
    - while in flight: button disabled with a spinner, text `Feeding…`, and repeat clicks ignored
    - success → "Fed at HH:MM" (24 h) and the feed count updates
    - 504/408 → "Device not responding"; fetch timeout → "Connection timed out"; `success:false` or other errors → "Command failed — retry"; the button is re-enabled after any failure (Q10, Q13)
- [x] **Checkpoint M3**: the developer runs the Feed checklist with Wokwi running

### Review (Phases 5–6)

- [x] T12. Review finding: move the remaining literal design values in CSS rules into tokens (requirement § CSS "Controlled by CSS variables only")
  - Verify: scanning the rules (outside `:root`) for rem/px/ms/s literals finds only the documented technical constants (the 1px `.visually-hidden` utility, the autofill inset hack, the 1ms reduced-motion override); login and dashboard screenshots unchanged; T4/T9/T10 tests still pass
- [x] T11. Phase 5 review: pass/fail for every requirement, clarification and security rule, plus a final XSS and token pass
  - Verify: review table in `SESSION.md`; every failure becomes a new task; the developer confirms

### Change request — TinyML anomaly alert (CLARIFICATIONS Q17, 2026-11-20)

- [x] T13. Firmware `Desktop/Aquarium/src/main.cpp`: AI reset during `sensorFault`; 3-on / 5-off hysteresis; AI buzzer only for the first 10 s; `aiScore` / `aiAlert` added to the 5 s telemetry
  - Verify: diff touches only the AI globals, `updateAI` decision, one buzzer line, one `loop` line and the telemetry `snprintf`; `pio run` SUCCESS (07:40:22); worst-case payload 134 bytes (< 200 buffer, < 256 MQTT packet)
- [x] T14. Web: yellow AI warning bar, plus the `aiScore` / `aiAlert` keys in the subscription and validation; requirement and contract updated
  - Verify: new suite T11 passes 19/19 (validation, show/hide/invalid/`--`, exact text, red banner and tiles unaffected); all earlier suites still pass (232/232); screenshots at 1280 and 320 px
- [ ] **Checkpoint AI**: developer runs the 3-step Wokwi checklist
