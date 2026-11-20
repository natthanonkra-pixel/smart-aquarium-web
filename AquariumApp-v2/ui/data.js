/**
 * data.js — telemetry state for the React UI.
 *
 * Reuses the original, tested modules unchanged:
 *   ws.js (ThingsBoard WebSocket + reconnect), telemetry.js (validation),
 *   rpc.js (feed RPC), session.js (sessionStorage only).
 * No token or secret is stored in this code.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { CHART_WINDOW_MS, STALE_AFTER_MS, PAGES } from '../js/config.js';
import * as session from '../js/session.js';
import { endSessionAndRedirect } from '../js/api.js';
import { createTelemetrySocket } from '../js/ws.js';
import { sendFeed, FEED_MESSAGES } from '../js/rpc.js';

export function logout() {
  session.clearSession();
  window.location.replace(PAGES.login);
}

const KEYS = ['temperature', 'fan', 'waterLow', 'sensorFault', 'sun', 'feedCount', 'aiScore', 'aiAlert'];
const emptyValues = () => Object.fromEntries(KEYS.map((k) => [k, undefined]));

/** Value helper: undefined (never) | null (invalid) | actual value */
export const val = (s) => (s === undefined ? undefined : s.valid ? s.value : null);

/**
 * @returns {{
 *   values: object, history: Array<{ts:number,temp:number|null}>,
 *   conn: {state:string, label:string}, lastTs: number,
 *   feed: () => Promise<{ok:boolean, message?:string}>, feedTick: number
 * }}
 */
export function useAquarium() {
  const [values, setValues] = useState(emptyValues);
  const [history, setHistory] = useState([]);
  const [socketState, setSocketState] = useState('connecting');
  const [lastAt, setLastAt] = useState(0);
  const [lastTs, setLastTs] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [feedTick, setFeedTick] = useState(0);
  const openedAt = useRef(Date.now());

  // guard: no session → back to Login
  useEffect(() => {
    if (!session.hasSession()) session.redirectToLogin();
  }, []);

  const pushHistory = useCallback((samples) => {
    setHistory((prev) => {
      const next = prev.concat(samples);
      const cutoff = Date.now() - CHART_WINDOW_MS;
      return next.filter((p) => p.ts >= cutoff).slice(-400);
    });
  }, []);

  // ThingsBoard WebSocket
  useEffect(() => {
    if (!session.hasSession()) return undefined;
    const sock = createTelemetrySocket({
      onTelemetry: (updates) => {
        setLastAt(Date.now());
        setValues((prev) => {
          const next = { ...prev };
          for (const [k, samples] of Object.entries(updates)) {
            const latest = samples[samples.length - 1];
            next[k] = latest.valid ? { valid: true, value: latest.value, ts: latest.ts } : { valid: false, ts: latest.ts };
          }
          return next;
        });
        let newest = 0;
        Object.values(updates).forEach((s) => s.forEach((x) => { newest = Math.max(newest, x.ts); }));
        if (newest) setLastTs((p) => Math.max(p, newest));
        if (updates.temperature) {
          pushHistory(updates.temperature.map((s) => ({ ts: s.ts, temp: s.valid ? s.value : null })));
        }
      },
      onStatus: (s) => {
        if (s === 'open') openedAt.current = Date.now();
        setSocketState(s);
      },
      onAuthFailure: () => endSessionAndRedirect(),
    });
    sock.start();
    return () => sock.stop();
  }, [pushHistory]);

  // clock for "stale" detection
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  let conn;
  if (socketState === 'reconnecting') conn = { state: 'reconnecting', label: 'Reconnecting…' };
  else if (socketState === 'connecting') conn = { state: 'connecting', label: 'Connecting…' };
  else {
    // age of the newest data point (server timestamp), so an old snapshot is not shown as "online"
    const waited = lastTs ? now - lastTs : now - openedAt.current;
    conn = waited > STALE_AFTER_MS
      ? { state: 'stale', label: 'No live data' }
      : lastAt ? { state: 'live', label: 'System Online' } : { state: 'connecting', label: 'Waiting for data' };
  }

  const feed = useCallback(async () => {
    let result;
    try { result = await sendFeed(); } catch { result = { ok: false, message: FEED_MESSAGES.failed }; }
    if (result.ok) {
      setFeedTick((n) => n + 1);
      if (typeof result.feedCount === 'number') {
        setValues((p) => ({ ...p, feedCount: { valid: true, value: result.feedCount, ts: Date.now() } }));
      }
    }
    return result;
  }, []);

  return { values, history, conn, lastTs, feed, feedTick };
}
