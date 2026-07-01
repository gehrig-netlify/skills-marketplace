import { usageStore, KEY_PREFIX, jsonResponse } from './_shared.js'

const DAY_MS = 86_400_000

// Midnight UTC for the day containing `ms`.
function startOfUTCDay(ms) {
  const d = new Date(ms)
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

// GET /api/usage
// Returns aggregated telemetry per skill:
//   { skillId, total, dailyCounts[7], lastInvoked }
// dailyCounts is oldest-first: index 0 = 6 days ago, index 6 = today (UTC).
export default async () => {
  const store = usageStore()
  const { blobs } = await store.list({ prefix: KEY_PREFIX })
  const todayStart = startOfUTCDay(Date.now())

  const stats = await Promise.all(
    blobs.map(async ({ key }) => {
      const skillId = key.slice(KEY_PREFIX.length)
      const events = (await store.get(key, { type: 'json' })) || []

      const dailyCounts = new Array(7).fill(0)
      let lastInvoked = null

      for (const ev of events) {
        const t = Number(ev?.timestamp)
        if (!Number.isFinite(t)) continue
        if (lastInvoked === null || t > lastInvoked) lastInvoked = t

        const dayDiff = Math.round((todayStart - startOfUTCDay(t)) / DAY_MS)
        if (dayDiff >= 0 && dayDiff < 7) {
          dailyCounts[6 - dayDiff] += 1
        }
      }

      return { skillId, total: events.length, dailyCounts, lastInvoked }
    }),
  )

  return jsonResponse(stats)
}
