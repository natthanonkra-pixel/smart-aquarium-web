/**
 * dashboard.js — Dashboard page controller.
 *
 * Flow (requirement § Flow / Dashboard Page):
 *   1. No session → Login
 *   2. WebSocket telemetry → chart, tiles, alert banner, connection pill
 *   3. Feed Now → twoway RPC (rpc.js)
 *   4. Logout → clear session, close WebSocket, go to Login
 *
 * Every server value is validated in telemetry.js and rendered with
 * textContent only (Skill.md § Security Rules).
 */

import { PAGES, STALE_AFTER_MS } from './config.js';
import * as session from './session.js';
import { endSessionAndRedirect } from './api.js';
import { createTelemetrySocket } from './ws.js';
import { createTemperatureChart } from './chart.js';
import { sendFeed, FEED_MESSAGES } from './rpc.js';

export const ALERT_MESSAGES = Object.freeze({
  waterLow: 'Water level low — refill the tank',
  sensorFault: 'Temperature sensor fault — fan forced ON',
});

const pad2 = (n) => String(n).padStart(2, '0');
/** 24-hour HH:MM (Q13) */
export const formatHM = (date) => `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
const formatHMS = (date) => `${formatHM(date)}:${pad2(date.getSeconds())}`;

/** Latest known value per key: undefined (never received) | {valid:false} | {valid:true, value, ts} */
const state = {
  temperature: undefined,
  fan: undefined,
  waterLow: undefined,
  sensorFault: undefined,
  sun: undefined,
  feedCount: undefined,
  aiScore: undefined,
  aiAlert: undefined,
};

let lastMessageAt = 0; // browser time of the last telemetry frame
let lastDataTs = 0; // newest server timestamp received
let socketState = 'connecting';
let reconnectDelayMs = 0;
let activeAlerts = '';
let openedAt = Date.now(); // when the socket last opened (for "No data" before the first frame)

const $ = (id) => document.getElementById(id);

/* ========================================================================== */
/* Tiles                                                                      */
/* ========================================================================== */

function tileParts(id) {
  const tile = $(id);
  return {
    tile,
    value: tile.querySelector('[data-field="value"]'),
    unit: tile.querySelector('[data-field="unit"]'),
    note: tile.querySelector('[data-field="note"]'),
    bar: tile.querySelector('[data-field="bar"]'),
  };
}

function setTile(id, { state: tileState, value, note, showUnit = true }) {
  const t = tileParts(id);
  t.tile.dataset.state = tileState;
  t.value.classList.remove('skeleton');
  t.value.textContent = value;
  if (t.unit) t.unit.hidden = !showUnit;
  if (t.note && note !== undefined) t.note.textContent = note;
}

const isKnown = (s) => s !== undefined;
const isTrue = (s) => Boolean(s && s.valid && s.value === true);

function renderTemperature() {
  const s = state.temperature;
  if (!isKnown(s)) return;
  if (isTrue(state.sensorFault)) {
    setTile('tile-temperature', { state: 'unknown', value: '--', note: 'Sensor fault — no reading', showUnit: false });
  } else if (!s.valid) {
    setTile('tile-temperature', { state: 'unknown', value: '--', note: 'Invalid reading', showUnit: false });
  } else {
    setTile('tile-temperature', { state: 'ok', value: s.value.toFixed(1), note: `Updated ${formatHMS(new Date(s.ts))}` });
  }
}

function renderFan() {
  const s = state.fan;
  if (!isKnown(s)) return;
  if (!s.valid) {
    setTile('tile-fan', { state: 'unknown', value: '--', note: 'Invalid reading' });
  } else if (s.value) {
    setTile('tile-fan', { state: 'on', value: 'ON', note: isTrue(state.sensorFault) ? 'Forced ON — sensor fault' : 'Cooling the water' });
  } else {
    setTile('tile-fan', { state: 'off', value: 'OFF', note: 'Idle' });
  }
}

function renderWater() {
  const s = state.waterLow;
  if (!isKnown(s)) return;
  if (!s.valid) setTile('tile-water', { state: 'unknown', value: '--', note: 'Invalid reading' });
  else if (s.value) setTile('tile-water', { state: 'alert', value: 'LOW', note: 'Refill the tank' });
  else setTile('tile-water', { state: 'ok', value: 'OK', note: 'Level normal' });
}

function renderSensor() {
  const s = state.sensorFault;
  if (!isKnown(s)) return;
  if (!s.valid) setTile('tile-sensor', { state: 'unknown', value: '--', note: 'Invalid reading' });
  else if (s.value) setTile('tile-sensor', { state: 'alert', value: 'FAULT', note: 'Fan forced ON' });
  else setTile('tile-sensor', { state: 'ok', value: 'OK', note: 'Reading normally' });
}

function renderSun() {
  const s = state.sun;
  if (!isKnown(s)) return;
  const t = tileParts('tile-sun');
  const meter = t.tile.querySelector('[role="meter"]');
  if (!s.valid) {
    setTile('tile-sun', { state: 'unknown', value: '--', showUnit: false });
    t.bar.style.setProperty('--fill', '0%');
    meter.setAttribute('aria-valuenow', '0');
    meter.setAttribute('aria-valuetext', 'unknown');
    return;
  }
  const pct = Math.round(s.value);
  setTile('tile-sun', { state: 'ok', value: String(pct) });
  t.bar.style.setProperty('--fill', `${pct}%`);
  meter.setAttribute('aria-valuenow', String(pct));
  meter.setAttribute('aria-valuetext', `${pct}%`);
}

function renderFeedCount() {
  const s = state.feedCount;
  if (!isKnown(s)) return;
  if (!s.valid) setTile('tile-feed', { state: 'unknown', value: '--', note: 'Invalid reading' });
  else setTile('tile-feed', { state: 'ok', value: String(s.value), note: 'Since device boot' });
}

/** Set the feed count from an RPC reply (rpc.js) — validated by the caller. */
export function applyFeedCount(count) {
  state.feedCount = { valid: true, value: count, ts: Date.now() };
  renderFeedCount();
}

/* ========================================================================== */
/* Alert banner                                                               */
/* ========================================================================== */

function renderAlerts() {
  const active = [];
  if (isTrue(state.waterLow)) active.push('waterLow');
  if (isTrue(state.sensorFault)) active.push('sensorFault');
  const signature = active.join(',');
  if (signature === activeAlerts) return; // unchanged → do not re-announce
  activeAlerts = signature;

  const banner = $('alert-banner');
  const list = $('alert-list');
  list.replaceChildren(
    ...active.map((key) => {
      const li = document.createElement('li');
      li.textContent = ALERT_MESSAGES[key];
      return li;
    }),
  );
  banner.hidden = active.length === 0;
}

/* ========================================================================== */
/* AI warning (TinyML anomaly, CLARIFICATIONS Q17)                            */
/* ========================================================================== */

/** Yellow bar while aiAlert is true; hidden when false, invalid or never received. */
function renderAiWarning() {
  const bar = $('ai-warning');
  const show = isTrue(state.aiAlert);
  const score = state.aiScore && state.aiScore.valid ? state.aiScore.value.toFixed(1) : '--';
  const scoreEl = $('ai-score');
  if (scoreEl.textContent !== score) scoreEl.textContent = score;
  if (bar.hidden === show) bar.hidden = !show;
}

/* ========================================================================== */
/* Connection pill                                                            */
/* ========================================================================== */

function renderConnection() {
  const pill = $('conn');
  const label = $('conn-label');
  const sub = $('conn-updated');
  const stamp = lastDataTs ? `Updated ${formatHMS(new Date(lastDataTs))}` : 'Waiting for data';
  let view;

  if (socketState === 'reconnecting') {
    view = { state: 'reconnecting', label: 'Reconnecting…', sub: `Retry in ${Math.max(1, Math.round(reconnectDelayMs / 1000))} s` };
  } else if (socketState === 'connecting') {
    view = { state: 'connecting', label: 'Connecting…', sub: stamp };
  } else if (!lastMessageAt || Date.now() - lastMessageAt > STALE_AFTER_MS) {
    // open, but nothing for 30 s (or nothing yet after 30 s)
    const waited = lastMessageAt ? Date.now() - lastMessageAt : Date.now() - openedAt;
    view = waited > STALE_AFTER_MS
      ? { state: 'stale', label: 'No data', sub: lastDataTs ? `Last ${formatHMS(new Date(lastDataTs))}` : 'Device silent for 30 s' }
      : { state: 'connecting', label: 'Connected', sub: 'Waiting for data' };
  } else {
    view = { state: 'live', label: 'Live', sub: stamp };
  }

  if (pill.dataset.state !== view.state) pill.dataset.state = view.state;
  if (label.textContent !== view.label) label.textContent = view.label;
  if (sub.textContent !== view.sub) sub.textContent = view.sub;
}

/* ========================================================================== */
/* Telemetry                                                                  */
/* ========================================================================== */

function latest(samples) {
  return samples[samples.length - 1];
}

/** Was the sensor faulty at time ts? Same-timestamp sample wins, else latest known. */
function faultAt(ts, faultSamples) {
  if (faultSamples) {
    const same = faultSamples.find((s) => s.ts === ts);
    if (same) return same.valid && same.value === true;
  }
  return isTrue(state.sensorFault);
}

function handleTelemetry(updates, chart) {
  lastMessageAt = Date.now();

  for (const [key, samples] of Object.entries(updates)) {
    state[key] = latest(samples);
    const newestTs = latest(samples).ts;
    if (newestTs > lastDataTs) lastDataTs = newestTs;
  }

  if (updates.temperature) {
    for (const sample of updates.temperature) {
      if (!sample.valid || faultAt(sample.ts, updates.sensorFault)) chart.addGap(sample.ts);
      else chart.addPoint(sample.ts, sample.value);
    }
  } else if (updates.sensorFault && isTrue(state.sensorFault)) {
    chart.addGap(latest(updates.sensorFault).ts);
  }

  renderTemperature();
  renderFan();
  renderWater();
  renderSensor();
  renderSun();
  renderFeedCount();
  renderAlerts();
  renderAiWarning();
  renderConnection();
}

/* ========================================================================== */
/* Feed Now (requirement §4, contract §6)                                     */
/* ========================================================================== */

function initFeed() {
  const button = $('feed-btn');
  const spinner = button.querySelector('.spinner');
  const label = $('feed-btn-label');
  const okBox = $('feed-ok');
  const okText = $('feed-ok-text');
  const errBox = $('feed-error');
  const errText = $('feed-error-text');
  let inFlight = false;

  function setBusy(busy) {
    inFlight = busy;
    button.disabled = busy;
    button.setAttribute('aria-busy', String(busy));
    spinner.hidden = !busy;
    label.textContent = busy ? 'Feeding…' : 'Feed Now';
  }

  button.addEventListener('click', async () => {
    if (inFlight) return; // ignore clicks while a command is in flight
    setBusy(true);
    okBox.hidden = true;
    errBox.hidden = true;

    let result;
    try {
      result = await sendFeed();
    } catch {
      result = { ok: false, message: FEED_MESSAGES.failed };
    }

    if (result.redirecting) return; // session ended — page is going to Login

    setBusy(false);
    if (result.ok) {
      okText.textContent = `Fed at ${formatHM(new Date())}`;
      okBox.hidden = false;
      if (result.feedCount !== null) applyFeedCount(result.feedCount);
    } else {
      errText.textContent = result.message;
      errBox.hidden = false;
    }
  });
}

/* ========================================================================== */
/* Page lifecycle                                                             */
/* ========================================================================== */

function init() {
  // 1. Session guard
  if (!session.hasSession()) {
    session.redirectToLogin();
    return;
  }

  const chartEmpty = $('chart-empty');
  const chart = createTemperatureChart($('temp-chart'), {
    onRender: (hasPoints) => {
      if (chartEmpty.hidden !== hasPoints) chartEmpty.hidden = hasPoints;
    },
  });
  chart.start();

  // 2. Telemetry socket
  const socket = createTelemetrySocket({
    onTelemetry: (updates) => handleTelemetry(updates, chart),
    onStatus: (status, info) => {
      if (status === 'open') openedAt = Date.now();
      socketState = status;
      reconnectDelayMs = info ? info.delayMs : 0;
      renderConnection();
    },
    onAuthFailure: () => {
      chart.stop();
      endSessionAndRedirect();
    },
  });
  socket.start();

  const staleTimer = setInterval(renderConnection, 1000);

  function teardown() {
    clearInterval(staleTimer);
    socket.stop();
    chart.stop();
  }

  // 4. Logout
  $('logout').addEventListener('click', () => {
    teardown();
    session.clearSession();
    window.location.replace(PAGES.login);
  });

  // 3. Feed
  initFeed();

  window.addEventListener('pagehide', teardown);
  // Restored from the back/forward cache after teardown → start fresh
  // (the guard on reload sends a logged-out tab to Login).
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
