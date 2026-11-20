# ThingsBoard API Contract — Smart Aquarium

> **Version:** A1.1 · **Last Updated:** 2026-11-20 (A1.1: `aiScore`, `aiAlert` telemetry keys — `CLARIFICATIONS.md` Q17)
> **Based on:** the L1 contract (§1–§5 unchanged — tested 2026-10-13 with `CUSTOMER_USER` on `thingsboard.cloud`). §6–§7 and the value ranges are **new for the aquarium firmware** and must be confirmed with the live (Wokwi) device — see "Verified" column.
>
> Example payloads keep every field the server returns. IDs, emails and tokens are examples, not values to hard-code.

---

## Base Configuration

| Parameter | Value |
| --- | --- |
| **Base URL** | `https://thingsboard.cloud` (developer decision — do not use `demo.thingsboard.io`) |
| **WS URL** | `wss://thingsboard.cloud` |
| **Headers on every REST call** | `Accept: application/json`; add `Content-Type: application/json` when sending a body |
| **Auth header** (all calls except §1–§2) | `X-Authorization: Bearer {token}` — ThingsBoard's own header, not `Authorization` |
| **sessionStorage keys** | `token`, `refreshToken`, `customerId`, `deviceId`, `deviceAccessToken` |

| § | Purpose | Method + path | Verified |
| --- | --- | --- | --- |
| 1 | Login | `POST /api/auth/login` | ✅ 200 (L1) |
| 2 | Refresh token | `POST /api/auth/token` | ✅ 200 (L1) |
| 3 | Customer ID | `GET /api/auth/user` | ✅ 200 (L1) |
| 4 | Device ID | `GET /api/customer/{customerId}/devices?pageSize=50&page=0` | ✅ 200 (L1) |
| 5 | Device access token | `GET /api/device/{deviceId}/credentials` | ✅ 200 (L1) |
| 6 | Feed command | `POST /api/rpc/twoway/{deviceId}` | ⏳ confirm with Wokwi device online |
| 7 | Live telemetry | `wss://…/api/ws/plugins/telemetry?token={token}` | ⏳ confirm in browser |

---

## 1. Authentication — Login

### `POST /api/auth/login` — no auth header

> Maps to `POST /login` in `1requirment.md`. ThingsBoard uses a **JSON body**, not HTTP Basic Auth.

**Request:**

```json
{
  "username": "customer@example.com",
  "password": "customerPassword"
}
```

**Response (200 OK):**

```json
{
  "token": "eyJhbGciOiJIUzUxMiJ9...",
  "refreshToken": "eyJhbGciOiJIUzUxMiJ9..."
}
```

| Status | Meaning | UI Action |
| --- | --- | --- |
| 401 | Invalid credentials | Show "Invalid username or password" |
| 400 | Malformed request | Show "Login request failed — check input" |
| 5xx | Server error | Show "Server unavailable — try again later" |

---

## 2. Token Refresh

### `POST /api/auth/token` — no auth header

> Maps to `POST /oauth2/token` in `1requirment.md`. Returns **both** a new `token` and a new `refreshToken`.

