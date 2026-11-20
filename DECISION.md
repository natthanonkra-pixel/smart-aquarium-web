# Design Decisions

> Decisions the AI developer made. Decisions the developer made go in `CLARIFICATIONS.md`.

## [2026-11-18] Wait at the Clarification Gate before planning

- **Context**: The input files leave 14 points open or in conflict, for example ES Modules vs. opening `login.html` from `file://`, and the contract's "Decision required" on device selection. `L1/2builder.md` § Phase 2.5 forbids guessing.
- **Decision**: Every question in `CLARIFICATIONS.md` has a proposed default, but no default counts as adopted until the developer confirms it. Planning (Phase 3) and design decisions wait for those answers.
- **Alternatives**: Build with the proposed defaults now and revise later. Rejected because the process requires the gate.

## [2026-11-18] How to verify checks in this environment

- **Context**: Node.js isn't installed, so the `node --check` syntax check from `L1/2builder.md` § Verification Checks isn't available. Python 3.14 is installed. I can't open a browser from this session.
- **Decision**: Syntax and behavior checks happen in the developer's browser at each Human Checkpoint: console clean, Verify action performed. I'll use Python to serve the files and confirm every page and asset returns HTTP 200. API, standards and security checks are done by reviewing the code against `L1/3api-contract.md` and `Skill.md`.
- **Alternatives**: Installing Node.js only for `--check`. Rejected because it changes the developer's machine without asking. I can install it if the developer wants.

## [2026-11-18] File layout and module split

- **Context**: `L1/1requirment.md` fixes `AquariumApp/{login.html, dashboard.html, css/, js/}`. `Skill.md` requires ES Modules and no build tools.
- **Decision**:
  - `css/common.css`, `css/login.css`, `css/dashboard.css`
  - `js/config.js`: URLs, keys, timeouts, ranges
  - `js/session.js`: the only module that touches sessionStorage
  - `js/api.js`: fetch wrapper with timeout, headers, and one refresh then one retry on `401`
  - `js/auth.js`: login chain
  - `js/login.js`: login page controller
  - `js/telemetry.js`: value validation
  - `js/ws.js`: WebSocket with backoff
  - `js/chart.js`: canvas chart
  - `js/rpc.js`: feed command
  - `js/dashboard.js`: dashboard page controller
- **Alternatives**: One script per page. Rejected because the auth, refresh and validation logic would be duplicated, and the security rules would be harder to audit in one place.

## [2026-11-18] Error handling for the login and refresh endpoints

- **Context**: `Skill.md` § Security Rules requires that unexpected statuses from login or refresh are never retried, and that the strategy is documented here.
- **Decision**:
  - **Login, § 1**: no retry and no refresh. The status maps to the contract message: 401 → "Invalid username or password"; 400 → "Login request failed — check input"; 5xx → "Server unavailable — try again later"; timeout or network error → "Connection timed out — check your network"; any other status → "Login failed — please try again".
  - **Steps 3–5**: messages as answered in Q4. Any failure clears every session key before the message is shown.
  - **Refresh, § 2**: called by `api.js` after a `401` from any other call, and by `ws.js` before a reconnect when the JWT is about to expire (Q5). Any non-200 response, or a reply without both tokens, clears the session and redirects to `login.html`. The refresh is never retried.
  - Concurrent `401`s share one in-flight refresh promise, so only one refresh call is ever made.
- **Alternatives**: Retrying the refresh after a delay. Rejected because `Skill.md` allows only one automatic retry, the one after a successful refresh.

## [2026-11-18] Visual design: "deep water" palette and layout

