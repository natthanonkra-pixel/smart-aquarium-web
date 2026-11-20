/**
 * login-app.js — Login page (3D tank + glass sign-in card).
 * Sign-in uses the original auth.js chain (ThingsBoard Cloud) unchanged.
 * The tank and the stat strip on this page are a clearly labelled demo preview.
 */
import React, { useState, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { motion } from 'framer-motion';
import { User, Lock, Eye, EyeOff, LogIn, CircleAlert, Cloud, FlaskConical } from 'lucide-react';
import { html } from './h.js';
import { PAGES } from '../js/config.js';
import { signIn, LoginError, MESSAGES } from '../js/auth.js';
import { useAquarium, val, enterDemo, DEMO_KEY } from './data.js';
import { Header, StatCards } from './components.js';
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
      try { window.sessionStorage.removeItem(DEMO_KEY); } catch { /* ignore */ }
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

  const demo = () => {
    enterDemo();
    window.location.replace(PAGES.dashboard);
  };

  const invalid = (f) => String(Boolean(error && error.fields.includes(f)));

  return html`
    <${motion.form} onSubmit=${submit} noValidate=${true}
      initial=${{ opacity: 0, x: 30 }} animate=${{ opacity: 1, x: 0 }} transition=${{ duration: 0.6, delay: 0.15 }}
      className="glass w-full max-w-md p-7 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-300/80">Smart Aquarium</p>
      <h2 className="mt-1 text-2xl font-bold text-white">Tank Monitor</h2>
      <p className="mt-4 text-lg font-semibold text-white">Sign in</p>
      <p className="mb-5 text-sm text-cyan-100/60">Use your customer account to watch water temperature, water level and light, and to feed the fish remotely.</p>

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

      <button type="button" onClick=${demo} disabled=${busy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/40 bg-amber-300/10 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-300/20">
        <${FlaskConical} size=${16} /> Try Demo Mode (simulated data)
      </button>

      <p className="mt-5 flex items-center justify-center gap-2 text-xs text-cyan-100/50">
        <${Cloud} size=${14} /> Connected to ThingsBoard Cloud · session ends when you close this tab
      </p>
    </${motion.form}>`;
}

function App() {
  const { values, history } = useAquarium({ preview: true });
  return html`
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col">
      <${Header} conn=${{ state: 'connecting', label: 'Ready to connect' }} />
      <main className="flex flex-1 flex-col gap-6 px-4 pb-8 sm:px-8">
        <div className="grid flex-1 items-center gap-6 lg:grid-cols-[1.45fr_1fr]">
          <${motion.div} initial=${{ opacity: 0, scale: 0.96 }} animate=${{ opacity: 1, scale: 1 }} transition=${{ duration: 0.8 }}
            className="relative h-[340px] sm:h-[460px] lg:h-[560px]">
            <${AquariumTank} temperature=${val(values.temperature)} waterLow=${false}
              sun=${Math.max(70, val(values.sun) || 0)} fan=${val(values.fan)} className="h-full w-full" />
            <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-cyan-100/40">Drag to rotate · scroll to zoom</p>
          </${motion.div}>
          <div className="flex justify-center lg:justify-end"><${LoginCard} /></div>
        </div>
        <div>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300/80">
            <${FlaskConical} size=${14} /> Demo preview · sign in to see live tank data
          </p>
          <${StatCards} values=${values} history=${history} />
        </div>
      </main>
    </div>`;
}

createRoot(document.getElementById('root')).render(html`<${App} />`);