**Request:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzUxMiJ9..."
}
```

**Response (200 OK):**

```json
{
  "token": "eyJhbGciOiJIUzUxMiJ9...",
  "refreshToken": "eyJhbGciOiJIUzUxMiJ9..."
}
```

| Status | Meaning | UI Action |
| --- | --- | --- |
| 401 | Refresh token expired/invalid | Redirect to login page |

---

## 3. Get Current User (→ Customer ID)

### `GET /api/auth/user`

> Maps to `GET /customer/credentials` in `1requirment.md`.

**Response (200 OK):**

```json
{
  "id": {
    "entityType": "USER",
    "id": "64cd0610-ef68-11ef-8e00-e370a74757c3"
  },
  "createdTime": 1740041711857,
  "tenantId": {
    "entityType": "TENANT",
    "id": "150fa630-e4a4-11ed-a4fc-57550caf43ca"
  },
  "customerId": {
    "entityType": "CUSTOMER",
    "id": "4ac42320-ef68-11ef-8e00-e370a74757c3"
  },
  "email": "customer@example.com",
  "authority": "CUSTOMER_USER",
  "firstName": "Student",
  "lastName": "Demo",
  "phone": null,
  "version": 3,
  "name": "customer@example.com",
  "additionalInfo": {
    "description": "",
    "defaultDashboardId": null,
    "defaultDashboardFullscreen": false,
    "homeDashboardId": null,
    "homeDashboardHideToolbar": true,
    "userCredentialsEnabled": false,
    "userActivated": false,
    "lastLoginTs": null
  }
}
```

**Key field:** `customerId.id` → `{customerId}`. A non-customer account (e.g. tenant admin) has no usable `customerId`.

---

## 4. Get Customer Devices (→ Device ID)

### `GET /api/customer/{customerId}/devices?pageSize=50&page=0`

> Maps to Login flow step 4 in `1requirment.md`.

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": {
        "entityType": "DEVICE",
        "id": "f591e0a0-3af6-11f1-9681-6110e8f55c0f"
      },
      "createdTime": 1776496778154,
      "tenantId": {
        "entityType": "TENANT",
        "id": "150fa630-e4a4-11ed-a4fc-57550caf43ca"
      },
      "customerId": {
        "entityType": "CUSTOMER",
        "id": "4ac42320-ef68-11ef-8e00-e370a74757c3"
      },
      "name": "Aquarium",
      "type": "Default",
      "label": "",
      "deviceProfileId": {
        "entityType": "DEVICE_PROFILE",
        "id": "151328a0-e4a4-11ed-a4fc-57550caf43ca"
      },
      "firmwareId": null,
      "softwareId": null,
      "externalId": null,
      "version": 3,
      "additionalInfo": {
        "gateway": false
      },
      "deviceData": {
        "configuration": { "type": "DEFAULT" },
        "transportConfiguration": { "type": "DEFAULT" }
      }
    }
  ],
  "totalPages": 1,
  "totalElements": 1,
  "hasNext": false
}
```

**Key field:** `data[0].id.id` → `{deviceId}`. `data` is empty when no device is assigned to the customer.

> **Decision required:** If multiple devices exist, select the **first device** by default. If the lab setup requires a specific device, filter by `name`.

---

## 5. Get Device Credentials (→ Access Token)

### `GET /api/device/{deviceId}/credentials`

> Maps to `GET /device/credentials` in `1requirment.md`. Returns `200` for a `CUSTOMER_USER` when the device is assigned to that customer.

**Response (200 OK):**

```json
{
  "id": {
    "id": "f593dc70-3af6-11f1-9681-6110e8f55c0f"
  },
  "createdTime": 1776496778167,
  "deviceId": {
    "entityType": "DEVICE",
    "id": "f591e0a0-3af6-11f1-9681-6110e8f55c0f"
  },
  "credentialsType": "ACCESS_TOKEN",
  "credentialsId": "A1b2C3d4E5f6G7h8I9j0",
  "credentialsValue": null,
  "version": 1
}
```

**Key field:** `credentialsId` — the plain device access token string (`credentialsType` is `ACCESS_TOKEN`).

---

## 6. RPC — Feed Command

### `POST /api/rpc/twoway/{deviceId}`

> **Feeding must use twoway RPC** with method `feed` — the server waits for the device reply, so the dashboard can confirm the servo ran. Path is `/api/rpc/…`, **not** `/api/plugins/rpc/…`.
>
> **Device firmware contract:** only `feed` is handled; `params` is ignored (send `{}`). The device opens the feeder lid for 1 s, then replies. Any other method gets `{"success": false}`.

**Request:**

```json
{
  "method": "feed",
  "params": {},
  "timeout": 5000
}
```

**Response (200 OK)** — reply from the device:

