/** Custom-scheme URL the Flutter client already handles (`bevel://`). */

export function nativeAppUrlFromLocation(href: string): string {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return 'bevel://me'
  }
  const path = url.pathname || '/'
  const query = url.search || ''

  const talk = path.match(/^\/talk\/([^/]+)/)
  if (talk) return `bevel://talk/${talk[1]!.toLowerCase()}${query}`

  const session = path.match(/^\/session\/([^/]+)/)
  if (session) return `bevel://session/${session[1]}${query}`

  const channel = path.match(/^\/(?:~|%7[eE])([^/]+)/)
  if (channel) return `bevel://channel/${channel[1]!.toLowerCase()}${query}`

  if (path === '/me' || path.startsWith('/me/')) return `bevel://me${query}`
  if (path === '/timeline' || path.startsWith('/timeline')) {
    return `bevel://timeline${query}`
  }
  if (path === '/login' || path.startsWith('/login')) return `bevel://login${query}`

  return `bevel://open${path}${query}`
}

export function isBevelNativeUserAgent(userAgent?: string | null): boolean {
  return /BevelNative/i.test(userAgent || '')
}

export function isAppleMobileUserAgent(
  userAgent?: string | null,
  maxTouchPoints?: number,
): boolean {
  const ua = userAgent || ''
  if (/BevelNative/i.test(ua)) return false
  if (/iPhone|iPod|iPad/.test(ua)) return true
  // iPadOS 13+ Safari often reports Macintosh + multi-touch.
  if (/Macintosh/.test(ua) && (maxTouchPoints ?? 0) > 1) return true
  return false
}
