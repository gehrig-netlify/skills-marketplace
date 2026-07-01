import { usageStore, KEY_PREFIX, normalizeTimestamp, jsonResponse } from './_shared.js'

// Keep at most this many events per skill. We trim to the most recent ones so a
// busy skill never grows an unbounded blob.
const MAX_EVENTS = 1000

// POST /api/log-usage
// Body: { skill, args, session_id, user, timestamp }
// Header: x-hook-secret (validated against HOOK_SECRET when that env var is set)
export default async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405)
  }

  // HOOK_SECRET is optional. When configured, every POST must present a matching
  // x-hook-secret header — this keeps anonymous traffic from polluting telemetry.
  const secret = process.env.HOOK_SECRET
  if (secret && req.headers.get('x-hook-secret') !== secret) {
    return jsonResponse({ ok: false, error: 'Invalid hook secret' }, 401)
  }

  let body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const skill = typeof body?.skill === 'string' ? body.skill.trim() : ''
  if (!skill) {
    return jsonResponse({ ok: false, error: 'Missing "skill"' }, 400)
  }

  const event = {
    args: String(body.args ?? '').slice(0, 500),
    session_id: String(body.session_id ?? ''),
    user: String(body.user ?? ''),
    timestamp: normalizeTimestamp(body.timestamp),
  }

  const store = usageStore()
  const key = `${KEY_PREFIX}${skill}`
  const existing = (await store.get(key, { type: 'json' })) || []
  existing.push(event)

  // Cap the log: keep only the most recent MAX_EVENTS.
  const capped = existing.length > MAX_EVENTS ? existing.slice(-MAX_EVENTS) : existing
  await store.setJSON(key, capped)

  return jsonResponse({ ok: true })
}
