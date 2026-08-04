/**
 * Format profile meta dates for the X / LinkedIn-style public card strip.
 * Input: ISO date YYYY-MM-DD (or full ISO datetime). Output is locale-stable English.
 */

function parseIsoDate(raw: string): Date | null {
  const s = raw.trim()
  if (!s) return null
  // Prefer date-only to avoid TZ off-by-one for birthdays
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2]) - 1
    const d = Number(m[3])
    const dt = new Date(Date.UTC(y, mo, d))
    if (Number.isNaN(dt.getTime())) return null
    return dt
  }
  const dt = new Date(s)
  return Number.isNaN(dt.getTime()) ? null : dt
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

/** "Born May 18, 1973" */
export function formatBornLabel(birthDate: string | undefined | null): string | null {
  if (!birthDate?.trim()) return null
  const dt = parseIsoDate(birthDate)
  if (!dt) return null
  const month = MONTHS[dt.getUTCMonth()]
  const day = dt.getUTCDate()
  const year = dt.getUTCFullYear()
  return `Born ${month} ${day}, ${year}`
}

/** "Joined July 2007" */
export function formatJoinedLabel(joinedAt: string | undefined | null): string | null {
  if (!joinedAt?.trim()) return null
  const dt = parseIsoDate(joinedAt)
  if (!dt) return null
  const month = MONTHS[dt.getUTCMonth()]
  const year = dt.getUTCFullYear()
  return `Joined ${month} ${year}`
}
