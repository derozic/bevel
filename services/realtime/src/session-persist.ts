/** Durable slug for a direct agent thread (Postgres channel.slug is 64 chars). */
export function dmPersistSlug(sessionId: string): string {
  const raw = sessionId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  const base = raw || 'dm-session'
  if (base.length <= 64) return base
  const hash = fnv1a8(base)
  return `${base.slice(0, 55)}-${hash}`
}

/** Stable 8-char hex — browser-safe, no node:crypto. */
export function fnv1a8(input: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}
