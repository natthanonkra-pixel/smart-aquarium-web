/**
 * telemetry.js — zero-trust parsing of WebSocket telemetry (contract §7).
 *
 * Over the WebSocket every value is a STRING:
 *   - numbers  → must look like a plain decimal number, then range-checked
 *                (contract § Sensor Value Ranges); "27.5abc", "NaN", "" → invalid
 *   - booleans → only the exact strings "true" / "false"; anything else → invalid
 * Invalid values are reported as { valid: false } so the UI can show `--`
 * instead of corrupting the display (Skill.md § WebSocket Resilience).
 */

import { TELEMETRY_KEYS, RANGES } from './config.js';

const NUMBER_RE = /^-?\d+(\.\d+)?$/;
const INTEGER_RE = /^\d+$/;

const BOOLEAN_KEYS = new Set(['fan', 'waterLow', 'sensorFault', 'aiAlert']);

/** @returns {{valid:true, value:number}|{valid:false}} */
export function parseNumber(raw, { min, max, integer = false }) {
  if (typeof raw !== 'string') return { valid: false };
  const text = raw.trim();
  if (!(integer ? INTEGER_RE : NUMBER_RE).test(text)) return { valid: false };
  const value = Number(text);
  if (!Number.isFinite(value) || value < min || value > max) return { valid: false };
  return { valid: true, value };
}

/** @returns {{valid:true, value:boolean}|{valid:false}} */
export function parseBoolean(raw) {
  if (raw === 'true') return { valid: true, value: true };
  if (raw === 'false') return { valid: true, value: false };
  return { valid: false };
}

/** Validate one value for a known telemetry key. */
export function parseValue(key, raw) {
  if (BOOLEAN_KEYS.has(key)) return parseBoolean(raw);
  if (key === 'temperature') return parseNumber(raw, RANGES.temperature);
  if (key === 'sun') return parseNumber(raw, RANGES.sun);
  if (key === 'feedCount') return parseNumber(raw, { ...RANGES.feedCount, integer: true });
  if (key === 'aiScore') return parseNumber(raw, RANGES.aiScore);
  return { valid: false };
}

const isTimestamp = (ts) => typeof ts === 'number' && Number.isFinite(ts) && ts > 0;

/**
 * Validate a whole incoming WS message for our subscription.
 *
 * @param {unknown} msg  already JSON-parsed message
 * @param {number} cmdId subscription id we sent
 * @returns {{ok:true, updates: Record<string, Array<{ts:number, valid:boolean, value?:any}>>}
 *          | {ok:false, reason:'shape'|'other'|'server-error'}}
 *   `updates` holds only keys present in the message; samples sorted oldest → newest.
 */
export function parseTelemetryMessage(msg, cmdId) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return { ok: false, reason: 'shape' };
  if (msg.subscriptionId !== cmdId) return { ok: false, reason: 'other' };
  if (typeof msg.errorCode === 'number' && msg.errorCode !== 0) return { ok: false, reason: 'server-error' };
  const data = msg.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'shape' };

  const updates = {};
  for (const key of TELEMETRY_KEYS) {
    const entries = data[key];
    if (!Array.isArray(entries)) continue;
    const samples = [];
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length < 2 || !isTimestamp(entry[0])) continue;
      const parsed = parseValue(key, entry[1]);
      samples.push(parsed.valid ? { ts: entry[0], valid: true, value: parsed.value } : { ts: entry[0], valid: false });
    }
    if (samples.length) {
      samples.sort((a, b) => a.ts - b.ts);
      updates[key] = samples;
    }
  }
  return { ok: true, updates };
}
