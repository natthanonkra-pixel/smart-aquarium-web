# Session Log

## Session 1 — 2026-11-18

### Done
- Phase 1: read `Skill.md`, `L1/1requirment.md` and `L1/3api-contract.md`
- Phase 2: all output files were empty, so this is a **new start**
- Understanding: two pages in `AquariumApp/`:
  - `login.html` runs the login chain: login → customer ID → first device → device access token
  - `dashboard.html` subscribes over WebSocket to 6 telemetry keys and shows:
    - a 5-minute temperature line chart on `<canvas>`, with the 28/30 °C reference lines
    - 6 status tiles
    - an alert banner for `waterLow` / `sensorFault`
    - a Feed Now button that sends the twoway RPC
  - Stack: vanilla HTML/CSS/JS with ES Modules, a deep-water theme, sessionStorage-only tokens, refresh once on `401`, WebSocket backoff from 1 s up to 30 s
- Environment check: Python 3.14 is available; Node.js isn't
- Phase 2.5: wrote 14 numbered questions with proposed defaults into `CLARIFICATIONS.md`
- **Stopped at the Clarification Gate** to wait for the developer's answers

### Files Changed
- `CLARIFICATIONS.md` — Q1–Q14 (answers pending)
- `TASK.md` — startup phases logged; build tasks not planned yet
- `DECISION.md` — gate-first decision and how checks will be verified
- `SESSION.md` — this entry

### Next
- Record the developer's answers to Q1–Q14 in `CLARIFICATIONS.md`, and ask any follow-up questions
- State "All questions resolved — proceeding to planning"
- Phase 3: plan the build tasks with Verify lines in `TASK.md`; log design decisions in `DECISION.md`
- Phase 4: start the first task (`css/common.css`)

## Session 2 — 2026-11-18

### Done
- Recorded the developer's answers to Q1–Q14 in `CLARIFICATIONS.md`. The gate is closed: all questions are resolved.
- Phase 3: planned T1–T11 with Verify lines in `TASK.md`; logged design decisions in `DECISION.md`
- **Milestone 1 (Login) built and checked** (T1–T4):
  - T1 `common.css`: static check found no colours outside `:root`, no px font sizes, and all button/input/spinner/skeleton states present
  - T2 `login.html` and `login.css`: tags balanced, no duplicate IDs, `@import "common.css"`; screenshots at 320, 768 and 1280 px are correct and Inter loads
  - T3 request layer: **30/30** headless Chrome tests pass. They cover the headers, the 10 s timeout, refresh once then retry once on `401`, a single shared refresh, no retry when the refresh fails, the redirect and session clearing on refresh failure, 5xx, bad JSON, network errors and JWT `exp`.
  - T4 login chain: **57/57** headless Chrome tests pass. They cover:
    - the happy path: all 5 keys stored, the dashboard opens, the 4 calls run in the contract's order
    - every error message from the contract and Q4
    - partial session cleared on any failure, busy state, double submit ignored
    - the device token never appears in the DOM
    - one call to the **real** thingsboard.cloud with made-up credentials, which correctly shows "Invalid username or password" (real endpoint and CORS confirmed)
  - Security grep: no `console.*`, `localStorage` or `innerHTML` in `js/`
- Stopped at the **Human Checkpoint M1**

### Files Changed
- `CLARIFICATIONS.md` — answers recorded
- `TASK.md` — plan T1–T11; T1–T4 marked `[x]`
- `DECISION.md` — module layout, login and refresh error strategy, palette, telemetry merge, headless Chrome verification
- `AquariumApp/login.html` — login page
- `AquariumApp/css/common.css`, `AquariumApp/css/login.css` — tokens, base styles, login layout
- `AquariumApp/js/config.js`, `session.js`, `api.js`, `auth.js`, `login.js` — request layer and login chain
- `AquariumApp/dashboard.html` does not exist yet. A successful login will open a 404 page until T5.

### Next
- Wait for the developer's M1 checklist result. Treat any reported problem as a failed check (Phase 4 step C).
- Then T5: `dashboard.html` and `dashboard.css`

## Session 3 — 2026-11-18

