# Clarifications

> Phase 2.5 Clarification Gate (`L1/2builder.md`). Each question has a **proposed default**. Reply with the question number and "agree", or give your own answer. I will not plan or build until every answer is recorded here.
>
> Status: **All 14 questions answered (2026-11-18).**

---

## [2026-11-18] Q1. How the app is opened (`file://` vs ES Modules)

- **Question**: There's a conflict between two input files. `Skill.md` § Tech Stack requires ES Modules (`<script type="module">`). `L1/1requirment.md` § Output Location says "Open `AquariumApp/login.html`". Chrome and Edge block module scripts loaded from `file://` because the origin is `null`, so double-clicking the file will show a blank page. Which option do you want?
  - (a) Serve `AquariumApp/` with a plain static file server, e.g. `python -m http.server 8000` (Python 3.14 is installed; Node.js is not) or VS Code Live Server, then open `http://localhost:8000/login.html`. This only serves files; it is not a custom backend.
  - (b) Drop ES Modules and use classic `<script>` tags so `file://` works.
- **Proposed default**: (a). I'll add the start command to `DECISION.md`.
- **Answer**: (a), ES Modules. The developer opens the app with VS Code Live Server (Go Live). `python -m http.server` is the backup.
- **Impact**: All `js/` files, both HTML pages, how you test each milestone

## [2026-11-18] Q2. Which device to use

- **Question**: `L1/3api-contract.md` § 4 says "Decision required": should the app use the first device (`data[0]`), or filter by `name` (for example `"Aquarium"`)?
- **Proposed default**: Use the first device (`data[0]`), as `L1/1requirment.md` § Out of Scope says.
- **Answer**: Agree: use the first device (`data[0]`).
- **Impact**: `js/auth.js` (login chain step 4)

## [2026-11-18] Q3. Storing the device access token

- **Question**: Login step 5 fetches the device access token (`credentialsId`), and the contract lists `deviceAccessToken` as a sessionStorage key. Nothing on the dashboard uses it, though. WebSocket and RPC both use the user JWT. Anyone who has this token can publish fake telemetry as the device. Which option do you want?
  - (a) Store it in sessionStorage, as the contract says.
  - (b) Call the endpoint so the step must succeed, but don't store the token.
- **Proposed default**: (a), to match the contract. The risk is low because sessionStorage is tab-scoped and the app has no `innerHTML` with server data. I'll log the trade-off in `DECISION.md`.
- **Answer**: Follow the `L1/1requirment.md` flow: fetch the token to prove the device is reachable, and keep it in sessionStorage only (`deviceAccessToken`). Never show it on screen and never log it.
- **Impact**: `js/auth.js`, `js/session.js`

## [2026-11-18] Q4. Login error messages for steps 3–5

- **Question**: The contract defines messages only for the login call (§ 1). What should the user see when a later step fails?
- **Proposed default**:
  - User has no `customerId` (for example a tenant admin): "This account is not linked to a customer"
  - Customer has no devices (`data` is empty): "No aquarium device is assigned to this account"
  - Credentials call fails (403/404): "Could not access the aquarium device"
  - Any 5xx: "Server unavailable — try again later"
  - Network error or 10 s timeout: "Connection timed out — check your network"
  - In every failure case, clear any partial session data from sessionStorage
- **Answer**: Agree with the proposed messages; clear partial session data on failure.
- **Impact**: `js/auth.js`, `login.html`

## [2026-11-18] Q5. WebSocket when the JWT expires

- **Question**: The WebSocket sends the JWT in its URL. When the JWT expires (about 2.5 h on thingsboard.cloud), every reconnect fails and the backoff loops forever. `Skill.md` only defines a token refresh for a REST `401`. Can the WebSocket reconnect use the same single refresh?
- **Proposed default**: Yes. Before each reconnect, read the `exp` claim from the JWT payload. This only reads the claim; it does not verify the signature. If the token has expired or expires within 60 s, call `POST /api/auth/token` once. If that refresh fails, clear the session and redirect to Login.
- **Answer**: Agree: before reconnecting, refresh the token once. If the refresh fails, go back to Login.
- **Impact**: `js/ws.js`, `js/api.js`

## [2026-11-18] Q6. Chart time axis

