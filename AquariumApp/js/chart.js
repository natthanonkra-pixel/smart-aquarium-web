/**
 * chart.js — Water temperature trend on HTML5 <canvas> (requirement §1).
 *
 * - Rolling 5-minute window on the server timestamp, measured against the
 *   browser clock; redrawn every second so it keeps sliding (Q6)
 * - Y axis fixed 20–35 °C; X axis "-5 min" … "now"
 * - Dashed reference lines: Fan ON 30 °C, Fan OFF 28 °C (labelled)
 * - Gaps: explicit gap samples (sensorFault / invalid) and any jump > 15 s (Q7)
 * - All colours / font size come from CSS custom properties (DECISION.md)
 * - High-DPI aware; redraws on resize
 */

import { CHART_WINDOW_MS, CHART_GAP_MS } from './config.js';

const Y_MIN = 20;
const Y_MAX = 35;
const Y_TICKS = [20, 25, 30, 35];
const REF_LINES = [
  { value: 30, label: 'Fan ON 30 °C' },
  { value: 28, label: 'Fan OFF 28 °C' },
];
const REDRAW_MS = 1000;
const FUTURE_TOLERANCE_MS = 2000;

function readTheme() {
  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  const rootPx = parseFloat(css.fontSize) || 16;
  const fontRem = parseFloat(v('--chart-font-size')) || 0.6875;
  return {
    line: v('--chart-line'),
    fillTop: v('--chart-fill-top'),
    fillBottom: v('--chart-fill-bottom'),
    grid: v('--chart-grid'),
    text: v('--chart-axis-text'),
    refOn: v('--chart-ref-on'),
    refOff: v('--chart-ref-off'),
    labelBg: v('--chart-label-bg'),
    fontPx: fontRem * rootPx,
    fontFamily: v('--font-family') || 'sans-serif',
  };
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object} [opts]
 * @param {(hasPoints: boolean) => void} [opts.onRender] called after each draw
 * @param {() => number} [opts.now] clock (tests)
 */