### Done
- Recorded the M1 pass and the 403 fix (user added to the "Customer Users" group) in `CLARIFICATIONS.md` Q15 and `DECISION.md`
- **Milestone 2 (Dashboard with live data) built and checked** (T5–T9), all in headless Chrome:
  - T5 layout: markup is valid; screenshots at 320, 768 and 1280 px in the loading and filled states. Three layout fixes: tile labels wrap instead of being cut off, the tile icon sits above the label on mobile, and the Feed button is pinned to the bottom of its card.
  - T6 `telemetry.js`: **45/45** validation tests pass (numbers, booleans, ranges, integer `feedCount`, partial messages, unknown keys, server error frames)
  - T7 `ws.js`: **19/19** pass. They cover the exact subscribe JSON, reconnect gaps of 1/2/4/8/16/30/30 s, the 10 s connect timeout, the backoff reset after valid data, refresh before reconnect (Q5), auth failure leading to Login, and cleanup on stop.
  - T8 `chart.js`: **9/9** pass (window pruning, gaps for fault, invalid values and silences over 15 s, clamping, DPR). Two visual fixes: reference labels on chips, and x-axis labels that no longer collide at 320 px.
  - T9 `dashboard.js`: **38/38** integration tests on the real `dashboard.html` with a fake WebSocket. They cover the session guard, all six tiles, the fan spin, the sun bar, both alerts, `--` during a sensor fault or invalid value, an XSS payload not being rendered, No data after 30 s, Reconnecting…, and logout clearing the session and closing the socket.
  - Security scan: no `console`, `localStorage`, `innerHTML` or `eval` in `js/`. `deviceAccessToken` is only written (`auth.js`) and never read or rendered.
- Stopped at the **Human Checkpoint M2**. The real WebSocket against thingsboard.cloud with Wokwi still needs to be confirmed by the developer (contract § 7 ⏳).

### Files Changed
- `CLARIFICATIONS.md` — Q15 (M1 result, 403 / user group)
- `DECISION.md` — 403 troubleshooting; dashboard behaviour details
- `TASK.md` — Checkpoint M1, T5–T9 marked `[x]`
- `AquariumApp/dashboard.html` — dashboard page
- `AquariumApp/css/dashboard.css` — dashboard layout; `css/common.css` — new tokens (header surface, warning border, success glow, sun gradient, chart label chip, label letter-spacing)
- `AquariumApp/js/telemetry.js`, `ws.js`, `chart.js`, `dashboard.js` — new
- The Feed Now button is visible but **not wired yet** (T10)

### Next
- Wait for the developer's M2 checklist result (real thingsboard.cloud WebSocket and Wokwi)
- Then T10: `rpc.js` and the Feed Now wiring

## Session 4 — 2026-11-18

### Done
- **Checkpoint M2: pass** for steps 1–7, 9 and 10 (developer, real thingsboard.cloud and Wokwi)
- **Step 8 (reconnect after a network drop) could not be tested manually.** Chrome DevTools "Offline" throttling doesn't close a WebSocket that is already open, so the indicator stayed "Live". Not an app defect, because the browser never fires `onclose`. Coverage so far:
  - Automated: T7 tests (1/2/4/8/16/30/30 s backoff, 10 s connect timeout, refresh before reconnect) and the T9 "server close → Reconnecting… → reconnected" test pass in headless Chrome.
  - If the network drops but the socket stays half-open, the indicator still switches to **"No data" after 30 s** (checked in step 7 and the T9 stale test), so the user isn't misled.
  - **Optional manual test** for the Phase 5 review: turn off the PC's Wi-Fi or unplug the network cable for about 1 min. The OS drops the TCP connection, Chrome fires `onclose`, and the indicator should show "Reconnecting…", then "Live" after the network returns. Chrome may take a while to notice a silent drop, and "No data" shows first.
