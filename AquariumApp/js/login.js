/**
 * login.js — Login page controller.
 * Always shows the form (Q11); a successful sign-in replaces the old session.
 */

import { PAGES } from './config.js';
import { signIn, LoginError, MESSAGES } from './auth.js';

const EMPTY_FIELDS_MESSAGE = 'Enter your username and password';

function init() {
  const form = document.getElementById('login-form');
  const username = document.getElementById('username');
  const password = document.getElementById('password');
  const submit = document.getElementById('login-submit');
  const spinner = submit.querySelector('.spinner');
  const label = submit.querySelector('.login__submit-label');
  const errorBox = document.getElementById('login-error');
  const errorText = document.getElementById('login-error-text');
  const status = document.getElementById('login-status');
  const toggle = document.getElementById('password-toggle');

  let busy = false;

  function showError(message, fields = []) {
    errorText.textContent = message; // textContent only — never innerHTML
    errorBox.hidden = false;
    [username, password].forEach((el) => el.setAttribute('aria-invalid', String(fields.includes(el))));
  }

  function clearError() {
    errorBox.hidden = true;
    errorText.textContent = '';
    [username, password].forEach((el) => el.removeAttribute('aria-invalid'));
  }

  function setBusy(isBusy) {
    busy = isBusy;
    submit.disabled = isBusy;
    username.disabled = isBusy;
    password.disabled = isBusy;
    toggle.disabled = isBusy;
    spinner.hidden = !isBusy;
    label.textContent = isBusy ? 'Signing in…' : 'Login to Dashboard';
    submit.setAttribute('aria-busy', String(isBusy));
    status.textContent = isBusy ? 'Signing in' : '';
  }

  toggle.addEventListener('click', () => {
    const show = password.type === 'password';
    password.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
    toggle.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  [username, password].forEach((el) =>
    el.addEventListener('input', () => {
      if (!errorBox.hidden) clearError();
    }),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return; // ignore double submits

    const user = username.value.trim();
    const pass = password.value;
    if (!user || !pass) {
      const missing = [!user && username, !pass && password].filter(Boolean);
      showError(EMPTY_FIELDS_MESSAGE, missing);
      missing[0].focus();
      return;
    }

    clearError();
    setBusy(true);
    try {
      await signIn(user, pass);
      window.location.replace(PAGES.dashboard);
    } catch (err) {
      const message = err instanceof LoginError ? err.message : MESSAGES.generic;
      setBusy(false);
      const invalid = message === MESSAGES.invalidCredentials ? [password] : [];
      showError(message, invalid);
      (invalid[0] || submit).focus();
      if (invalid[0]) password.select();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