export function createTemperatureChart(canvas, { onRender = () => {}, now = () => Date.now() } = {}) {
  const ctx = canvas.getContext('2d');
  /** @type {Array<{ts:number, v:number|null}>} sorted by ts; v=null is a gap marker */
  let samples = [];
  let timer = null;
  let resizeObserver = null;
  let theme = readTheme();

  function prune() {
    const cutoff = now() - CHART_WINDOW_MS;
    let i = 0;
    while (i < samples.length && samples[i].ts < cutoff) i += 1;
    if (i > 0) samples = samples.slice(i);
  }

  function insert(ts, v) {
    if (!Number.isFinite(ts)) return;
    const t = Math.min(ts, now() + FUTURE_TOLERANCE_MS);
    if (t < now() - CHART_WINDOW_MS) return; // older than the window (e.g. stale first message)
    const existing = samples.findIndex((s) => s.ts === t);
    if (existing !== -1) {
      samples[existing].v = v; // same timestamp re-sent → replace
    } else {
      samples.push({ ts: t, v });
      if (samples.length > 1 && samples[samples.length - 2].ts > t) samples.sort((a, b) => a.ts - b.ts);
    }
  }

  /** Add a valid temperature point. */
  function addPoint(ts, value) {
    if (!Number.isFinite(value)) {
      addGap(ts);
      return;
    }
    insert(ts, value);
    draw();
  }

  /** Mark a gap (sensor fault / invalid sample) — nothing is plotted there. */
  function addGap(ts) {
    insert(ts, null);
    draw();
  }

  function hasPoints() {
    return samples.some((s) => s.v !== null);
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { width: rect.width, height: rect.height, dpr };
  }

  /** Split samples into continuous runs of valid points. */
  function segments() {
    const runs = [];
    let run = [];
    let prevTs = null;
    for (const s of samples) {
      const jump = prevTs !== null && s.ts - prevTs > CHART_GAP_MS;
      if (s.v === null || jump) {
        if (run.length) runs.push(run);
        run = [];
      }
      if (s.v !== null) run.push(s);
      prevTs = s.ts;
    }
    if (run.length) runs.push(run);
    return runs;
  }

  function draw() {
    prune();
    const { width, height, dpr } = resize();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const font = `500 ${theme.fontPx}px ${theme.fontFamily}`;
    ctx.font = font;
    const pad = {
      left: Math.ceil(ctx.measureText('35 °C').width) + theme.fontPx,
      right: theme.fontPx * 0.75,
      top: theme.fontPx * 1.25,
      bottom: theme.fontPx * 2.25,
    };
    const plotW = Math.max(1, width - pad.left - pad.right);
    const plotH = Math.max(1, height - pad.top - pad.bottom);
    const tNow = now();
    const tStart = tNow - CHART_WINDOW_MS;
    const x = (ts) => pad.left + ((ts - tStart) / CHART_WINDOW_MS) * plotW;
    const y = (v) => pad.top + (1 - (v - Y_MIN) / (Y_MAX - Y_MIN)) * plotH;

    // Grid + Y labels
    ctx.lineWidth = 1;
    ctx.strokeStyle = theme.grid;
    ctx.fillStyle = theme.text;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (const tick of Y_TICKS) {
      const yy = Math.round(y(tick)) + 0.5;
      ctx.beginPath();
      ctx.moveTo(pad.left, yy);
      ctx.lineTo(pad.left + plotW, yy);
      ctx.stroke();
      ctx.fillText(`${tick} °C`, pad.left - theme.fontPx * 0.5, yy);
    }

    // X labels: "-5 min" … "now". "-5 min" and "now" are always drawn; the
    // minute labels in between are skipped if they would collide (narrow screens).
    ctx.textBaseline = 'top';
    const labelY = pad.top + plotH + theme.fontPx * 0.6;
    const minGap = theme.fontPx * 0.75;
    const placed = [];
    const box = (m) => {
      const text = m === 0 ? 'now' : `-${m} min`;
      const w = ctx.measureText(text).width;
      const xx = x(tNow - m * 60_000);
      const left = m === 5 ? xx : m === 0 ? xx - w : xx - w / 2;
      return { m, text, xx, left, right: left + w };
    };
    const fits = (b) => placed.every((p) => b.right + minGap <= p.left || b.left >= p.right + minGap);
    [box(5), box(0)].forEach((b) => placed.push(b));
    [1, 2, 3, 4].map(box).forEach((b) => { if (fits(b)) placed.push(b); });
    for (const b of placed) {
      ctx.textAlign = 'left';
      ctx.fillText(b.text, b.left, labelY);
      if (b.m !== 0 && b.m !== 5) {
        ctx.beginPath();
        ctx.moveTo(Math.round(b.xx) + 0.5, pad.top + plotH);
        ctx.lineTo(Math.round(b.xx) + 0.5, pad.top + plotH + theme.fontPx * 0.35);
        ctx.stroke();
      }
    }

    // Reference lines
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.25;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    for (const ref of REF_LINES) {
      const color = ref.value === 30 ? theme.refOn : theme.refOff;
      const yy = Math.round(y(ref.value)) + 0.5;
      ctx.strokeStyle = color;
      ctx.beginPath();
      ctx.moveTo(pad.left, yy);
      ctx.lineTo(pad.left + plotW, yy);
      ctx.stroke();
    }
    ctx.restore();

    // Data — clipped to the plot so out-of-axis (but valid) values do not spill
    ctx.save();
    ctx.beginPath();
    ctx.rect(pad.left, pad.top, plotW, plotH);
    ctx.clip();

    const runs = segments();
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + plotH);
    gradient.addColorStop(0, theme.fillTop);
    gradient.addColorStop(1, theme.fillBottom);

    for (const run of runs) {
      if (run.length >= 2) {
        // area
        ctx.beginPath();
        ctx.moveTo(x(run[0].ts), pad.top + plotH);
        run.forEach((p) => ctx.lineTo(x(p.ts), y(p.v)));
        ctx.lineTo(x(run[run.length - 1].ts), pad.top + plotH);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
        // line
        ctx.beginPath();
        run.forEach((p, i) => (i ? ctx.lineTo(x(p.ts), y(p.v)) : ctx.moveTo(x(p.ts), y(p.v))));
        ctx.strokeStyle = theme.line;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
      } else {
        // isolated point: draw a dot so it is visible
        ctx.beginPath();
        ctx.arc(x(run[0].ts), y(run[0].v), 2.5, 0, Math.PI * 2);
        ctx.fillStyle = theme.line;
        ctx.fill();
      }
    }

    // Highlight the latest valid point
    const last = [...samples].reverse().find((s) => s.v !== null);
    if (last) {
      ctx.beginPath();
      ctx.arc(x(last.ts), y(last.v), 4, 0, Math.PI * 2);
      ctx.fillStyle = theme.line;
      ctx.fill();
    }
    ctx.restore();

    // Reference labels last, on a solid chip, so the data line never hides them.
    // ON label sits above its line, OFF below (the lines are only 2 °C apart).
    ctx.save();
    ctx.font = font;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const chipPadX = theme.fontPx * 0.4;
    const chipH = theme.fontPx * 1.5;
    for (const ref of REF_LINES) {
      const color = ref.value === 30 ? theme.refOn : theme.refOff;
      const yy = Math.round(y(ref.value)) + 0.5;
      const cy = ref.value === 30 ? yy - chipH / 2 - 2 : yy + chipH / 2 + 2;
      const textW = ctx.measureText(ref.label).width;
      const right = pad.left + plotW - 2;
      ctx.fillStyle = theme.labelBg;
      ctx.beginPath();
      ctx.roundRect
        ? ctx.roundRect(right - textW - chipPadX * 2, cy - chipH / 2, textW + chipPadX * 2, chipH, chipH / 3)
        : ctx.rect(right - textW - chipPadX * 2, cy - chipH / 2, textW + chipPadX * 2, chipH);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.fillText(ref.label, right - chipPadX, cy);
    }
    ctx.restore();

    onRender(hasPoints());
  }

  function start() {
    theme = readTheme();
    draw();
    clearInterval(timer);
    timer = setInterval(draw, REDRAW_MS);
    if ('ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(() => draw());
      resizeObserver.observe(canvas);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => draw()).catch(() => {});
    }
  }

  function stop() {
    clearInterval(timer);
    timer = null;
    if (resizeObserver) resizeObserver.disconnect();
    resizeObserver = null;
  }

  /** Test/inspection helper: copy of current samples. */
  function snapshot() {
    prune();
    return { samples: samples.map((s) => ({ ...s })), segments: segments().map((r) => r.length) };
  }

  return { addPoint, addGap, start, stop, hasPoints, snapshot };
}