- **T10 Feed Now built and checked**:
  - `js/rpc.js` (new) sends `POST /api/rpc/twoway/{deviceId}` with `{"method":"feed","params":{},"timeout":5000}`
  - `js/dashboard.js` `initFeed()`: busy state with spinner and "Feeding…", clicks ignored while in flight, "Fed at HH:MM" (24 h), feed count updated from the reply
  - **34/34** headless Chrome tests pass on the real dashboard: busy and double-click, the exact request, success, 504/408 → "Device not responding", network or 10 s timeout → "Connection timed out", 500 / `success:false` / empty reply → "Command failed — retry", the button re-enabled after every failure, a missing `feedCount` keeping the count (Q10), `401` → one refresh and one retry, and a failed refresh → Login
  - T9 regression: 38/38 still pass. Security scan is clean.
- Stopped at the **Human Checkpoint M3**. The real RPC to the Wokwi device (contract § 6 ⏳) needs the developer.

### Files Changed
- `SESSION.md` — this entry (M2 result, step 8 note)
- `TASK.md` — Checkpoint M2 and T10 marked `[x]`
- `AquariumApp/js/rpc.js` — new
- `AquariumApp/js/dashboard.js` — Feed Now wiring (`initFeed`)

### Next
- Wait for the developer's M3 checklist result
- Then T11: Phase 5 review (pass/fail for every requirement, plus a final security pass), including the optional Wi-Fi-off test for M2 step 8

## Session 5 — 2026-11-18

### Done
- Recorded the M3 pass and the firmware reply fix (`tbCallback` now replies `{"success":true,"feedCount":N}`) in `CLARIFICATIONS.md` Q16
- **Phase 5 review.** One failure was found: literal design values remained in CSS rules (requirement § CSS). It became **T12**, was fixed and re-checked.
- Full regression after T12: **232/232** headless Chrome tests pass (T3 30, T4 57, T6 45, T7 19, T8 9, T9 38, T10 34). Screenshots of login and dashboard at 320/768/1280 px are unchanged.

### Phase 5 review — requirement by requirement

Evidence key: **auto** = headless Chrome test suite (T-number); **M1/M2/M3** = developer's browser check against real thingsboard.cloud and Wokwi; **shot** = layout screenshot; **code** = code review or grep.

#### `L1/1requirment.md`

| Requirement | Result | Evidence |
| --- | --- | --- |
| Login: username and password fields | PASS | `login.html`; auto T4; M1 |
| Login: `Login to Dashboard` button | PASS | `login.html`; auto T4 (label restored after busy); M1 |
| Dashboard: single `Logout` → Login | PASS | `dashboard.html#logout`; auto T9; M2 step 9 |
| Chart: line chart, rolling 5 min, older points dropped | PASS | `js/chart.js` `prune()`; auto T8 (prune after 61 s); M2 step 3 |
| Chart: reference lines 30 °C (fan ON) and 28 °C (fan OFF), labelled | PASS | `chart.js` `REF_LINES`; shot; M2 step 3 |
| Chart: Y fixed 20–35 °C in °C; X `-5 min` … `now` | PASS | `chart.js` `Y_MIN/Y_MAX`, x labels; shot; M2 step 3 |
| Chart: gap for `sensorFault` / invalid samples | PASS | `dashboard.js` `faultAt()` → `addGap`; auto T8, T9; M2 step 6 |
| Chart: HTML5 canvas, no libraries | PASS | `<canvas id="temp-chart">`; code (no external JS) |
| Tile temperature: 1 decimal + °C; `--` while `sensorFault` | PASS | `renderTemperature()`; auto T9; M2 steps 2, 6 |
| Tile fan: ON/OFF, icon spins while ON | PASS | `renderFan()`, `.tile[data-state=on] .fan-icon`; auto T9 (computed `animationName`); M2 step 4 |
| Tile water level: OK calm / LOW alert | PASS | `renderWater()`; auto T9; M2 step 5 |
| Tile sensor: OK / FAULT alert | PASS | `renderSensor()`; auto T9; M2 step 6 |
| Tile light: value + %, bar filled to % | PASS | `renderSun()` `--fill`; auto T9; M2 step 2 |
| Tile feeds since boot: integer | PASS | `renderFeedCount()`; auto T6 (integer only), T9 |
| Tiles in CSS Grid, real-time; no unit conversion | PASS | `.tiles { display:grid }`; values shown as sent (code) |
| Banner hidden when normal; both messages; both when both true | PASS | `renderAlerts()`; auto T9; M2 steps 5–6 |
| Banner readable by screen readers | PASS | `role="alert"` + `aria-live="assertive"`; re-announced only on change (auto T9) |
| Feed Now sends the feed RPC (§ 6) | PASS | `js/rpc.js`; auto T10 (path, body, headers); M3 steps 1, 4 |
| Feed: disabled + spinner + `Feeding…` while waiting | PASS | `initFeed()`; auto T10; M3 step 1 |
| Feed success: "Fed at HH:MM" (local) and count from reply | PASS | auto T10; M3 step 2 |
| Feed failure: contract message, button re-enabled | PASS | auto T10 (504/408/timeout/500/`success:false`); M3 steps 5–6 |
| Feed: double clicks ignored | PASS | `inFlight` guard; auto T10; M3 step 3 |
| Out of scope not built (no device picker, history, config, registration, alarms, server) | PASS | code: the only API paths are contract §§ 1–7; first device used |
| Output location `AquariumApp/` with `login.html`, `dashboard.html`, `css/`, `js/` | PASS | file tree |
| CSS: variables only | PASS (after T12) | rule scan finds only the documented technical constants |
| CSS: deep-water navy/teal HSL, mobile-first, 320/768/1280 | PASS | `common.css` tokens; `min-width` 48rem/80rem; shot |
| CSS: one file per page, each `@import "common.css"`; `common.css` holds globals | PASS | `login.css`, `dashboard.css` line 1 |
| JS: ES modules, native `fetch` only | PASS | `type="module"`; `api.js` is the only `fetch` caller |
| Endpoint table (login, refresh, user, devices, credentials, RPC, WS) | PASS | `config.js` `API`; auto T3/T4/T7/T10 compare paths; M1–M3 |
| Login flow steps 1–7 | PASS | `auth.js` `signIn()`; auto T4 (call order, every failure clears session); M1 |
| Dashboard flow 1–4 (guard, WS, RPC, logout) | PASS | auto T9, T10; M2, M3 |

