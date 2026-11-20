/**
 * config.js — single place for platform constants.
 * Values come from L1/3api-contract.md (base URLs, paths, keys, ranges)
 * and CLARIFICATIONS.md (Q5, Q7, Q9 thresholds).
 */

export const BASE_URL = 'https://thingsboard.cloud';
export const WS_BASE_URL = 'wss://thingsboard.cloud';

export const PAGES = Object.freeze({
  login: 'login.html',
  dashboard: 'dashboard.html',
});

/** REST paths (contract §1–§6). IDs are URL-encoded by the caller helpers. */
export const API = Object.freeze({
  login: '/api/auth/login',
  refresh: '/api/auth/token',
  currentUser: '/api/auth/user',
  customerDevices: (customerId) =>
    `/api/customer/${encodeURIComponent(customerId)}/devices?pageSize=50&page=0`,
  deviceCredentials: (deviceId) =>
    `/api/device/${encodeURIComponent(deviceId)}/credentials`,
  rpcTwoWay: (deviceId) => `/api/rpc/twoway/${encodeURIComponent(deviceId)}`,
});

/** WebSocket path (contract §7) — the user JWT is appended as ?token= */
export const WS_TELEMETRY_PATH = '/api/ws/plugins/telemetry';

/** sessionStorage keys (contract § Base Configuration) */
export const SESSION_KEYS = Object.freeze({
  token: 'token',
  refreshToken: 'refreshToken',
  customerId: 'customerId',
  deviceId: 'deviceId',
  deviceAccessToken: 'deviceAccessToken',
});

/** Timing (Skill.md § API & Data Handling, § WebSocket Resilience; Q5) */
export const FETCH_TIMEOUT_MS = 10_000;
export const WS_CONNECT_TIMEOUT_MS = 10_000;
export const WS_BACKOFF_START_MS = 1_000;
export const WS_BACKOFF_MAX_MS = 30_000;
export const TOKEN_REFRESH_MARGIN_S = 60;

/** Telemetry (requirement §1–§2, contract §7, Q6/Q7/Q9) */
export const TELEMETRY_KEYS = Object.freeze([
  'temperature', 'fan', 'waterLow', 'sensorFault', 'sun', 'feedCount',
  'aiScore', 'aiAlert', // TinyML anomaly (CLARIFICATIONS Q17)
]);
export const CHART_WINDOW_MS = 5 * 60 * 1000;
export const CHART_GAP_MS = 15_000;
export const STALE_AFTER_MS = 30_000;

/** Sensor value ranges (contract § Sensor Value Ranges) */
export const RANGES = Object.freeze({
  temperature: { min: -10, max: 60 },
  sun: { min: 0, max: 100 },
  feedCount: { min: 0, max: 100_000 },
  aiScore: { min: -100, max: 10_000 },
});

/** Feed RPC (contract §6) */
export const FEED_RPC_BODY = Object.freeze({ method: 'feed', params: {}, timeout: 5000 });
