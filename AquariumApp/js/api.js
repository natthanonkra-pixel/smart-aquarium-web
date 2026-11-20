/**
 * api.js — the only place that calls fetch().
 *
 * - Headers per contract § Base Configuration (Accept, Content-Type with a body,
 *   X-Authorization: Bearer for authenticated calls)
 * - 10 s AbortController timeout on every request (Skill.md)
 * - Reactive refresh: on 401 → ONE refresh → ONE retry. Refresh failure →
 *   clear session + redirect to Login. Never retries login/refresh themselves.
 * - All failures become an ApiError with a `kind`; callers map kinds to
 *   user-friendly text. Raw server bodies are never shown or logged.
 */

import { BASE_URL, API, FETCH_TIMEOUT_MS } from './config.js';
import * as session from './session.js';

export class ApiError extends Error {
  /**
   * @param {'timeout'|'network'|'http'|'parse'|'auth'} kind
   * @param {number} status HTTP status, or 0 when there was no response
   */
  constructor(kind, status = 0) {
    super(`API ${kind}${status ? ` ${status}` : ''}`);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
  }
}

/** fetch() with a hard deadline. Network/abort errors become ApiError. */
async function fetchWithTimeout(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal, credentials: 'omit', cache: 'no-store' });
  } catch (err) {
    throw new ApiError(err && err.name === 'AbortError' ? 'timeout' : 'network', 0);
  } finally {
    clearTimeout(timer);
  }
}

/** Read a response body as JSON. Empty body → null. Bad JSON → ApiError('parse'). */
async function readJson(response) {
  let text;
  try {
    text = await response.text();
  } catch {
    throw new ApiError('network', response.status);
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError('parse', response.status);
  }
}

function buildHeaders(body, token) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers['X-Authorization'] = `Bearer ${token}`;
  return headers;
}

const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0;

/* -------------------------------------------------------------------------- */
/* Token refresh (contract §2) — single-flight, never retried                  */
/* -------------------------------------------------------------------------- */

let refreshInFlight = null;

/**
 * Exchange the stored refreshToken for a new pair.
 * Resolves true on success, false on ANY failure (no retry — Skill.md § Security Rules).
 * Concurrent callers share the same in-flight request.
 */
export function refreshTokens() {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = session.getRefreshToken();
    if (!refreshToken) return false;
    try {
      const body = JSON.stringify({ refreshToken });
      const response = await fetchWithTimeout(BASE_URL + API.refresh, {
        method: 'POST',
        headers: buildHeaders(body, null),
        body,
      });
      if (response.status !== 200) return false;
      const data = await readJson(response);
      if (!data || !isNonEmptyString(data.token) || !isNonEmptyString(data.refreshToken)) return false;
      return session.setTokens(data.token, data.refreshToken);
    } catch {
      return false;
    }
  })();

  refreshInFlight.finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

/** End the session after a failed refresh and send the user to Login. */
export function endSessionAndRedirect() {
  session.clearSession();
  session.redirectToLogin();
}

/* -------------------------------------------------------------------------- */
/* Generic request                                                            */
/* -------------------------------------------------------------------------- */

/**
 * @param {string} path  API path from config.API
 * @param {object} [opts]
 * @param {'GET'|'POST'} [opts.method]
 * @param {object} [opts.body]         JSON-serialisable body
 * @param {boolean} [opts.auth=true]   send X-Authorization from sessionStorage
 * @param {boolean} [opts.redirectOnAuthFailure=true]  on failed refresh, clear + go to Login
 * @returns {Promise<{status:number, data:any}>} only for 2xx responses
 * @throws {ApiError}
 */
export async function request(path, opts = {}) {
  const { method = 'GET', body, auth = true, redirectOnAuthFailure = true } = opts;
  const payload = body === undefined ? undefined : JSON.stringify(body);

  const send = () => {
    const token = auth ? session.getToken() : null;
    if (auth && !token) throw new ApiError('auth', 0);
    return fetchWithTimeout(BASE_URL + path, {
      method,
      headers: buildHeaders(payload, token),
      body: payload,
    });
  };

  let response = await send();

  // Reactive refresh: exactly one refresh, exactly one retry.
  if (response.status === 401 && auth) {
    const refreshed = await refreshTokens();
    if (!refreshed) {
      if (redirectOnAuthFailure) endSessionAndRedirect();
      throw new ApiError('auth', 401);
    }
    response = await send();
    if (response.status === 401) {
      if (redirectOnAuthFailure) endSessionAndRedirect();
      throw new ApiError('auth', 401);
    }
  }

  if (!response.ok) {
    // Drain the body without exposing it.
    try { await response.text(); } catch { /* ignore */ }
    throw new ApiError('http', response.status);
  }

  const data = await readJson(response);
  return { status: response.status, data };
}