#### `CLARIFICATIONS.md`

| Answer | Result | Evidence |
| --- | --- | --- |
| Q1 ES modules, served by Live Server | PASS | M1–M3 run via Live Server |
| Q2 first device | PASS | `auth.js` `list[0]` |
| Q3 device token stored only, never shown or logged | PASS | auto T4 and T9 (absent from DOM); grep: only written in `auth.js` |
| Q4 login error messages, partial session cleared | PASS | auto T4 (each message plus `sessionStorage` empty) |
| Q5 refresh once before WS reconnect, failure → Login | PASS | auto T7 |
| Q6 server timestamp, 5 min window on browser clock, 1 s redraw | PASS | `chart.js`; auto T8 |
| Q7 gap when more than 15 s apart | PASS | `CHART_GAP_MS`; auto T8 (silence segment) |
| Q8 `--` muted for invalid; unknown boolean doesn't trigger the banner | PASS | auto T9 |
| Q9 Live / Reconnecting… / No data indicator | PASS | auto T9; M2 steps 1, 7 |
| Q10 feed reply edge cases | PASS | auto T10 |
| Q11 login always shows the form | PASS | `login.js` (no auto-redirect) |
| Q12 client-side logout only | PASS | no `/api/auth/logout` call (grep) |
| Q13 English, 24-hour time | PASS | `formatHM`; auto T10 regex |
| Q14 developer runs milestone checks | PASS | M1, M2, M3 done |
| Q15 403 → user group (account setup) | PASS | message unchanged; troubleshooting note in `DECISION.md` |
| Q16 firmware reply format | PASS | M3 pass after the firmware fix |

#### `Skill.md` standards