- **Context**: `L1/1requirment.md` § CSS asks for a dark navy/teal theme with HSL-tuned values. `Skill.md` asks for glass cards, gradient CTAs and the Inter font.
- **Decision**:
  - Background: a vertical gradient from navy (`hsl(214 58% 9%)`) to deep blue (`hsl(208 55% 15%)`).
  - Cards: glass at `hsl(205 60% 70% / 0.06)` with a `blur(14px)` backdrop.
  - Accent: teal `hsl(174 62% 47%)`. The CTA gradient runs from teal to aqua (`hsl(188 70% 50%)`).
  - Alerts: coral `hsl(8 78% 64%)`. Warnings: amber `hsl(38 90% 60%)`. Calm states use teal.
  - Spacing base unit: 0.5rem.
  - Breakpoints: mobile-first base for 320 px, then `min-width: 48rem` (768 px) and `min-width: 80rem` (1280 px).
  - The chart reads its colours from CSS variables via `getComputedStyle`, so every design value stays in CSS.
- **Alternatives**: Hard-coding canvas colours in JS. Rejected because of `Skill.md` § Visual Identity ("all colors … as CSS custom properties").

## [2026-11-18] Telemetry state merges partial messages

- **Context**: ThingsBoard sends only the keys that changed. The first message holds the stored latest values, which may be old.
- **Decision**: `dashboard.js` keeps one state object. Each incoming key is validated (`telemetry.js`) and merged; keys missing from a message keep their previous value. An invalid key is stored as `invalid`, so the UI shows `--`. The "No data" state starts 30 s after the last message.
- **Alternatives**: Re-rendering only from complete messages. Rejected because partial updates would be dropped.

## [2026-11-18] Verification with headless Chrome

- **Context**: The earlier plan said syntax and behavior checks could only run in the developer's browser. Chrome and Edge turned out to be installed, so I can run real browser checks myself.
- **Decision**: Each task is checked by loading the real pages in headless Chrome. The pages are served from a small static server in the session scratchpad. Test pages live in the scratchpad, never in `AquariumApp/`. Each test page mocks `fetch` or the WebSocket inside an iframe, drives the UI, and prints PASS/FAIL lines that I read back with `--dump-dom`. Layout is checked with screenshots of iframes at exactly 320, 768 and 1280 px; a plain `--window-size=320` doesn't work because headless Chrome enforces a minimum window width. The developer's checks at each milestone are still the final behavior check against the real account and the Wokwi device.
- **Alternatives**: Installing Node.js for `node --check`. Not needed, because loading the pages in a real browser is a stronger check (`L1/2builder.md`: "running something beats reading the code").

## [2026-11-18] A 403 from the devices call stays a generic message; the fix is in account setup

- **Context**: At M1 the real login stopped at step 4 with HTTP 403 from `GET /api/customer/{id}/devices`. On ThingsBoard Cloud (PE) a Customer User with no user group has no read permission. The developer added the user to the "Customer Users" group (see `CLARIFICATIONS.md` Q15).
- **Decision**: No code change. A 403 or 404 at step 4 or 5 keeps showing "Could not access the aquarium device" and clears the partial session, as agreed in Q4. **Troubleshooting:** if this message appears for a valid account, check in ThingsBoard that the Customer User is in the customer's "Customer Users" group and that the device is assigned to that customer.
- **Alternatives**:
  - Showing the raw 403 or the ThingsBoard error text. Rejected because `Skill.md` forbids exposing server details.
  - Adding a "contact your administrator about permissions" hint. Not adopted because it would change the wording agreed in Q4; it can be added if the developer asks.

## [2026-11-18] Dashboard behaviour details (T5–T9)

