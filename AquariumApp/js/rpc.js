/**
 * rpc.js — Feed command (contract §6).
 *
 *   POST /api/rpc/twoway/{deviceId}
 *   body: {"method":"feed","params":{},"timeout":5000}
 *   reply: {"success": true, "feedCount": 3}
 *
 * Status → user message (contract §6 table, Q10):
 *   504 / 408           → "Device not responding"
 *   0 (timeout/network) → "Connection timed out"
 *   401                 → reactive refresh + one retry (api.js); refresh failure → Login
 *   success:false/other → "Command failed — retry"
 * A 401 retry cannot double-feed: a 401 means the server rejected the call
 * before it reached the device.
 */

import { API, FEED_RPC_BODY, RANGES } from './config.js';
import { request, ApiError } from './api.js';
import * as session from './session.js';

export const FEED_MESSAGES = Object.freeze({
  noResponse: 'Device not responding',
  timeout: 'Connection timed out',
  failed: 'Command failed — retry',
});

/** feedCount from the RPC reply: integer 0–100000 (number or integer string), else null. */
function parseFeedCount(raw) {
  let value = raw;
  if (typeof raw === 'string' && /^\d+$/.test(raw.trim())) value = Number(raw.trim());
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < RANGES.feedCount.min || value > RANGES.feedCount.max) return null;
  return value;
}

/**
 * Send the feed RPC and wait for the device reply.
 * @returns {Promise<{ok:true, feedCount:number|null} | {ok:false, message:string} | {ok:false, redirecting:true}>}
 */
export async function sendFeed() {
  const deviceId = session.getDeviceId();
  if (!deviceId) {
    session.redirectToLogin(); // session gone (e.g. logged out in another step)
    return { ok: false, redirecting: true };
  }

  let res;
  try {
    res = await request(API.rpcTwoWay(deviceId), { method: 'POST', body: FEED_RPC_BODY });
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.kind === 'auth') return { ok: false, redirecting: true }; // api.js already sent the user to Login
      if (err.kind === 'timeout' || err.kind === 'network') return { ok: false, message: FEED_MESSAGES.timeout };
      if (err.kind === 'http' && (err.status === 504 || err.status === 408)) return { ok: false, message: FEED_MESSAGES.noResponse };
    }
    return { ok: false, message: FEED_MESSAGES.failed };
  }

  const data = res.data;
  if (!data || typeof data !== 'object' || data.success !== true) {
    return { ok: false, message: FEED_MESSAGES.failed };
  }
  // Q10: success with a missing/invalid feedCount still counts as fed; telemetry corrects the count.
  return { ok: true, feedCount: parseFeedCount(data.feedCount) };
}