| Rule | Result | Evidence |
| --- | --- | --- |
| Validate every response (status, shape, null) | PASS | `api.js`, `auth.js`, `rpc.js`, `telemetry.js`; auto T3/T4/T6/T10 |
| `try/catch` around every `fetch` and `JSON.parse` | PASS | `api.js` `fetchWithTimeout`/`readJson`; `ws.js` `onmessage`; `session.js` JWT decode |
| 10 s AbortController timeout on every fetch | PASS | auto T3, T10 |
| User-friendly errors, no raw server text | PASS | auto T3 ("error message has no server body"), T10 |
| sessionStorage only, read when needed | PASS | grep: only `session.js` touches storage; auto T4 (`localStorage` empty) |
| Reactive refresh: one refresh, one retry, failure → clear and Login | PASS | auto T3, T10 |
| Logout clears credentials, closes WS, redirects | PASS | auto T9; M2 step 9 |
| No tokens or secrets in logs | PASS | grep: no `console.*` in `js/` |
| WS backoff 1 s → 30 s, 10 s connect timeout counts | PASS | auto T7 |
| WS cleanup (close, handlers, timers) | PASS | auto T7 (`onclose === null`, closed, no reconnect after stop) |
| Out-of-range / NaN / null → fallback | PASS | auto T6, T9 |
| Zero-trust rendering, no `innerHTML` with server data | PASS | grep: every DOM write is `textContent` or attributes; auto T9 XSS payload |
| No retry of login or refresh on unexpected status | PASS | auto T3 ("refresh not retried"), T4 |
| Native APIs only; Inter is the only external resource | PASS | grep: only `fonts.googleapis.com` / `fonts.gstatic.com` |
| Design: Inter, HSL palette, tokens, 0.5rem rhythm, rem fonts | PASS | `common.css`; T12 scan |
| Touch targets ≥ 44 px; Grid/Flex layout only | PASS | `--touch-target: 2.75rem` on buttons, inputs, password toggle |
| Transitions 150–300 ms ease-out; hover/active/focus/disabled states | PASS | `--duration-*`, `.btn` states; T1 check |
| Gradient CTA, glass cards; skeleton/spinner loading; error = colour + icon + text | PASS | shot; auto T4 (icon + `role=alert`), T9 (skeletons) |
| Custom-styled inputs, visible focus, no lorem ipsum | PASS | `.input`, `:focus-visible`; IoT copy throughout |