- **Question**: Should the chart's x-axis use the server timestamp in each WebSocket sample or the browser's receive time? The first message is the stored latest value, so it can be old.
- **Proposed default**: Use the server timestamp. Drop points older than 5 min relative to the browser clock. Redraw once per second so the window keeps sliding when no data arrives. An old first value just falls outside the window. If you have noticeable clock skew, the other option is the receive time.
- **Answer**: Agree: use the server timestamp, a 5-min window measured against the browser clock, and redraw every 1 s.
- **Impact**: `js/chart.js`

## [2026-11-18] Q7. Chart gaps when data stops

- **Question**: `L1/1requirment.md` asks for a gap on `sensorFault` or invalid samples. Should the line also break when no samples arrive for a while, for example when the device goes offline?
- **Proposed default**: Yes. Break the line when two consecutive points are more than 15 s apart (3× the 5 s interval).
- **Answer**: Agree: break the line when consecutive points are more than 15 s apart.
- **Impact**: `js/chart.js`

## [2026-11-18] Q8. Tile fallback for invalid or out-of-range values

- **Question**: `Skill.md` allows either "last known good value" or `--`. Which should the tiles show?
- **Proposed default**: Show `--` with a muted style. For booleans, `--` means "unknown", and an unknown `waterLow` or `sensorFault` does not show the alert banner. Temperature always shows `--` while `sensorFault` is `true`, as required.
- **Answer**: Agree: show `--` (muted) for invalid values. An unknown boolean does not trigger the banner.
- **Impact**: `js/dashboard.js`, `css/dashboard.css`

## [2026-11-18] Q9. Connection and stale-data indicator (scope)

- **Question**: The requirements don't mention it. Can I add a small status pill in the dashboard header?
  - It shows `Live` / `Reconnecting…` / `Offline`, plus "Updated HH:MM:SS".
  - It switches to "No data for 30 s" when the device stops sending.
  - It stays separate from the alert banner, which stays reserved for the two device alerts.
- **Proposed default**: Yes. Without it, a dead connection looks like a calm tank.
- **Answer**: Agree: add a small `Live` / `Reconnecting…` / `No data` indicator.
- **Impact**: `dashboard.html`, `js/ws.js`, `css/dashboard.css`

## [2026-11-18] Q10. Feed reply edge cases

- **Question**: What happens when the RPC returns HTTP 200 but the reply isn't a clean success?
- **Proposed default**:
  - `success: false` → "Command failed — retry", and the button is re-enabled
  - `success: true` but `feedCount` is missing or invalid → still show "Fed at HH:MM" and keep the current count (telemetry will correct it)
  - "Fed at HH:MM" stays visible until the next feed or a page reload
- **Answer**: Agree with the proposed handling.
- **Impact**: `js/rpc.js`, `js/dashboard.js`

## [2026-11-18] Q11. Login page when a session already exists

- **Question**: If `login.html` is opened in a tab that still has a session, should it go straight to the dashboard or always show the form?
- **Proposed default**: Always show the form. A new login replaces the old session.
- **Answer**: Agree: always show the login form.
- **Impact**: `js/login.js`

## [2026-11-18] Q12. Logout scope

- **Question**: Should logout be client-side only (clear sessionStorage, close the WebSocket, redirect)? Or should it also call ThingsBoard `POST /api/auth/logout`, which is not in the contract?
- **Proposed default**: Client-side only. I won't call endpoints that aren't in `L1/3api-contract.md`.
- **Answer**: Agree: client-side logout only.
- **Impact**: `js/dashboard.js`, `js/session.js`

## [2026-11-18] Q13. UI language and time format

- **Question**: What language should the UI text use, and what time format?
- **Proposed default**: English, exactly as written in the requirements and contract. Use 24-hour time (`HH:MM`, for example "Fed at 18:05").
- **Answer**: English UI text and 24-hour `HH:MM` time.
- **Impact**: All pages

## [2026-11-18] Q14. How verification will work

