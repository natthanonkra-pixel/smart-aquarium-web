/** components.js — shared UI pieces (header, stat cards, chart, banners). */
import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area,
} from 'recharts';
import {
  Fish, Settings, Maximize2, Minimize2, Thermometer, Droplets, Sun, Utensils,
  TrendingUp, TrendingDown, Minus, TriangleAlert, Cpu, LogOut, FlaskConical,
} from 'lucide-react';
import { html } from './h.js';
import { val } from './data.js';

const pad2 = (n) => String(n).padStart(2, '0');
export const hms = (ts) => {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
};
export const hm = (ts) => {
  const d = new Date(ts);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
};

/* ---------- header ----------------------------------------------------- */

const CONN_STYLE = {
  live: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
  demo: { dot: 'bg-amber-400', text: 'text-amber-300' },
  connecting: { dot: 'bg-sky-400', text: 'text-sky-300' },
  reconnecting: { dot: 'bg-orange-400', text: 'text-orange-300' },
  stale: { dot: 'bg-slate-400', text: 'text-slate-300' },
  idle: { dot: 'bg-emerald-400', text: 'text-emerald-300' },
};

export function StatusPill({ conn }) {
  const s = CONN_STYLE[conn.state] || CONN_STYLE.stale;
  return html`
    <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-sm" role="status" aria-live="polite">
      <span className=${`h-2.5 w-2.5 rounded-full ${s.dot} pulse-dot shadow-[0_0_10px_currentColor]`}></span>
      <span className=${`font-medium ${s.text}`}>${conn.label}</span>
    </div>`;
}

export function DemoBadge() {
  return html`
    <div className="flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-amber-400/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-amber-300">
      <${FlaskConical} size=${14} /> Demo Mode · simulated data
    </div>`;
}

