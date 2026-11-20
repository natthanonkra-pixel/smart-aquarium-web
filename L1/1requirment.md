# Requirement and Structure — Smart Aquarium

> **Goal:** Build a clean, responsive IoT dashboard (Login + Dashboard) for an automatic aquarium with HTML, CSS & vanilla JavaScript, integrating ThingsBoard REST API & WebSocket for real-time telemetry and a remote feed command.
>
> **Related files:** standards → `Skill.md` · process → `L1/2builder.md` · API paths, payloads & sensor ranges → `L1/3api-contract.md` · developer answers → `CLARIFICATIONS.md`

---

## HTML

### Login Page

- Input fields for **username** and **password**
- Button: `Login to Dashboard`

### Dashboard Page

- Single `Logout` button → navigates back to Login

#### Lab A1: "Aquarium Room" Dashboard

> **Concept:** A calm, aquarium-style monitoring screen. The owner sees at a glance whether the water is safe, and can feed the fish remotely.

**MQTT Telemetry Payload (from device, every 5 s):**

```json
{
  "temperature": 27.5,
  "fan": false,
  "waterLow": false,
  "sensorFault": false,
  "sun": 64,
  "feedCount": 2,
  "aiScore": 0.84,
  "aiAlert": false
}
```

> `aiScore` / `aiAlert` added 2026-11-20 (TinyML anomaly, `CLARIFICATIONS.md` Q17).

**Serial monitor format** (device side, for reference only — the dashboard never reads serial output):
```
20:17:55 | Temp 27.5 C | Fan OFF | Water OK | Sun  64%
```

---

##### 1. Water Temperature Trend Chart

- A **line chart** of `temperature` over a **rolling window of the last 5 minutes** — draw every point received in that window and drop older points (≈60 points at 1 message / 5 s)
- Draw two **horizontal reference lines**: fan-ON threshold **30 °C** and fan-OFF threshold **28 °C**, each labelled
- Y-axis fixed at **20 °C – 35 °C**, labelled in **°C**; X-axis labelled in minutes ago (`-5 min` … `now`)
- Skip (do not plot) samples where `sensorFault` is `true` or the value is invalid — leave a gap instead of drawing a false point
- Render using **HTML5 `<canvas>`** — no external charting libraries

##### 2. Status Tiles (Live Numeric / State Display)

A grid of tiles (CSS Grid — see `Skill.md` § Layout & Responsiveness), updated in real time:

| Tile | Key | Display |
| --- | --- | --- |
| Water temperature | `temperature` | value with 1 decimal + `°C`; `--` while `sensorFault` is `true` |
| Cooling fan | `fan` | `ON` / `OFF` with a fan icon that spins (CSS animation) while ON |
| Water level | `waterLow` | `OK` (calm style) / `LOW` (alert style) |
| Temperature sensor | `sensorFault` | `OK` / `FAULT` (alert style) |
| Light | `sun` | value + `%` and a small horizontal bar filled to that percentage |
| Feeds since boot | `feedCount` | integer |

- Units are exactly what the device sends — no unit conversion

##### 3. Alert Banner

- A banner at the top of the dashboard that is **hidden** when everything is normal
- Shows when `waterLow` is `true` → "Water level low — refill the tank"
- Shows when `sensorFault` is `true` → "Temperature sensor fault — fan forced ON"
- If both are true, show both messages
- Must be readable by screen readers (`role="alert"` or `aria-live="assertive"`)

##### 4. Feed Now Button

- A button `Feed Now` that sends the **feed RPC** (`L1/3api-contract.md` § 6)
- While waiting for the device reply → button disabled with a spinner, text `Feeding…`
- **On success** → show "Fed at HH:MM" (local time of the browser) and update the feed count from the reply
- **On failure** → show the friendly message from the contract table and re-enable the button
- Prevent double-clicks: ignore clicks while a command is in flight

##### 5. AI Warning Bar (TinyML anomaly — added 2026-11-20, `CLARIFICATIONS.md` Q17)

- A **yellow** bar below the alert banner: "⚠ Unusual temperature pattern — check the tank (AI score X.X)" — `aiScore` with 1 decimal (`--` if invalid)
- Shown only while `aiAlert` is `true`; hidden when `false`, invalid, or not received
- Advisory only — separate from the red alert banner; no new chart or page

---

## Out of Scope (A1)

Do not build these — ask the developer first if one seems necessary:

- Device picker or multi-device support (use the first device of the customer)
- Historical telemetry queries or date-range charts (the chart only shows data received since the page opened)
- Changing feed times, temperature thresholds, or any device configuration
- User registration, password reset, or account settings
- ThingsBoard alarms or notifications
- Any custom backend server

---

## Output Location

Write all web app files in `AquariumApp/` (relative to the project root): `login.html`, `dashboard.html`, `css/`, `js/`. Open `AquariumApp/login.html` to start the app.

---

## CSS

- Controlled by **CSS variables only**
- Style: dark **deep-water** theme (navy / teal palette, HSL-tuned), mobile-first, responsive (breakpoints: 320px, 768px, 1280px)
- Split CSS file per HTML page (`login.css`, `dashboard.css`)
- Each page CSS file uses `@import common.css`
- `common.css` contains global CSS variables and base styles

---

## JavaScript

> Module-based — uses only native browser `fetch` API for all HTTP requests

| Purpose | Logical name | Real path (from `L1/3api-contract.md`) | Auth |
| ------- | ------------ | -------------------------------------- | ---- |
| Login | `/login` | `POST /api/auth/login` | JSON body `{ username, password }` |
| Refresh token | `/oauth2/token` | `POST /api/auth/token` | JSON body `{ refreshToken }` |
| Get Customer ID | `/customer/credentials` | `GET /api/auth/user` | `X-Authorization: Bearer {token}` |
| Get Device ID | — | `GET /api/customer/{customerId}/devices` | `X-Authorization: Bearer {token}` |
| Get Device Access Token | `/device/credentials` | `GET /api/device/{deviceId}/credentials` | `X-Authorization: Bearer {token}` |
| Feed command | RPC | `POST /api/rpc/twoway/{deviceId}` (see `L1/3api-contract.md` § 6) | `X-Authorization: Bearer {token}` |
| Real-time telemetry | WebSocket | `wss://.../api/ws/plugins/telemetry?token={token}` | JWT `token` in the URL |

> **Full API contract** (base URL, request/response schemas, WS subscription format): see `L1/3api-contract.md`. If this table and the contract disagree, the contract wins.

---

## Flow

### Login Page

1. User submits credentials (a **Customer User** account)
2. Use REST API to login → obtain `token` & `refreshToken`
3. Use REST API to get the **Customer ID** of the logged-in user
4. Use REST API to get the **Device ID** from the Customer ID
5. Use REST API to get the device **Access Token** from the Device ID
6. **On success** (all of steps 2–5) → navigate to Dashboard
7. **On failure** (any of steps 2–5) → stay on Login and display a user-friendly error message

### Dashboard Page

1. If there is no session (not logged in) → redirect to Login
2. Use **WebSocket** to subscribe to the eight telemetry keys (see `L1/3api-contract.md` § 7) and update all 5 widgets
3. Use **REST API** to post the feed RPC command to ThingsBoard
4. On logout → clear the session, close the WebSocket, and navigate back to Login
