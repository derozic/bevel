/** Auth.js stores `token|hash` in the CSRF cookie. The form field is the token. */

const CSRF_COOKIE_NAMES = [
  '__Host-authjs.csrf-token',
  'authjs.csrf-token',
  'next-auth.csrf-token',
  '__Secure-next-auth.csrf-token',
]

export function csrfTokenFromCookieValue(raw: string | null | undefined): string | null {
  if (!raw) return null
  const token = decodeURIComponent(raw).split('|')[0]?.trim()
  return token || null
}

export function csrfTokenFromCookies(
  get: (name: string) => string | undefined | null,
): string | null {
  for (const name of CSRF_COOKIE_NAMES) {
    const token = csrfTokenFromCookieValue(get(name))
    if (token) return token
  }
  return null
}
