import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

export const dynamic = 'force-dynamic'

type Downstream = {
  ok: boolean
  status?: number
  latencyMs?: number
  detail?: string
  databaseOk?: boolean
}

async function probeApi(url: string): Promise<Downstream> {
  const started = Date.now()
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
      headers: { Accept: 'application/json' },
    })
    const body = await res.text()
    let databaseOk = false
    try {
      const j = JSON.parse(body) as {
        status?: string
        database?: { status?: string }
      }
      databaseOk = j.database?.status === 'ok' || j.status === 'ok'
    } catch {
      databaseOk = false
    }
    return {
      ok: res.status === 200 && databaseOk,
      status: res.status,
      latencyMs: Date.now() - started,
      databaseOk,
    }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      detail: err instanceof Error ? err.message : 'unreachable',
      databaseOk: false,
    }
  }
}

async function probeOk(url: string): Promise<Downstream> {
  const started = Date.now()
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
      headers: { Accept: 'application/json' },
    })
    const body = await res.text()
    return {
      ok: res.status === 200 && body.includes('ok'),
      status: res.status,
      latencyMs: Date.now() - started,
    }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - started,
      detail: err instanceof Error ? err.message : 'unreachable',
    }
  }
}

/**
 * Liveness + dependency checks for load balancers and the public status page.
 * Web stays HTTP 200 if the process is up; `degraded` when API/realtime lag.
 */
export async function GET() {
  const started = Date.now()
  const tenantsRoot =
    process.env.BEVEL_TENANTS_ROOT?.trim() ||
    resolve(process.cwd(), '../../tenants')
  const tenantsRootPresent = (() => {
    try {
      return existsSync(tenantsRoot)
    } catch {
      return false
    }
  })()

  const apiBase = (
    process.env.NEXT_PUBLIC_BEVEL_API_URL ||
    process.env.BEVEL_API_URL ||
    'https://api.bevel.is'
  ).replace(/\/$/, '')
  const apiProbeBase =
    process.env.BEVEL_API_URL?.replace(/\/$/, '') || apiBase
  const realtimeBase = (
    process.env.NEXT_PUBLIC_REALTIME_URL ||
    process.env.REALTIME_URL ||
    'https://realtime.bevel.is'
  ).replace(/\/$/, '')
  const realtimeProbeBase =
    process.env.REALTIME_SERVER_URL?.replace(/\/$/, '') || realtimeBase

  const [api, realtime] = await Promise.all([
    probeApi(`${apiProbeBase}/health`),
    probeOk(`${realtimeProbeBase}/health`),
  ])

  const depsOk = Boolean(api.ok && api.databaseOk && realtime.ok)
  const body = {
    ok: true,
    degraded: !depsOk,
    service: 'bevel-web',
    version:
      process.env.BEVEL_GIT_SHA ||
      process.env.NEXT_PUBLIC_GIT_SHA ||
      process.env.npm_package_version ||
      '0.1.0',
    timestamp: new Date().toISOString(),
    latencyMs: Date.now() - started,
    checks: {
      tenantsRoot,
      tenantsRootPresent,
      publicUrl: process.env.BEVEL_PUBLIC_URL || process.env.AUTH_URL || null,
      authConfigured: Boolean(
        process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
      ),
      api: {
        url: `${apiBase}/health`,
        ok: api.ok,
        status: api.status,
        latencyMs: api.latencyMs,
        databaseOk: api.databaseOk,
        detail: api.detail,
      },
      realtime: {
        url: `${realtimeBase}/health`,
        ok: realtime.ok,
        status: realtime.status,
        latencyMs: realtime.latencyMs,
        detail: realtime.detail,
      },
    },
  }

  return Response.json(body, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}
