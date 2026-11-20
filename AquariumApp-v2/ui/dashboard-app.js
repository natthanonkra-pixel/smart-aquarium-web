/**
 * dashboard-app.js — live dashboard: 3D tank, real-time monitor, quick controls.
 * Live data: ThingsBoard WebSocket via ../js/ws.js. Feed: two-way RPC via ../js/rpc.js.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Utensils, Sun, Droplets, Settings, X, Thermometer, CheckCircle2, CircleAlert, Info, LogOut, Wind,
} from 'lucide-react';
import { html } from './h.js';
import { useAquarium, val, logout } from './data.js';
import { Header, StatCards, TempChart, AiBanner, AlertBanners, hms } from './components.js';
import AquariumTank from './tank3d.js';

/* ---------- toast ------------------------------------------------------ */

function Toast({ toast }) {
  const styles = {
    ok: 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100',
    error: 'border-red-400/60 bg-red-500/20 text-red-100',
    info: 'border-cyan-400/60 bg-cyan-500/15 text-cyan-100',
  };
  const Icon = toast && (toast.kind === 'ok' ? CheckCircle2 : toast.kind === 'error' ? CircleAlert : Info);
  return html`
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2" aria-live="polite">
      <${AnimatePresence}>
        ${toast && html`
          <${motion.div} key=${toast.id} initial=${{ opacity: 0, y: 20 }} animate=${{ opacity: 1, y: 0 }} exit=${{ opacity: 0, y: 20 }}
            className=${`glass flex items-center gap-2 border px-4 py-3 text-sm font-medium ${styles[toast.kind]}`}>
            <${Icon} size=${18} /> ${toast.text}
          </${motion.div}>`}
      </${AnimatePresence}>
    </div>`;
}

/* ---------- settings / info panel -------------------------------------- */

