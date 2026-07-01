import { getStore } from '@netlify/blobs'

// Single store namespace for all usage telemetry. Events for a given skill live
// at key `usage:{skillId}` as a JSON array. Strong consistency so a freshly
// logged invocation shows up on the dashboard's next poll without delay.
export const STORE_NAME = 'skill-usage'
export const KEY_PREFIX = 'usage:'

export function usageStore() {
  return getStore({ name: STORE_NAME, consistency: 'strong' })
}

// The hook script sends a UNIX timestamp in seconds (`date -u +%s`). Normalize
// everything to milliseconds so the frontend can hand values straight to Date.
export function normalizeTimestamp(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return Date.now()
  // Anything below ~Sat Nov 2001 in ms is almost certainly a seconds value.
  return n < 1e12 ? Math.round(n * 1000) : Math.round(n)
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  })
}