export function Header({ conn, demo, onSettings, onLogout }) {
  const [full, setFull] = React.useState(false);
  React.useEffect(() => {
    const h = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const iconBtn = 'glass grid h-10 w-10 place-items-center rounded-xl text-cyan-200 transition hover:text-cyan-100 hover:shadow-[0_0_18px_rgba(34,211,238,0.45)]';
  return html`
    <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl border border-cyan-300/40 bg-cyan-400/10 shadow-[0_0_20px_rgba(34,211,238,0.35)]">
          <${Fish} className="text-cyan-300" size=${24} />
        </div>
        <div>
          <h1 className="text-lg font-extrabold tracking-[0.18em] text-white sm:text-xl">SMART <span className="neon-text">AQUARIUM</span></h1>
          <p className="text-xs tracking-wider text-cyan-100/60">Smart Life · Smart Aquarium</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        ${demo && html`<div className="hidden sm:block"><${DemoBadge} /></div>`}
        <${StatusPill} conn=${conn} />
        ${onSettings && html`<button className=${iconBtn} onClick=${onSettings} aria-label="Settings"><${Settings} size=${18} /></button>`}
        <button className=${iconBtn} onClick=${toggleFull} aria-label=${full ? 'Exit full screen' : 'Full screen'}>
          ${full ? html`<${Minimize2} size=${18} />` : html`<${Maximize2} size=${18} />`}
        </button>
        ${onLogout && html`<button className=${iconBtn} onClick=${onLogout} aria-label="Log out"><${LogOut} size=${18} /></button>`}
      </div>
    </header>`;
}

/* ---------- banners ---------------------------------------------------- */

export function AiBanner({ values }) {
  const show = val(values.aiAlert) === true;
  const score = val(values.aiScore);
  return html`
    <${AnimatePresence}>
      ${show && html`
        <${motion.div} key="ai" role="status"
          initial=${{ opacity: 0, y: -10 }} animate=${{ opacity: 1, y: 0 }} exit=${{ opacity: 0, y: -10 }}
          className="flex items-center gap-3 rounded-2xl border border-yellow-300/60 bg-yellow-400/90 px-4 py-3 font-semibold text-slate-900 shadow-[0_0_28px_rgba(250,204,21,0.45)]">
          <${Cpu} size=${20} />
          <span>AI (TinyML): unusual temperature pattern — check the tank
            <span className="ml-1 font-mono">(AI score ${typeof score === 'number' ? score.toFixed(1) : '--'})</span></span>
        </${motion.div}>`}
    </${AnimatePresence}>`;
}

export function AlertBanners({ values }) {
  const alerts = [];
  if (val(values.waterLow) === true) alerts.push('Water level low — refill the tank');
  if (val(values.sensorFault) === true) alerts.push('Temperature sensor fault — fan forced ON');
  return html`
    <${AnimatePresence}>
      ${alerts.map((a) => html`
        <${motion.div} key=${a} role="alert"
          initial=${{ opacity: 0, y: -10 }} animate=${{ opacity: 1, y: 0 }} exit=${{ opacity: 0 }}
          className="flex items-center gap-3 rounded-2xl border border-red-400/60 bg-red-500/20 px-4 py-3 font-semibold text-red-200 shadow-[0_0_24px_rgba(239,68,68,0.35)]">
          <${TriangleAlert} size=${20} /> ${a}
        </${motion.div}>`)}
    </${AnimatePresence}>`;
}

/* ---------- stat cards ------------------------------------------------- */

function trendOf(history) {
  const pts = history.filter((p) => typeof p.temp === 'number');
  if (pts.length < 4) return 0;
  const a = pts[Math.max(0, pts.length - 15)].temp;
  const b = pts[pts.length - 1].temp;
  return b - a > 0.08 ? 1 : a - b > 0.08 ? -1 : 0;
}

function Card({ icon, label, children, accent = 'text-cyan-300', delay = 0 }) {
  return html`
    <${motion.div} className="glass flex min-w-0 flex-col gap-2 p-4"
      initial=${{ opacity: 0, y: 16 }} animate=${{ opacity: 1, y: 0 }} transition=${{ delay, duration: 0.45 }}
      whileHover=${{ y: -3 }}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-cyan-100/60">
        <span className=${accent}>${icon}</span>${label}
      </div>
      ${children}
    </${motion.div}>`;
}

export function StatCards({ values, history, onFeed, feeding }) {
  const temp = val(values.temperature);
  const fault = val(values.sensorFault) === true;
  const low = val(values.waterLow);
  const sun = val(values.sun);
  const fan = val(values.fan);
  const feedCount = val(values.feedCount);
  const trend = trendOf(history);
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;
  const lightOn = typeof sun === 'number' && sun > 0;
  const spark = history.slice(-40);

  return html`
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <${Card} icon=${html`<${Thermometer} size=${16} />`} label="Water Temp" delay=${0.05}>
        <div className="flex items-end gap-2">
          <span className="text-3xl font-bold text-white">${fault || temp == null ? '--' : temp.toFixed(1)}</span>
          <span className="pb-1 text-cyan-200/70">°C</span>
          ${typeof temp === 'number' && !fault && html`<${TrendIcon} size=${18} className=${trend > 0 ? 'mb-1.5 text-orange-300' : trend < 0 ? 'mb-1.5 text-sky-300' : 'mb-1.5 text-emerald-300'} />`}
        </div>
        <p className="text-xs text-cyan-100/50">${fault ? 'Sensor fault' : `Fan ${fan === true ? 'ON · cooling' : fan === false ? 'OFF' : '--'}`}</p>
      </${Card}>

      <${Card} icon=${html`<${Droplets} size=${16} />`} label="Water Level" delay=${0.1} accent=${low ? 'text-red-300' : 'text-cyan-300'}>
        <div className="flex items-end gap-2">
          <span className=${`text-3xl font-bold ${low ? 'text-red-300' : 'text-white'}`}>${low == null ? '--' : low ? 'LOW' : 'Normal'}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
          <${motion.div} className=${`h-full rounded-full ${low ? 'bg-red-400' : 'bg-gradient-to-r from-cyan-400 to-sky-400'}`}
            animate=${{ width: low == null ? '0%' : low ? '35%' : '92%' }} transition=${{ duration: 0.8 }} />
        </div>
        <p className="text-xs text-cyan-100/50">Float switch</p>
      </${Card}>

      <${Card} icon=${html`<${Sun} size=${16} />`} label="Light" delay=${0.15} accent="text-amber-300">
        <div className="flex items-center justify-between gap-2">
          <span className="text-3xl font-bold text-white">${sun == null ? '--' : lightOn ? 'ON' : 'OFF'}</span>
          <span className=${`relative h-6 w-11 rounded-full transition ${lightOn ? 'bg-cyan-400/80 shadow-[0_0_14px_rgba(34,211,238,0.6)]' : 'bg-slate-700'}`} aria-hidden="true">
            <span className=${`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${lightOn ? 'left-[22px]' : 'left-0.5'}`}></span>
          </span>
        </div>
        <p className="text-xs text-cyan-100/50">${sun == null ? 'Sunrise schedule' : `Brightness ${Math.round(sun)}% · auto`}</p>
      </${Card}>

      <${Card} icon=${html`<${Utensils} size=${16} />`} label="Feeding" delay=${0.2} accent="text-emerald-300">
        <div className="flex items-end justify-between gap-2">
          <span className="text-3xl font-bold text-white">${feeding ? '…' : values.feedCount === undefined ? '--' : 'Ready'}</span>
          ${onFeed && html`<button onClick=${onFeed} disabled=${feeding} className="btn-neon px-3 py-1 text-xs">Feed</button>`}
        </div>
        <p className="text-xs text-cyan-100/50">Fed today: ${feedCount == null ? '--' : feedCount} times</p>
      </${Card}>

      <${Card} icon=${html`<span className="h-2 w-2 rounded-full bg-red-400 pulse-dot inline-block"></span>`} label="Live" delay=${0.25}>
        <div className="col-span-2 h-14 lg:col-span-1">
          <${ResponsiveContainer} width="100%" height="100%">
            <${AreaChart} data=${spark} margin=${{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity=${0.6} />
                  <stop offset="100%" stopColor="#22d3ee" stopOpacity=${0} />
                </linearGradient>
              </defs>
              <${YAxis} hide=${true} domain=${['dataMin - 0.3', 'dataMax + 0.3']} />
              <${Area} type="monotone" dataKey="temp" stroke="#22d3ee" strokeWidth=${2} fill="url(#spark)"
                isAnimationActive=${false} connectNulls=${false} />
            </${AreaChart}>
          </${ResponsiveContainer}>
        </div>
        <p className="text-xs text-cyan-100/50">Temperature, last ${Math.max(1, Math.round(spark.length * 2 / 60))} min</p>
      </${Card}>
    </div>`;
}

/* ---------- temperature chart ----------------------------------------- */

export function TempChart({ history, live }) {
  const data = useMemo(() => history.map((p) => ({ ...p, label: hm(p.ts) })), [history]);
  return html`
    <div className="glass p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Water Temperature</h3>
        <span className=${`flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${live ? 'bg-red-500/20 text-red-300' : 'bg-slate-600/30 text-slate-300'}`}>
          <span className=${`h-1.5 w-1.5 rounded-full ${live ? 'bg-red-400 pulse-dot' : 'bg-slate-400'}`}></span>${live ? 'Live' : 'Paused'}
        </span>
      </div>
      <div className="h-44">
        ${data.length < 2
          ? html`<div className="grid h-full place-items-center text-sm text-cyan-100/50">Waiting for live temperature…</div>`
          : html`
          <${ResponsiveContainer} width="100%" height="100%">
            <${LineChart} data=${data} margin=${{ top: 6, right: 8, bottom: 0, left: -18 }}>
              <${CartesianGrid} stroke="rgba(148,197,255,0.08)" vertical=${false} />
              <${XAxis} dataKey="label" tick=${{ fill: '#7dd3fc', fontSize: 10 }} minTickGap=${40} axisLine=${false} tickLine=${false} />
              <${YAxis} domain=${['dataMin - 0.5', 'dataMax + 0.5']} tick=${{ fill: '#7dd3fc', fontSize: 10 }}
                tickFormatter=${(v) => v.toFixed(1)} axisLine=${false} tickLine=${false} />
              <${Tooltip} contentStyle=${{ background: 'rgba(3,11,26,0.92)', border: '1px solid rgba(34,211,238,0.4)', borderRadius: 10, color: '#e0f2fe' }}
                labelFormatter=${(_, p) => (p && p[0] ? hms(p[0].payload.ts) : '')}
                formatter=${(v) => [typeof v === 'number' ? `${v.toFixed(2)} °C` : '--', 'Temp']} />
              <${Line} type="monotone" dataKey="temp" stroke="#22d3ee" strokeWidth=${2.5} dot=${false}
                isAnimationActive=${false} connectNulls=${false}
                style=${{ filter: 'drop-shadow(0 0 6px rgba(34,211,238,0.7))' }} />
            </${LineChart}>
          </${ResponsiveContainer}>`}
      </div>
    </div>`;
}
