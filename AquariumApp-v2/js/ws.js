/**
 * ws.js — ThingsBoard telemetry WebSocket (contract §7).
 *
 * - URL: wss://thingsboard.cloud/api/ws/plugins/telemetry?token={user JWT}
 * - Sends the §7 subscribe command once per successful open
 * - Exponential backoff reconnect: 1 s, 2 s, 4 s … max 30 s. A connect that is
 *   not open within 10 s counts as a failed attempt (Skill.md § WebSocket Resilience)
 * - Backoff resets only after a valid telemetry message, so a socket that opens
 *   and is immediately closed by the server keeps backing off
 * - Before each reconnect: if the JWT expires within 60 s, refresh ONCE; if the
 *   refresh fails → onAuthFailure (go to Login) (CLARIFICATIONS Q5)
 * - Cleanup on every disconnect: handlers removed, timers cleared, ws.close()
 * The token is read from sessionStorage at connect time and never logged.
 */

import {
  WS_BASE_URL, WS_TELEMETRY_PATH, TELEMETRY_KEYS,
  WS_CONNECT_TIMEOUT_MS, WS_BACKOFF_START_MS, WS_BACKOFF_MAX_MS, TOKEN_REFRESH_MARGIN_S,
} from './config.js';
import * as session from './session.js';
import { refreshTokens } from './api.js';
import { parseTelemetryMessage } from './telemetry.js';

const CMD_ID = 1;

/** Backoff delay for the n-th consecutive failure (0-based). */
export function backoffDelay(attempt) {
  return Math.min(WS_BACKOFF_START_MS * 2 ** attempt, WS_BACKOFF_MAX_MS);
}

/**
 * @param {object} handlers
 * @param {(updates: object) => void} handlers.onTelemetry  validated updates (telemetry.js)
 * @param {(state: 'connecting'|'open'|'reconnecting', info?: {delayMs:number}) => void} handlers.onStatus
 * @param {() => void} handlers.onAuthFailure  session can no longer be used
 */
export function createTelemetrySocket({ onTelemetry, onStatus, onAuthFailure }) {
  let ws = null;
  let connectTimer = null;
  let reconnectTimer = null;
  let attempt = 0;
  let stopped = true;

  function cleanupSocket() {
    clearTimeout(connectTimer);
    connectTimer = null;
    if (!ws) return;
    const socket = ws;
    ws = null;
    socket.onopen = null;
    socket.onmessage = null;
    socket.onerror = null;
    socket.onclose = null;
    if (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN) {
      try { socket.close(1000, 'client closing'); } catch { /* ignore */ }
    }
  }

  function scheduleReconnect() {
    if (stopped) return;
    cleanupSocket();
    clearTimeout(reconnectTimer);
    const delayMs = backoffDelay(attempt);
    attempt += 1;
    onStatus('reconnecting', { delayMs });
    reconnectTimer = setTimeout(reconnect, delayMs);
  }

  async function reconnect() {
    reconnectTimer = null;
    if (stopped) return;
    const remaining = session.secondsUntilTokenExpiry();
    if (remaining !== null && remaining < TOKEN_REFRESH_MARGIN_S) {
      const refreshed = await refreshTokens(); // one attempt, never retried
      if (stopped) return;
      if (!refreshed) {
        stop();
        onAuthFailure();
        return;
      }
    }
    connect();
  }

  function subscribeCommand(deviceId) {
    return JSON.stringify({
      tsSubCmds: [{
        entityType: 'DEVICE',
        entityId: deviceId,
        scope: 'LATEST_TELEMETRY',
        keys: TELEMETRY_KEYS.join(','),
        cmdId: CMD_ID,
      }],
      historyCmds: [],
      attrSubCmds: [],
    });
  }

  function connect() {
    if (stopped) return;
    const token = session.getToken();
    const deviceId = session.getDeviceId();
    if (!token || !deviceId) {
      stop();
      onAuthFailure();
      return;
    }

    onStatus('connecting');
    let socket;
    try {
      socket = new WebSocket(`${WS_BASE_URL}${WS_TELEMETRY_PATH}?token=${encodeURIComponent(token)}`);
    } catch {
      scheduleReconnect();
      return;
    }
    ws = socket;

    connectTimer = setTimeout(() => {
      // Not open within 10 s → failed attempt, advance the backoff.
      scheduleReconnect();
    }, WS_CONNECT_TIMEOUT_MS);

    socket.onopen = () => {
      clearTimeout(connectTimer);
      connectTimer = null;
      try {
        socket.send(subscribeCommand(deviceId));
      } catch {
        scheduleReconnect();
        return;
      }
      onStatus('open');
    };

    socket.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(typeof event.data === 'string' ? event.data : '');
      } catch {
        return; // malformed frame — ignore, keep last good values
      }
      const result = parseTelemetryMessage(msg, CMD_ID);
      if (result.ok) {
        attempt = 0; // healthy stream → reset backoff
        onTelemetry(result.updates);
      } else if (result.reason === 'server-error') {
        scheduleReconnect(); // subscription rejected — reconnect (refreshes the token if it is expiring)
      }
    };

    socket.onerror = () => {
      /* onclose follows; handled there */
    };

    socket.onclose = () => {
      scheduleReconnect();
    };
  }

  function start() {
    if (!stopped) return;
    stopped = false;
    attempt = 0;
    connect();
  }

  function stop() {
    stopped = true;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    cleanupSocket();
  }

  return { start, stop };
}