```json
{
  "success": true,
  "feedCount": 3
}
```

> `feedCount` = total feeds since the device booted (includes scheduled feeds at 08:00 and 18:00). It is also sent as telemetry (§7).

| Status | Meaning | UI Action |
| --- | --- | --- |
| 504 / 408 | Device offline / timeout | Show "Device not responding" |
| 0 (fetch timeout, 10 s) | No response from server | Show "Connection timed out" |
| 401 | Token expired | Trigger reactive token refresh |
| other | Server error | Show "Command failed — retry" |

---

## 7. WebSocket — Telemetry Subscription

### Connection

```
wss://thingsboard.cloud/api/ws/plugins/telemetry?token={token}
```

> Use the user JWT `token` from §1 — **not** the device access token.

### Subscribe (send once after `onopen`)

```json
{
  "tsSubCmds": [
    {
      "entityType": "DEVICE",
      "entityId": "<DEVICE_ID>",
      "scope": "LATEST_TELEMETRY",
      "keys": "temperature,fan,waterLow,sensorFault,sun,feedCount,aiScore,aiAlert",
      "cmdId": 1
    }
  ],
  "historyCmds": [],
  "attrSubCmds": []
}
```

### Incoming — Telemetry (`subscriptionId: 1`)

```json
{
  "subscriptionId": 1,
  "errorCode": 0,
  "errorMsg": null,
  "data": {
    "temperature": [[1794999000000, "27.5"]],
    "fan":         [[1794999000000, "false"]],
    "waterLow":    [[1794999000000, "false"]],
    "sensorFault": [[1794999000000, "false"]],
    "sun":         [[1794999000000, "64"]],
    "feedCount":   [[1794999000000, "2"]],
    "aiScore":     [[1794999000000, "0.84"]],
    "aiAlert":     [[1794999000000, "false"]]
  },
  "latestValues": {
    "temperature": 1794999000000,
    "fan": 1794999000000,
    "waterLow": 1794999000000,
    "sensorFault": 1794999000000,
    "sun": 1794999000000,
    "feedCount": 1794999000000,
    "aiScore": 1794999000000,
    "aiAlert": 1794999000000
  }
}
```

- Each key maps to an array of `[timestamp_ms, "value_string"]` pairs
- **All values are strings** over WebSocket — numbers: `parseFloat()` then validate; booleans: accept only the exact strings `"true"` / `"false"`, anything else is invalid
- The **first** message after subscribing is the stored latest value (it can be old); later messages are live
- The device publishes **one message every 5 seconds** (Wokwi may be slower)

---

## Sensor Value Ranges

> Referenced by `Skill.md` out-of-range guard. Display values as sent — no unit conversion.

| Sensor Key | Valid Range / Values | Unit | Notes |
| --- | --- | --- | --- |
| `temperature` | −10.0 to +60.0 | °C | Water temperature (DS18B20). Firmware sends `0` while the sensor is faulty — when `sensorFault` is `true`, show `--` instead of the number |
| `fan` | `"true"` / `"false"` | — | Cooling fan. Firmware rule: ON at ≥ 30 °C, OFF at ≤ 28 °C, forced ON when `sensorFault` |
| `waterLow` | `"true"` / `"false"` | — | Float switch. `true` = water level low (alarm) |
| `sensorFault` | `"true"` / `"false"` | — | `true` = temperature sensor failed 3 reads in a row |
| `sun` | 0 to 100 | % | Sunrise/sunset LED brightness |
| `feedCount` | 0 to 100000 (integer) | count | Feeds since boot |
| `aiScore` | −100 to 10000 | — | TinyML (Edge Impulse K-means) anomaly score, 2 decimals. Firmware clamps to −99.99 … 9999.99 and sends `0` if not computed |
| `aiAlert` | `"true"` / `"false"` | — | `true` after 3 consecutive scores > 3.0; `false` after 5 consecutive normal scores; forced `false` while `sensorFault` |