- **Question**: I can't open a browser from here, and Node.js isn't installed, so `node --check` isn't available. I can serve the files and check that they load, but these behavior checks need you:
  - a **Customer User** account on thingsboard.cloud with the aquarium device assigned (please don't paste the password here; you enter it in the browser)
  - the **Wokwi device running**, for live telemetry and the Feed RPC (contract §§ 6–7 are still ⏳)
  - checking the browser console and layout at 320 / 768 / 1280 px

  Do you agree to run the check steps I give you at each milestone and report the result?
- **Proposed default**: Yes. Milestones: (1) login done, (2) dashboard with live data, (3) Feed Now, (4) Phase 5 review.
- **Answer**: Agree. The developer runs the browser checks with the Customer User account and Wokwi running. Give a short checklist at each milestone.
- **Impact**: `TASK.md` Verify lines, Human Checkpoints

## [2026-11-18] Q15. M1 result and the 403 on the devices call (ThingsBoard Cloud PE)

- **Question**: Checkpoint M1. Does the login milestone pass in the developer's browser with the real Customer User?
- **Answer**: **M1 pass.** The first real login failed with **403** on `GET /api/customer/{customerId}/devices`, because the Customer User wasn't in any user group. On ThingsBoard Cloud (PE), a user's permissions come from group membership. The developer fixed this in ThingsBoard by adding the user to the customer's **"Customer Users"** group. No code change was requested.
- **Impact**: Environment and account setup only (precondition for `L1/3api-contract.md` § 4). The app already shows "Could not access the aquarium device" for this case (`js/auth.js`). Troubleshooting note in `DECISION.md`.

## [2026-11-18] Q16. M3 result and the firmware RPC reply format

- **Question**: Checkpoint M3. Does Feed Now work against the real Wokwi device?
- **Answer**: **M3 pass (steps 1–7).** The first feed tests failed because the Wokwi firmware replied `{"ok":true}` instead of the contract reply. The developer updated `tbCallback` in the device's `main.cpp` to reply `{"success":true,"feedCount":N}`, as in `L1/3api-contract.md` § 6. The only Console error during step 5 was Chrome's own network log of the expected 504, which is browser output, not an app log.
- **Impact**: The fix was in the device firmware; the web app didn't change. With the old reply the app correctly showed "Command failed — retry", because `success` was not `true` (`js/rpc.js`). Contract §§ 6–7 are now confirmed against the live device.

## [2026-11-20] Q17. TinyML anomaly alert: smallest scope, firmware + web

- **Question**: Should the TinyML (Edge Impulse) anomaly result raise an alert, and where?
- **Answer**: Smallest possible scope. **Do not change anything else that already works.**
  - **Firmware** (`Desktop/Aquarium/src/main.cpp`):
    1. When `sensorFault` is true, set `aiCount = 0` and `aiAlert = false`.
    2. `aiAlert` turns true after 3 consecutive scores above `AI_THRESHOLD` (stays 3.0), and false after 5 consecutive normal scores.
    3. The AI buzzer pattern (beep-beep) sounds only for the first 10 s after the alert starts, then stays silent. The water-low and sensor-fault buzzers stay unchanged.
    4. Add `"aiScore"` (2 decimals) and `"aiAlert"` (true/false) to the existing 5 s telemetry.
  - **Web**:
    5. Show a yellow bar "⚠ Unusual temperature pattern — check the tank (AI score X.X)" while `aiAlert` is true. Hide it when false or when there's no data. No new chart or page.
    6. Update `L1/1requirment.md` and `L1/3api-contract.md`, only the relevant parts. The developer explicitly authorises this edit to the input files.
  - Then give a test checklist of at most 3 steps (Wokwi DS18B20 33 °C, then back to 27 °C).
- **Impact**: `main.cpp` (AI, buzzer, telemetry); `dashboard.html`, `css/dashboard.css`, `js/config.js`, `js/telemetry.js`, `js/dashboard.js`; `L1/1requirment.md`, `L1/3api-contract.md`

## [2026-11-20] Q18. Deploying to Netlify (static hosting)

- **Question**: How is the app published for the form submission?
- **Answer**: The developer deploys `AquariumApp/` by drag-and-drop to Netlify Drop. Add `AquariumApp/index.html` that redirects to `login.html` (meta refresh plus a fallback link), so the bare site URL doesn't show "Page not found". No other files change.
- **Impact**: New `AquariumApp/index.html` only. The app stays a static site that talks to thingsboard.cloud; the real board can replace Wokwi later without redeploying.
