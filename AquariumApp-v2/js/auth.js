/**
 * auth.js — Login chain (requirement § Flow / Login Page, steps 2–5).
 *
 *   1. POST /api/auth/login                      → token, refreshToken
 *   2. GET  /api/auth/user                       → customerId.id
 *   3. GET  /api/customer/{id}/devices           → data[0].id.id   (Q2: first device)
 *   4. GET  /api/device/{id}/credentials         → credentialsId   (Q3: stored, never shown/logged)
 *
 * Any failure clears the partial session (Q4) and throws a LoginError whose
 * message is safe to show to the user. Login itself is never retried
 * (Skill.md § Security Rules, DECISION.md "Error handling for the login and refresh endpoints").
 */

import { API } from './config.js';
import { request, ApiError } from './api.js';
import * as session from './session.js';

export const MESSAGES = Object.freeze({
  invalidCredentials: 'Invalid username or password',
  badRequest: 'Login request failed — check input',
  serverDown: 'Server unavailable — try again later',
  timeout: 'Connection timed out — check your network',
  noCustomer: 'This account is not linked to a customer',
  noDevice: 'No aquarium device is assigned to this account',
  deviceAccess: 'Could not access the aquarium device',
  generic: 'Login failed — please try again',
});

export class LoginError extends Error {
  constructor(userMessage) {
    super(userMessage);
    this.name = 'LoginError';
  }
}

/** ThingsBoard uses this UUID for "no customer" (e.g. tenant admins). */
const TB_NULL_UUID = '13814000-1dd2-11b2-8080-808080808080';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v) => typeof v === 'string' && UUID_RE.test(v) && v !== TB_NULL_UUID;
const isNonEmptyString = (v) => typeof v === 'string' && v.trim().length > 0;

/** Map transport-level failures common to every step. Returns null if not transport. */
function transportMessage(err) {
  if (!(err instanceof ApiError)) return null;
  if (err.kind === 'timeout' || err.kind === 'network') return MESSAGES.timeout;
  if (err.kind === 'http' && err.status >= 500) return MESSAGES.serverDown;
  return null;
}

function fail(message) {
  session.clearSession();
  throw new LoginError(message);
}

/* ---- Step 1: login -------------------------------------------------------- */

async function stepLogin(username, password) {
  let res;
  try {
    res = await request(API.login, {
      method: 'POST',
      body: { username, password },
      auth: false,
    });
  } catch (err) {
    const transport = transportMessage(err);
    if (transport) fail(transport);
    if (err instanceof ApiError && err.kind === 'http') {
      if (err.status === 401) fail(MESSAGES.invalidCredentials);
      if (err.status === 400) fail(MESSAGES.badRequest);
    }
    fail(MESSAGES.generic);
  }
  const data = res.data;
  if (!data || !isNonEmptyString(data.token) || !isNonEmptyString(data.refreshToken)) fail(MESSAGES.generic);
  if (!session.setTokens(data.token, data.refreshToken)) fail(MESSAGES.generic);
}

/* ---- Step 2: current user → customerId ----------------------------------- */

async function stepCustomerId() {
  let res;
  try {
    res = await request(API.currentUser, { redirectOnAuthFailure: false });
  } catch (err) {
    fail(transportMessage(err) || MESSAGES.generic);
  }
  const data = res.data;
  const customerId = data && data.customerId && data.customerId.id;
  if (!data || data.authority !== 'CUSTOMER_USER' || !isUuid(customerId)) fail(MESSAGES.noCustomer);
  session.setValue('customerId', customerId);
  return customerId;
}

/* ---- Step 3: customer devices → first deviceId --------------------------- */

async function stepDeviceId(customerId) {
  let res;
  try {
    res = await request(API.customerDevices(customerId), { redirectOnAuthFailure: false });
  } catch (err) {
    fail(transportMessage(err) || MESSAGES.deviceAccess);
  }
  const list = res.data && res.data.data;
  if (!Array.isArray(list)) fail(MESSAGES.generic);
  if (list.length === 0) fail(MESSAGES.noDevice);
  const deviceId = list[0] && list[0].id && list[0].id.id;
  if (!isUuid(deviceId)) fail(MESSAGES.noDevice);
  session.setValue('deviceId', deviceId);
  return deviceId;
}

/* ---- Step 4: device credentials → access token --------------------------- */

async function stepDeviceAccessToken(deviceId) {
  let res;
  try {
    res = await request(API.deviceCredentials(deviceId), { redirectOnAuthFailure: false });
  } catch (err) {
    fail(transportMessage(err) || MESSAGES.deviceAccess);
  }
  const data = res.data;
  if (!data || !isNonEmptyString(data.credentialsId)) fail(MESSAGES.deviceAccess);
  // Kept in sessionStorage only — never rendered, never logged (Q3).
  session.setValue('deviceAccessToken', data.credentialsId);
}

/**
 * Run the whole chain. Resolves when the session is complete;
 * rejects with LoginError (user-safe message) otherwise.
 */
export async function signIn(username, password) {
  session.clearSession(); // a new login replaces any old session (Q11)
  try {
    await stepLogin(username, password);
    const customerId = await stepCustomerId();
    const deviceId = await stepDeviceId(customerId);
    await stepDeviceAccessToken(deviceId);
  } catch (err) {
    session.clearSession();
    throw err instanceof LoginError ? err : new LoginError(MESSAGES.generic);
  }
  if (!session.hasSession()) {
    session.clearSession();
    throw new LoginError(MESSAGES.generic);
  }
}
