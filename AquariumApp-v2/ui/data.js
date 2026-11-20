/**
 * data.js â€” telemetry state for the React UI.
 *
 * LIVE mode reuses the original, tested modules unchanged:
 *   ws.js (ThingsBoard WebSocket + reconnect), telemetry.js (validation),
 *   rpc.js (feed RPC), session.js (sessionStorage only).
 * DEMO mode generates simulated values in the browser and is always labelled
 * "Demo Mode" in the UI. No token or secret is stored in this code.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { CHART_WINDOW_MS, STALE_AFTER_MS, PAGES } from '../js/config.js';
import * as session from '../js/session.js';
import { endSessionAndRedirect } from '../js/api.js';
import { createTelemetrySocket } from '../js/ws.js';
import { sendFeed, FEED_MESSAGES } from '../js/rpc.js';

export const DEMO_KEY = 'demoMode';

export function isDemo() {
  try { return window.sessionStorage.getItem(DEMO_KEY) === '1'; } catch { return false; }
}
export function enterDemo() {
  session.clearSession();
  try { window.sessionStorage.setItem(DEMO_KEY, '1'); } catch { /* ignore */ }
}
export function logout() {
  session.clearSession();
  try { window.sessionStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
  window.location.replace(PAGES.login);
}

const KEYS = ['temperature', 'fan', 'waterLow', 'sensorFault', 'sun', 'feedCount', 'aiScore', 'aiAlert'];
const emptyValues = () => Object.fromEntries(KEYS.map((k) => [k, undefined]));

/** Value helper: undefined (never) | null (invalid) | actual value */
export const val = (s) => (s === undefined ? undefined : s.valid ? s.value : null);

/* ---------------------------------------------------------------------- */
/* Demo generator                                                          */
/* ---------------------------------------------------------------------- */

function demoSample(t, feedCount) {
  const now = new Date();
  const hour = now.getHours() + now.getMinutes() / 60;
  // simulated sunrise 06:00 â†’ sunset 18:00 curve
  const sun = hour < 6 || hour > 18 ? 0 : Math.round(Math.sin(((hour - 6) / 12) * Math.PI) * 100);
  const temperature = 26.4 + Math.sin(t / 40) * 0.6 + Math.sin(t / 7) * 0.12;
  const fan = temperature > 26.8;
  // a short simulated anomaly every ~3 minutes so the AI banner can be seen
  const cycle = t % 180;
  const anomaly = cycle > 150 && cycle < 170;
  return {
    temperature: { valid: true, value: Number((anomaly ? temperature + 2.4 : temperature).toFixed(2)) },
    fan: { valid: true, value: anomaly || fan },
    waterLow: { valid: true, value: false },
    sensorFault: { valid: true, value: false },
    sun: { valid: true, value: sun },
    feedCount: { valid: true, value: feedCount },
    aiScore: { valid: true, value: anomaly ? 4.2 : 0.3 + Math.abs(Math.sin(t / 9)) * 0.4 },
    aiAlert: { valid: true, value: anomaly },
  };
}

/* ---------------------------------------------------------------------- */
/* Hook                                                                    */
/* ---------------------------------------------------------------------- */

/**
 * @returns {{
 *   mode: 'live'|'demo', values: object, history: Array<{ts:number,temp:number|null}>,
 *   conn: {state:string, label:string}, lastTs: number,
 *   feed: () => Promise<{ok:boolean, message?:string}>, feedTick: number
 * }}
 */
export function useAquarium({ preview = false } = {}) {
  const [mode] = useState(() => (preview || isDemo() ? 'demo' : 'live'));
  const [values, setValues] = useState(emptyValues);
  const [history, setHistory] = useState([]);
  const [socketState, setSocketState] = useState('connecting');
  const [lastAt, setLastAt] = useState(0);
  const [lastTs, setLastTs] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [feedTick, setFeedTick] = useState(0);
  const openedAt = useRef(Date.now());
  const demoFeed = useRef(12);

  // guard: live mode without a session â†’ back to Login
  useEffect(() => {
    if (mode === 'live' && !session.hasSession()) session.redirectToLogin();
  }, [mode]);

  const pushHistory = useCallback((samples) => {
    setHistory((prev) => {
      const next = prev.concat(samples);
      const cutoff = Date.now() - CHART_WINDOW_MS;
      return next.filter((p) => p.ts >= cutoff).slice(-400);
    });
  }, []);

  // LIVE: ThingsBoard WebSocket
  useEffect(() => {
    if (mode !== 'live' || !session.hasSession()) return undefined;
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
  }, [mode, pushHistory]);

  // DEMO: simulated stream every 2 s (with 2 min of back-filled history)
  useEffect(() => {
    if (mode !== 'demo') return undefined;
    const start = Date.now();
    const seed = [];
    for (let i = 60; i > 0; i -= 1) {
      const ts = start - i * 2000;
      seed.push({ ts, temp: demoSample((ts - start) / 1000 + 400, 0).temperature.value });
    }
    setHistory(seed);
    const tick = () => {
      const ts = Date.now();
      const sample = demoSample((ts - start) / 1000 + 400, demoFeed.current);
      Object.values(sample).forEach((s) => { s.ts = ts; });
      setValues(sample);
      setLastAt(ts);
      setLastTs(ts);
      setSocketState('open');
      pushHistory([{ ts, temp: sample.temperature.value }]);
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [mode, pushHistory]);

  // clock for "stale" detection
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  let conn;
  if (mode === 'demo') conn = { state: 'demo', label: 'Demo Mode' };
  else if (socketState === 'reconnecting') conn = { state: 'reconnecting', label: 'Reconnectingâ€¦' };
  else if (socketState === 'connecting') conn = { state: 'connecting', label: 'Connectingâ€¦' };
  else {
    const waited = lastAt ? now - lastAt : now - openedAt.current;
    conn = waited > STALE_AFTER_MS
      ? { state: 'stale', label: 'No live data' }
      : lastAt ? { state: 'live', label: 'System Online' } : { state: 'connecting', label: 'Waiting for data' };
  }

  const feed = useCallback(async () => {
    if (mode === 'demo') {
      await new Promise((r) => setTimeout(r, 700));
      demoFeed.current += 1;
      setValues((p) => ({ ...p, feedCount: { valid: true, value: demoFeed.current, ts: Date.now() } }));
      setFeedTick((n) => n + 1);
      return { ok: true };
    }
    let result;
    try { result = await sendFeed(); } catch { result = { ok: false, message: FEED_MESSAGES.failed }; }
    if (result.ok) {
      setFeedTick((n) => n + 1);
      if (typeof result.feedCount === 'number') {
        setValues((p) => ({ ...p, feedCount: { valid: true, value: result.feedCount, ts: Date.now() } }));
      }
    }
    return result;
  }, [mode]);

  return { mode, values, history, conn, lastTs, feed, feedTick };
}