- **Context**: Several implementation choices aren't fixed by the requirement or the answers.
- **Decision**:
  - **Alert banner:** `role="alert"` sits on the banner itself, which is toggled with `hidden`, so it's announced when shown. The list is rebuilt only when the set of active alerts changes, so it isn't re-announced every 5 s.
  - **Order:** the tiles come right after the banner in the page source, then the chart, then Feed. This is the at-a-glance order, and the reading order matches the visual order on mobile.
  - **WebSocket backoff** resets only after a **valid telemetry frame**, not on `onopen`. A server that accepts and then immediately drops the socket (for example a bad token) keeps backing off instead of retrying every 1 s.
  - **Server error frames** (`errorCode ≠ 0` on our subscription) close the socket and go through the normal reconnect, including the Q5 token check.
  - **Chart:**
    - A temperature sample is a gap if it's invalid or if `sensorFault` is true at the same timestamp (otherwise the latest known fault state is used).
    - Valid values outside 20–35 °C are clipped to the plot.
    - Timestamps more than 2 s in the future are clamped to now.
    - Reference labels are drawn last on a solid chip so the line can't hide them.
    - "-5 min" and "now" are always shown; minute labels in between are skipped if they would overlap on narrow screens.
  - **Connection pill:**
    - `Connecting…` while the socket opens
    - `Connected / Waiting for data` after it opens, until the first frame
    - `Live` with "Updated HH:MM:SS", using the server timestamp of the newest data
    - `No data` after 30 s without a frame
    - `Reconnecting… / Retry in N s` between attempts
  - **Page lifecycle:** `pagehide` tears down the socket and timers. A page restored from the back/forward cache reloads, so the session guard and a fresh socket apply.
- **Alternatives**: Resetting the backoff on `onopen` was rejected because of the reconnect storm it causes against an auth-rejecting server. Re-announcing the alerts on every frame was rejected because screen-reader users would hear them constantly.

## [2026-11-18] Phase 5: CSS literals tokenised; technical constants exempt; JWT-in-URL accepted

- **Context**: The Phase 5 review found literal design values still in CSS rules: animation durations, 2px strokes, focus offset, motion offsets, bubble start/drift. Requirement § CSS says "controlled by CSS variables only". The security pass also flagged that the WebSocket carries the JWT in its URL.
- **Decision**:
  - All design values are now tokens in `common.css` (and `:root` of the page files): `--duration-spin`, `--duration-shimmer`, `--duration-blink`, `--duration-pulse`, `--press-offset`, `--enter-offset`, `--pulse-spread`, `--focus-ring-offset`, `--stroke-indicator`, `--bubble-start`, `--bubble-drift`.
  - Three technical constants stay literal and are commented in `common.css`: the 1px `.visually-hidden` clip pattern, the 100rem autofill inset hack, and the 1ms reduced-motion override. None of them is a design value.
  - **JWT in the WS URL:** accepted residual risk, severity **low**. ThingsBoard's telemetry WebSocket and contract § 7 require it. Mitigations: WSS only, short-lived JWT, refreshed via § 2, never logged by the app. It is not a Halt condition because it is the platform's required design, not a defect.
- **Alternatives**: Tokenising the technical constants was rejected because it adds noise without any design meaning. Sending the JWT after connecting (an auth command) isn't in the contract, so it would need the developer's approval.

## [2026-11-20] TinyML warning: implementation details (Q17)

- **Context**: Q17 asks for the smallest change that surfaces the TinyML anomaly without touching working features.
- **Decision**:
  - **Firmware:**
    - Hysteresis counters `aiHighCount` / `aiLowCount` (3 to turn on, 5 to turn off).
    - The 10 s beep window is measured from `aiAlertStartMs`.
    - The buzzer priority order is unchanged: water low, then sensor fault, then AI.
    - All AI state is reset while `sensorFault` is true.
    - `aiScore` is guarded with `isfinite` and clamped to −99.99…9999.99 before `%.2f`. A `nan` would make the whole JSON invalid, so ThingsBoard would drop all 8 keys. The clamp also keeps the payload at most 134 bytes.
  - **Web:**
    - The bar uses `role="status"` (polite, advisory) rather than `role="alert"`, which stays reserved for the red device alarms.
    - The score sits in an `aria-live="off"` span, so the 5 s score updates aren't re-announced.
    - The "⚠" is rendered as the same SVG triangle as the red banner, for visual consistency.
    - The bar is hidden when `aiAlert` is false, invalid or missing. The score shows `--` if it is invalid.
- **Alternatives**:
  - `role="alert"` for the AI bar was rejected because an advisory would interrupt screen readers like a real alarm.
  - Removing the per-score `[AI]` Serial print was rejected as out of scope ("do not change other working parts").
