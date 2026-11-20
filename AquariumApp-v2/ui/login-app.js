/**
 * login-app.js — Login page (3D tank + glass sign-in card).
 * Sign-in uses the original auth.js chain (ThingsBoard Cloud) unchanged.
 * No sensor values are shown before sign-in; the tank here is decorative.
 */
import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { motion } from 'framer-motion';
import {
  User, Lock, Eye, EyeOff, LogIn, CircleAlert, Cloud,
} from 'lucide-react';
import { html } from './h.js';
import { PAGES } from '../js/config.js';
import { signIn, LoginError, MESSAGES } from '../js/auth.js';
import { Header } from './components.js';
import AquariumTank from './tank3d.js';

function LoginCard() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null); // { message, fields: [] }
  const userRef = useRef();
  const passRef = useRef();

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const user = username.trim();
    if (!user || !password) {
      const fields = [!user && 'username', !password && 'password'].filter(Boolean);
      setError({ message: 'Enter your username and password', fields });
      (fields[0] === 'username' ? userRef : passRef).current?.focus();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await signIn(user, password);
      window.location.replace(PAGES.dashboard);
    } catch (err) {
      const message = err instanceof LoginError ? err.message : MESSAGES.generic;
      setBusy(false);
      const fields = message === MESSAGES.invalidCredentials ? ['password'] : [];
      setError({ message, fields });
      if (fields.length) passRef.current?.select();
    }
  };

  const invalid = (f) => String(Boolean(error && error.fields.includes(f)));

  return html`
    <${motion.form} onSubmit=${submit} noValidate=${true}
      initial=${{ opacity: 0, x: 30 }} animate=${{ opacity: 1, x: 0 }} transition=${{ duration: 0.6, delay: 0.15 }}
      className="glass w-full max-w-md p-7 sm:p-8">
      <h2 className="text-2xl font-bold neon-text">Smart Aquarium</h2>
      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.25em] text-white">Aquarium Control Center</p>
      <p className="mt-4 text-lg font-semibold text-white">Sign in</p>
      <div className="mb-4"></div>

      <label className="mb-1.5 block text-sm text-cyan-100/80" htmlFor="username">Username</label>
      <div className="relative mb-4">
        <${User} size=${18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cyan-300/70" />
        <input ref=${userRef} id="username" type="email" inputMode="email" autoComplete="username" spellCheck=${false}
          placeholder="owner@aquarium.local" value=${username} disabled=${busy} aria-invalid=${invalid('username')}
          onChange=${(e) => { setUsername(e.target.value); if (error) setError(null); }}
          className="input-glass w-full py-3 pl-10 pr-3" />
      </div>

      <label className="mb-1.5 block text-sm text-cyan-100/80" htmlFor="password">Password</label>
      <div className="relative mb-4">
        <${Lock} size=${18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-cyan-300/70" />
        <input ref=${passRef} id="password" type=${show ? 'text' : 'password'} autoComplete="current-password"
          placeholder="Your password" value=${password} disabled=${busy} aria-invalid=${invalid('password')}
          onChange=${(e) => { setPassword(e.target.value); if (error) setError(null); }}
          className="input-glass w-full py-3 pl-10 pr-11" />
        <button type="button" onClick=${() => setShow((s) => !s)} disabled=${busy}
          aria-label=${show ? 'Hide password' : 'Show password'} aria-pressed=${show}
          className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-cyan-200/80 hover:text-cyan-100">
          ${show ? html`<${EyeOff} size=${18} />` : html`<${Eye} size=${18} />`}
        </button>
      </div>

      ${error && html`
        <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-400/50 bg-red-500/15 px-3 py-2.5 text-sm text-red-200">
          <${CircleAlert} size=${18} /> <span>${error.message}</span>
        </div>`}

      <button type="submit" disabled=${busy} aria-busy=${busy}
        className="btn-neon flex w-full items-center justify-center gap-2 py-3">
        ${busy
          ? html`<span className="spin h-4 w-4 rounded-full border-2 border-slate-900/30 border-t-slate-900"></span> Signing in…`
          : html`<${LogIn} size=${18} /> Login to Dashboard`}
      </button>

      <p className="mt-5 flex items-center justify-center gap-2 text-xs text-cyan-100/50">
        <${Cloud} size=${14} /> Connected to ThingsBoard Cloud · session ends when you close this tab
      </p>
    </${motion.form}>`;
}

/* ---------- decorative underwater ambience (no data) -------------------- */

// two identical periods per path so a -50% shift loops seamlessly
const wavePath = (h, amp) => {
  let d = `M0 ${h}`;
  for (let i = 0; i < 4; i += 1) {
    const x = i * 720;
    d += ` C ${x + 180} ${h - amp}, ${x + 540} ${h + amp}, ${x + 720} ${h}`;
  }
  return `${d} L 2880 200 L 0 200 Z`;
};

const BUBBLES = Array.from({ length: 22 }, (_, i) => {
  const r = (n) => ((Math.sin(i * 91.7 + n * 13.3) * 9999) % 1 + 1) % 1;
  return { left: `${r(1) * 100}%`, size: 6 + r(2) * 18, dur: 10 + r(3) * 14, delay: -r(4) * 20 };
});

function Ambient() {
  return html`
    <div className="ambient" aria-hidden="true">
      ${[8, 30, 55, 78].map((x, i) => html`
        <div key=${x} className="ray" style=${{ left: `${x}%`, transform: `rotate(${(i - 1.5) * 7}deg)`, animationDelay: `${-i * 2.3}s` }}></div>`)}
      ${BUBBLES.map((b, i) => html`
        <span key=${i} className="bubble" style=${{
          left: b.left, width: b.size, height: b.size,
          animationDuration: `${b.dur}s`, animationDelay: `${b.delay}s`,
        }}></span>`)}
      <svg className="wave w1" viewBox="0 0 2880 200" preserveAspectRatio="none">
        <path d=${wavePath(90, 40)} fill="rgba(14,116,144,0.22)" />
      </svg>
      <svg className="wave w2" viewBox="0 0 2880 200" preserveAspectRatio="none">
        <path d=${wavePath(110, 30)} fill="rgba(34,211,238,0.14)" />
      </svg>
      <svg className="wave w3" viewBox="0 0 2880 200" preserveAspectRatio="none">
        <path d=${wavePath(120, 22)} fill="rgba(56,189,248,0.12)" stroke="rgba(103,232,249,0.6)" strokeWidth="2" />
      </svg>
      <div className="glow-line"></div>
    </div>`;
}

function App() {
  return html`
    <${Ambient} />
    <div className="relative z-10 mx-auto flex min-h-screen max-w-[1400px] flex-col">
      <${Header} conn=${{ state: 'connecting', label: 'Ready to connect' }} />
      <main className="flex flex-1 flex-col gap-6 px-4 pb-28 sm:px-8">
        <div className="grid flex-1 grid-cols-1 items-center gap-6 lg:grid-cols-[1.45fr_1fr]">
          <${motion.div} initial=${{ opacity: 0, scale: 0.96 }} animate=${{ opacity: 1, scale: 1 }} transition=${{ duration: 0.8 }}
            className="relative h-[340px] sm:h-[460px] lg:h-[560px]">
            <${AquariumTank} temperature=${26} waterLow=${false} sun=${80} fan=${false} className="h-full w-full" />
            <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-cyan-100/40">Drag to rotate · scroll to zoom</p>
          </${motion.div}>
          <div className="flex min-w-0 justify-center lg:justify-end"><${LoginCard} /></div>
        </div>
      </main>
    </div>`;
}

createRoot(document.getElementById('root')).render(html`<${App} />`);
