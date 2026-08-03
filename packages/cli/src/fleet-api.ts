/**
 * Shared HTTP client for bevel fleet JSON CLI commands.
 * Auth: FLEET_INTERNAL_API_KEY or BEVEL_API_KEY as X-Fleet-Internal-Key.
 */

export type FleetExit =
  | 0 // ok
  | 1 // input
  | 2 // network
  | 3 // auth
  | 4 // other

export function apiBase(): string {
  return (
    process.env.BEVEL_API_URL ||
    process.env.API_INTERNAL_URL ||
    process.env.NEXT_PUBLIC_BEVEL_API_URL ||
    'http://127.0.0.1:43203'
  ).replace(/\/$/, '')
}

export function defaultTenant(): string {
  return (
    process.env.BEVEL_TENANT ||
    process.env.BEVEL_DEFAULT_TENANT ||
    process.env.NEXT_PUBLIC_DEFAULT_TENANT ||
    '2x4m'
  )
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  const key =
    process.env.FLEET_INTERNAL_API_KEY ||
    process.env.BEVEL_API_KEY ||
    process.env.BEVEL_INTERNAL_KEY ||
    ''
  if (key) h['X-Fleet-Internal-Key'] = key
  return h
}

export async function fleetFetch(
  path: string,
  init?: RequestInit,
): Promise<{ status: number; data: unknown; exit: FleetExit }> {
  const url = `${apiBase()}${path.startsWith('/') ? path : `/${path}`}`
  try {
    const res = await fetch(url, {
      ...init,
      headers: { ...headers(), ...(init?.headers as Record<string, string>) },
    })
    let data: unknown
    const text = await res.text()
    try {
      data = text ? JSON.parse(text) : {}
    } catch {
      data = { raw: text }
    }
    if (res.status === 401 || res.status === 403) {
      return { status: res.status, data, exit: 3 }
    }
    if (res.status >= 400 && res.status < 500) {
      return { status: res.status, data, exit: 1 }
    }
    if (res.status >= 500) {
      return { status: res.status, data, exit: 2 }
    }
    return { status: res.status, data, exit: 0 }
  } catch (err) {
    return {
      status: 0,
      data: {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      exit: 2,
    }
  }
}

export function printJson(data: unknown, pretty = true): void {
  console.log(pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data))
}

export function parseFlags(argv: string[]): {
  flags: Record<string, string | boolean>
  positional: string[]
} {
  const flags: Record<string, string | boolean> = {}
  const positional: string[] = []
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--') {
      positional.push(...argv.slice(i + 1))
      break
    }
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq > 2) {
        flags[a.slice(2, eq)] = a.slice(eq + 1)
      } else {
        const key = a.slice(2)
        const next = argv[i + 1]
        if (next && !next.startsWith('-')) {
          flags[key] = next
          i++
        } else {
          flags[key] = true
        }
      }
    } else if (a.startsWith('-') && a.length === 2) {
      const next = argv[i + 1]
      if (next && !next.startsWith('-')) {
        flags[a.slice(1)] = next
        i++
      } else {
        flags[a.slice(1)] = true
      }
    } else {
      positional.push(a)
    }
  }
  return { flags, positional }
}
