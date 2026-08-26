import { NextResponse } from 'next/server'
import { pickRealtimePayload } from '@/app/status/live-graph'
import { serverRealtimeUrl } from '@/lib/realtime-server'

export const dynamic = 'force-dynamic'

const TARGETS: Record<string, { publicUrl: () => string; probeUrl: () => string }> = {
  realtime: {
    publicUrl: () =>
      `${(
        process.env.NEXT_PUBLIC_REALTIME_URL ||
        process.env.REALTIME_URL ||
        'https://realtime.bevel.is'
      ).replace(/\/$/, '')}/health`,
    // Loopback — Node does not trust the local Caddy CA.
    probeUrl: () => `${serverRealtimeUrl().replace(/\/$/, '')}/health`,
  },
}

export async function GET(request: Request) {
  const target = new URL(request.url).searchParams.get('target') || ''
  const resolve = TARGETS[target]
  if (!resolve) {
    return NextResponse.json(
      { error: 'unknown_target', message: 'Only allowlisted probes can run live.' },
      { status: 400 },
    )
  }

  const url = resolve.publicUrl()
  const probeUrl = resolve.probeUrl()
  const started = Date.now()
  try {
    const res = await fetch(probeUrl, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' },
    })
    const body = await res.text()
    const ok = res.status === 200 && /\bok\b/i.test(body)
    let payload = null
    try {
      payload = pickRealtimePayload(JSON.parse(body))
    } catch {
      payload = null
    }
    return NextResponse.json({
      target,
      url,
      ok,
      status: res.status,
      latencyMs: Date.now() - started,
      at: new Date().toISOString(),
      payload,
    })
  } catch (err) {
    return NextResponse.json({
      target,
      url,
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      at: new Date().toISOString(),
      detail: err instanceof Error ? err.message : 'unreachable',
      payload: null,
    })
  }
}
