/** Never send browsers to the process bind address (prod: localhost:41009). */

export function isLoopbackHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().split(':')[0] || ''
  return (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.endsWith('.localhost')
  )
}

export function publicOriginFromRequest(request: {
  url: string
  headers: Pick<Headers, 'get'>
}): string {
  const forwarded = (
    request.headers.get('x-forwarded-host') ||
    request.headers.get('x-bevel-host') ||
    request.headers.get('host') ||
    ''
  )
    .split(',')[0]
    .trim()
  const host = forwarded.split(':')[0]
  if (host && !isLoopbackHostname(host)) {
    const proto = request.headers.get('x-forwarded-proto') || 'https'
    return `${proto}://${host}`
  }

  try {
    const u = new URL(request.url)
    if (!isLoopbackHostname(u.hostname)) return u.origin
  } catch {
    /* fall through */
  }

  for (const raw of [
    process.env.AUTH_URL,
    process.env.BEVEL_PUBLIC_URL,
    process.env.NEXTAUTH_URL,
  ]) {
    if (!raw) continue
    try {
      const u = new URL(raw)
      if (!isLoopbackHostname(u.hostname)) return u.origin
    } catch {
      /* try next */
    }
  }
  return 'https://bevel.lvh.me'
}
