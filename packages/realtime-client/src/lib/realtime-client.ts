export function resolveRealtimeUrl(explicit?: string): string {
  const env = explicit ?? process.env.NEXT_PUBLIC_REALTIME_URL ?? 'http://localhost:41008'

  if (typeof window === 'undefined') return env

  const { hostname, protocol } = window.location
  const isLocal =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0'

  if (isLocal) {
    return env.includes('localhost') || env.includes('127.0.0.1') ? env : 'http://localhost:41008'
  }

  if (protocol === 'https:' && env.startsWith('http://')) {
    if (hostname.startsWith('agents.')) {
      return `https://realtime.${hostname}`
    }
    return `https://realtime.${hostname}`
  }

  return env
}