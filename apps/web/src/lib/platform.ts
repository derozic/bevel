/**
 * Canonical BEVEL platform apex — primary customer domain.
 * Org workspaces (bevel.2x4m.cc, bevel.decli.dev, …) are secondary hosts.
 */

export const BEVEL_APEX_HOST = 'bevel.is'
export const BEVEL_APEX_URL = 'https://bevel.is'
export const BEVEL_APEX_LOGIN = 'https://bevel.is/login'

/** Platform home (apex). Prefer env only when it still points at bevel.is family. */
export function platformPublicUrl(path = ''): string {
  const raw =
    process.env.NEXT_PUBLIC_BEVEL_PUBLIC_URL ||
    process.env.BEVEL_PUBLIC_URL ||
    BEVEL_APEX_URL
  let base = BEVEL_APEX_URL
  try {
    const u = new URL(raw)
    const h = u.hostname.toLowerCase()
    // Never treat a product org host as the platform apex.
    if (
      h === 'bevel.is' ||
      h === 'www.bevel.is' ||
      h === 'app.bevel.is' ||
      h === 'bevel.lvh.me' ||
      h.endsWith('.bevel.lvh.me')
    ) {
      base = `${u.protocol}//${u.host}`.replace(/\/$/, '')
    }
  } catch {
    /* keep apex */
  }
  if (!path) return base
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

export function platformLoginUrl(): string {
  return platformPublicUrl('/login')
}
