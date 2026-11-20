/**
 * session.js — the ONLY module that touches sessionStorage.
 * Tokens are never kept in long-lived variables: every caller reads them
 * here at the moment a request needs them (Skill.md § Authentication).
 * Nothing in this module logs values.
 */

import { SESSION_KEYS, PAGES } from './config.js';

function read(key) {
  try {
    const value = window.sessionStorage.getItem(key);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null; // storage disabled (privacy mode) → treated as "no session"
  }
}

function write(key, value) {
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function getToken() {
  return read(SESSION_KEYS.token);
}

export function getRefreshToken() {
  return read(SESSION_KEYS.refreshToken);
}

export function getDeviceId() {
  return read(SESSION_KEYS.deviceId);
}

/** Store a token pair (login or refresh). Returns false if storage fails. */
export function setTokens(token, refreshToken) {
  return write(SESSION_KEYS.token, token) && write(SESSION_KEYS.refreshToken, refreshToken);
}

/** Store one of the ID / credential keys from the login chain. */
export function setValue(name, value) {
  const key = SESSION_KEYS[name];
  if (!key) return false;
  return write(key, value);
}

/** A usable session needs a JWT, a refresh token and a device. */
export function hasSession() {
  return Boolean(getToken() && getRefreshToken() && getDeviceId());
}

/** Remove every credential this app stores. */
export function clearSession() {
  Object.values(SESSION_KEYS).forEach((key) => {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      /* storage unavailable — nothing to clear */
    }
  });
}

export function redirectToLogin() {
  window.location.replace(PAGES.login);
}

/**
 * Seconds until the JWT expires, read from its `exp` claim.
 * This only READS the claim (the server verifies the signature); it is used
 * to decide whether to refresh before a WebSocket reconnect (CLARIFICATIONS Q5).
 * Returns null when the token is missing or unreadable.
 */
export function secondsUntilTokenExpiry() {
  const token = getToken();
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const payload = JSON.parse(window.atob(base64));
    if (!payload || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return null;
    return payload.exp - Date.now() / 1000;
  } catch {
    return null;
  }
}