function SettingsPanel({ open, onClose, conn, lastTs }) {
  return html`
    <${AnimatePresence}>
      ${open && html`
        <${motion.div} key="bg" className="fixed inset-0 z-40 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"
          initial=${{ opacity: 0 }} animate=${{ opacity: 1 }} exit=${{ opacity: 0 }} onClick=${onClose}>
          <${motion.div} role="dialog" aria-modal="true" aria-label="Settings"
            className="glass w-full max-w-sm p-6" onClick=${(e) => e.stopPropagation()}
            initial=${{ scale: 0.92, y: 10 }} animate=${{ scale: 1, y: 0 }} exit=${{ scale: 0.92, opacity: 0 }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">Settings</h2>
              <button onClick=${onClose} aria-label="Close" className="text-cyan-200 hover:text-white"><${X} size=${20} /></button>
            </div>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-4"><dt className="text-cyan-100/60">Data source</dt><dd className="text-white">ThingsBoard Cloud</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-cyan-100/60">Connection</dt><dd className="text-white">${conn.label}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-cyan-100/60">Last update</dt><dd className="text-white">${lastTs ? hms(lastTs) : '--'}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-cyan-100/60">Controller</dt><dd className="text-white">ESP32-S3</dd></div>
            </dl>
            <p className="mt-4 text-xs text-cyan-100/50">Temperature limits, light schedule and feeding times are set in the ESP32 firmware (hysteresis fan control, RTC schedule).</p>
            <button onClick=${logout} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-red-400/40 bg-red-500/10 py-2.5 text-sm font-semibold text-red-200 hover:bg-red-500/20">
              <${LogOut} size=${16} /> Log out
            </button>
          </${motion.div}>
        </${motion.div}>`}
    </${AnimatePresence}>`;
}

/* ---------- quick controls --------------------------------------------- */

function ControlButton({ icon, label, note, onClick, disabled, busy, tone = 'cyan' }) {
  const toneCls = tone === 'amber' ? 'text-amber-300' : tone === 'emerald' ? 'text-emerald-300' : 'text-cyan-300';
  return html`
    <${motion.button} onClick=${onClick} disabled=${disabled || busy} aria-busy=${busy}
      whileHover=${disabled ? {} : { y: -2 }} whileTap=${disabled ? {} : { scale: 0.96 }}
      className=${`glass flex flex-col items-center gap-1.5 p-3 text-center transition ${disabled ? 'cursor-not-allowed opacity-60' : 'hover:shadow-[0_0_22px_rgba(34,211,238,0.35)]'}`}>
      <span className=${`grid h-10 w-10 place-items-center rounded-xl bg-slate-900/60 ${toneCls}`}>
        ${busy ? html`<span className="spin h-5 w-5 rounded-full border-2 border-cyan-300/30 border-t-cyan-300"></span>` : icon}
      </span>
      <span className="text-sm font-semibold text-white">${label}</span>
      <span className="text-[11px] leading-tight text-cyan-100/50">${note}</span>
    </${motion.button}>`;
}

/* ---------- monitor rows ----------------------------------------------- */

function Row({ icon, label, value, tone = 'text-white' }) {
  return html`
    <div className="flex items-center justify-between rounded-xl bg-slate-900/40 px-3 py-2.5">
      <span className="flex items-center gap-2 text-sm text-cyan-100/70">${icon} ${label}</span>
      <span className=${`text-sm font-semibold ${tone}`}>${value}</span>
    </div>`;
}

/* ---------- app -------------------------------------------------------- */

function App() {
  const { values, history, conn, lastTs, feed, feedTick } = useAquarium();
  const [feeding, setFeeding] = useState(false);
  const [toast, setToast] = useState(null);
  const [settings, setSettings] = useState(false);

  const say = useCallback((kind, text) => setToast({ kind, text, id: Date.now() }), []);
  useEffect(() => {
    if (!toast) return undefined;
    const id = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(id);
  }, [toast]);

  const onFeed = async () => {
    if (feeding) return;
    setFeeding(true);
    const r = await feed();
    setFeeding(false);
    if (r.ok) say('ok', 'Fed the fish');
    else if (!r.redirecting) say('error', r.message || 'Command failed — retry');
  };

  const temp = val(values.temperature);
  const fault = val(values.sensorFault) === true;
  const low = val(values.waterLow);
  const sun = val(values.sun);
  const fan = val(values.fan);

  const checkWater = () => {
    if (low == null) say('info', 'No water level reading yet');
    else if (low) say('error', 'Water level LOW — refill the tank');
    else say('ok', 'Water level normal (float switch OK)');
  };
  const lightInfo = () => say('info', `Light follows the sunrise schedule (RTC) · now ${sun == null ? '--' : `${Math.round(sun)}%`}`);

  return html`
    <div className="mx-auto flex min-h-screen max-w-[1500px] flex-col">
      <${Header} conn=${conn} onSettings=${() => setSettings(true)} onLogout=${logout} />
      <main className="flex flex-1 flex-col gap-4 px-4 pb-8 sm:px-8">
        <${AiBanner} values=${values} />
        <${AlertBanners} values=${values} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.6fr_1fr]">
          <div className="glass relative flex flex-col overflow-hidden">
            <div className="absolute left-4 top-4 z-10 flex flex-wrap gap-2">
              <span className="rounded-full bg-slate-900/60 px-3 py-1 text-xs text-cyan-100/80">3D Tank View</span>
            </div>
            <div className="h-[340px] sm:h-[460px] xl:h-auto xl:min-h-[560px] xl:flex-1">
              <${AquariumTank} temperature=${fault ? undefined : temp} waterLow=${low === true} sun=${sun}
                fan=${fan === true} feedTick=${feedTick} className="h-full w-full" />
            </div>
            <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-cyan-100/40">Drag to rotate · scroll to zoom</p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="glass p-4">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-cyan-200">Real-Time Monitor</h2>
              <div className="grid gap-2">
                <${Row} icon=${html`<${Thermometer} size=${16} />`} label="Temperature"
                  value=${fault ? 'Sensor fault' : temp == null ? '--' : `${temp.toFixed(1)} °C`} tone=${fault ? 'text-red-300' : 'text-white'} />
                <${Row} icon=${html`<${Droplets} size=${16} />`} label="Water level"
                  value=${low == null ? '--' : low ? 'LOW' : 'Normal'} tone=${low ? 'text-red-300' : 'text-emerald-300'} />
                <${Row} icon=${html`<${Sun} size=${16} />`} label="Light"
                  value=${sun == null ? '--' : `${sun > 0 ? 'ON' : 'OFF'} · ${Math.round(sun)}%`} />
                <${Row} icon=${html`<${Wind} size=${16} />`} label="Cooling fan"
                  value=${fan == null ? '--' : fan ? 'ON' : 'OFF'} tone=${fan ? 'text-cyan-300' : 'text-white'} />
              </div>
            </div>
            <${TempChart} history=${history} live=${conn.state === 'live'} />
            <div>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-cyan-200">Quick Controls</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
                <${ControlButton} icon=${html`<${Utensils} size=${20} />`} label="Feed Fish" note="Servo feeder (RPC)"
                  onClick=${onFeed} busy=${feeding} tone="emerald" />
                <${ControlButton} icon=${html`<${Sun} size=${20} />`} label="Light" note="Auto · sunrise schedule"
                  onClick=${lightInfo} tone="amber" />
                <${ControlButton} icon=${html`<${Droplets} size=${20} />`} label="Check Water" note="Float switch status"
                  onClick=${checkWater} />
                <${ControlButton} icon=${html`<${Settings} size=${20} />`} label="Settings" note="Connection & logout"
                  onClick=${() => setSettings(true)} />
              </div>
            </div>
          </div>
        </div>

        <${StatCards} values=${values} history=${history} onFeed=${onFeed} feeding=${feeding} />
        <p className="text-center text-xs text-cyan-100/40">
          Live from ThingsBoard Cloud · last update ${lastTs ? hms(lastTs) : '--'}
        </p>
      </main>
      <${SettingsPanel} open=${settings} onClose=${() => setSettings(false)} conn=${conn} lastTs=${lastTs} />
      <${Toast} toast=${toast} />
    </div>`;
}

createRoot(document.getElementById('root')).render(html`<${App} />`);
