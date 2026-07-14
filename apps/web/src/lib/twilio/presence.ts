/**
 * True-sentience presence gates for SMS.
 * SMS only when the member has not been seen on desktop or mobile within grace.
 */

export type PresenceSnapshot = {
  /** Last time this user had a live BEVEL tab (browser). */
  desktopLastSeenAt?: string | null
  /** Last time Flutter / mobile client reported presence. */
  mobileLastSeenAt?: string | null
  /** Last time the specific message was marked read/seen. */
  messageSeenAt?: string | null
}

export function hasRecentPresence(
  snapshot: PresenceSnapshot,
  graceMinutes: number,
  now = Date.now(),
): boolean {
  const graceMs = Math.max(1, graceMinutes) * 60_000
  const cuts = [
    snapshot.messageSeenAt,
    snapshot.desktopLastSeenAt,
    snapshot.mobileLastSeenAt,
  ]
  for (const iso of cuts) {
    if (!iso) continue
    const t = new Date(iso).getTime()
    if (!Number.isNaN(t) && now - t < graceMs) return true
  }
  return false
}

/** Quiet hours in local HH:mm (device clock already applied by caller). */
export function inQuietHours(
  nowLocal: Date,
  start: string,
  end: string,
): boolean {
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map((x) => Number(x))
    if (Number.isNaN(h) || Number.isNaN(m)) return 0
    return h * 60 + m
  }
  const cur = nowLocal.getHours() * 60 + nowLocal.getMinutes()
  const a = toMin(start)
  const b = toMin(end)
  if (a === b) return false
  // Overnight window e.g. 22:00–07:00
  if (a > b) return cur >= a || cur < b
  return cur >= a && cur < b
}