### Final security pass (Phase 5 step 18)
- **XSS:** no `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `eval` or `document.write` in `js/`. All 12 `textContent` writes take constants or values validated by `telemetry.js` / `rpc.js`. An injected `<img onerror>` payload rendered as `--` (auto T9).
- **Tokens:** no `console.*`; no `localStorage`; only `session.js` touches storage; `deviceAccessToken` is never read or rendered.
- **Unvalidated server values:** none found. Every value from login, user, devices, credentials, RPC and WS is type-, format- or range-checked before use.
- **Residual risk (accepted, not a halt):** the user JWT goes in the WebSocket URL (`?token=`), as ThingsBoard and contract § 7 require. It can appear in server or proxy access logs. It's mitigated by the short JWT lifetime and the WSS transport. Severity: **low**.

### Open items (not failures)
- M2 step 8: no manual reconnect check, because DevTools "Offline" doesn't close an open WebSocket in Chrome. Covered by auto T7/T9. The optional Wi-Fi-off test is in Session 4.
- Chrome's own network log shows the expected 504 when the device is offline (M3 step 5). This is browser output, not an app `console` call.

### Files Changed
- `CLARIFICATIONS.md` — Q16
- `TASK.md` — Checkpoint M3 `[x]`; T12 added and `[x]`; T11 `[/]` waiting for the developer's confirmation
- `AquariumApp/css/common.css`, `login.css`, `dashboard.css` — remaining literals moved to tokens (T12)
- `SESSION.md` — this review

### Next
- The developer confirms the Phase 5 review (Human Checkpoint). On confirmation, mark T11 `[x]`, which meets the **Done** stop condition.
- Optional: the Wi-Fi-off reconnect test

## Session 6 — 2026-11-18

### Done
- The developer **confirmed the Phase 5 review**. T11 is marked `[x]`.
- **Done stop condition met**: all tasks in `TASK.md` are `[x]`, every requirement in the Phase 5 review is PASS, and the developer confirmed it.

### Files Changed
- `TASK.md` — T11 `[x]`
- `SESSION.md` — this entry

### Next
- Nothing open. Optional: the Wi-Fi-off reconnect test (Session 4). Any future change starts a new loop from `L1/2builder.md` Phase 1 (resume).

## Session 7 — 2026-11-20

### Done
- Support only; no app code changed. The developer reported the dashboard stuck on "Temperature sensor fault" with an empty chart after adding TinyML to the firmware.
- Diagnosed in `Desktop/Aquarium/src/main.cpp`: added two temporary debug prints, rebuilt, and read the result `[DS18B20] bad read: 67.38`. The sensor reads fine, but the Wokwi DS18B20 slider was set to 67.38 °C, which is outside the valid range of −10 to 60 °C, so the firmware raises `sensorFault` (fail-safe). TinyML, the wiring and the library versions were ruled out.
- Fix is on the developer's side: set the DS18B20 slider back inside −10 to 60 °C. The debug prints were removed (file restored from backup and checked by diff), and the firmware was rebuilt at 07:28:51.
- The dashboard behaved as specified throughout: `--`, chart gap, "Waiting for live temperature…", and the banner.

### Files Changed
- `SESSION.md` — this entry. `Desktop/Aquarium/src/main.cpp` is back to its original content.

### Next
- Optional: show the TinyML result (`aiScore` / `aiAlert`) on the dashboard. This needs new telemetry keys in the firmware plus a requirement and contract change, so ask first (Phase 2.5).

## Session 8 — 2026-11-20

### Done
- Q17 (TinyML anomaly alert, smallest scope) recorded and implemented:
  - **Firmware** (`Desktop/Aquarium/src/main.cpp`): reset during sensor fault, 3/5 hysteresis, 10 s AI beep, `aiScore` / `aiAlert` telemetry. Build SUCCESS at 07:40:22. Backup: `scratchpad/main.cpp.before-ai`
  - **Web:** yellow AI warning bar (`dashboard.html`, `css/dashboard.css`, `js/config.js`, `js/telemetry.js`, `js/dashboard.js`). Backup: `scratchpad/web-before-ai/`
  - **Docs:** `L1/1requirment.md` (payload, section 5 AI Warning Bar, flow "eight keys / 5 widgets"); `L1/3api-contract.md` A1.1 (§ 7 keys and example, sensor-range rows). Both were edited with the developer's explicit authorisation (Q17).
- Tests: 251/251 headless Chrome tests pass (232 existing + 19 new in T11). Security scan is clean.

### Files Changed
- `Desktop/Aquarium/src/main.cpp`
- `AquariumApp/dashboard.html`, `css/dashboard.css`, `js/config.js`, `js/telemetry.js`, `js/dashboard.js`
- `L1/1requirment.md`, `L1/3api-contract.md`
- `CLARIFICATIONS.md` (Q17), `DECISION.md`, `TASK.md` (T13, T14), `SESSION.md`

### Next
- The developer runs the 3-step Wokwi checklist (Checkpoint AI)

## Session 9 — 2026-11-20

### Done
- Q18: added `AquariumApp/index.html` (meta refresh to `login.html` plus a fallback `.btn` link, styled by `common.css`, no inline styles). Verified in headless Chrome: opening the folder root lands on `login.html` with the login form.
- Deploy-readiness check on `AquariumApp/`: no root-absolute paths, no secrets (the only matches are sessionStorage key names), 16 files.

### Files Changed
- `AquariumApp/index.html` — new
- `CLARIFICATIONS.md` (Q18), `SESSION.md`

### Next
- The developer drags `AquariumApp/` to app.netlify.com/drop and checks login and live data on the Netlify URL
- Checkpoint AI (Session 8) is still open

## Session 10 — 2026-11-20

### Done
- Firmware secrets split (`Desktop/Aquarium`), as the developer asked; nothing else changed:
  - `src/main.cpp`: added `#include "secrets.h"`; `TB_TOKEN = TB_TOKEN_VALUE` (2-line diff)
  - New `include/secrets.h` (real token, git-ignored) and `include/secrets.example.h` (`YOUR_DEVICE_ACCESS_TOKEN`)
  - `.gitignore`: added `include/secrets.h`; new `README.md` with setup and build steps
  - `pio run` SUCCESS at 08:18:17. Checked that the token is compiled into `firmware.bin`.

### Next
- Checkpoint AI (Session 8) and the Netlify deploy (Session 9) are still open
