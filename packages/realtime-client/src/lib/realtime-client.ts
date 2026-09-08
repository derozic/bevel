/**
 * Resolve the BEVEL realtime WebSocket base URL for the current browser host.
 *
 * Defaults match this monorepo's local ports (43208) and Caddy host
 * (realtime.bevel.lvh.me). Multi-subdomain product hosts always use the
 * shared realtime.bevel.lvh.me surface — never realtime.${fullHostname}.
 */
export function resolveRealtimeUrl(explicit?: string): string {
  const fallbackLocal = 'http://127.0.0.1:43208'
  const fallbackDevHttps = 'https://realtime.bevel.lvh.me'
  const env =
    explicit ??
    process.env.NEXT_PUBLIC_REALTIME_URL ??
    process.env.REALTIME_URL ??
    fallbackLocal

  if (typeof window === 'undefined') {
    // Server / SSR — prefer env
    if (env.includes('localhost:41008') || env.includes('127.0.0.1:41008')) {
      return fallbackLocal
    }
    return env
  }

  const { hostname, protocol } = window.location
  const isLoopback =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'

  if (isLoopback) {
    // Browser on loopback: hit realtime HTTP directly
    if (env.includes('localhost') || env.includes('127.0.0.1')) {
      // Normalize legacy 41008 → 43208
      return env.replace(':41008', ':43208')
    }
    return fallbackLocal
  }

  // HTTPS product hosts (*.lvh.me, *.bevel.com, custom): always use the shared
  // realtime Caddy site, not a derived realtime.${hostname} (breaks multi-label hosts).
  if (protocol === 'https:') {
    if (
      hostname.endsWith('.bevel.lvh.me') ||
      hostname === 'bevel.lvh.me' ||
      hostname.endsWith('.lvh.me')
    ) {
      return fallbackDevHttps
    }
    // Production-ish: realtime.<apex> when apex is bevel.com
    if (hostname === 'bevel.com' || hostname.endsWith('.bevel.com')) {
      return 'https://realtime.bevel.com'
    }
    // Explicit env wins for custom deployments
    if (env.startsWith('https://')) return env
    return fallbackDevHttps
  }

  return env.replace(':41008', ':43208')
}

/**
 * Colyseus `urlBuilder` is used for both matchmake HTTP and the seat
 * WebSocket. Only rewrite ws/wss onto the Caddy host — forcing wss on
 * https matchmake makes `fetch` throw "URL scheme wss is not supported".
 */
export function pinRealtimeEndpoint(realtimeUrl: string, url: URL): string {
  try {
    const base = new URL(realtimeUrl)
    const isWs = url.protocol === 'ws:' || url.protocol === 'wss:'
    if (isWs) {
      url.protocol = base.protocol === 'https:' ? 'wss:' : 'ws:'
    } else if (url.protocol === 'http:' || url.protocol === 'https:') {
      url.protocol = base.protocol === 'https:' ? 'https:' : 'http:'
    }
    url.hostname = base.hostname
    url.port = base.port
  } catch {
    /* keep advertised URL */
  }
  return url.toString()
}
