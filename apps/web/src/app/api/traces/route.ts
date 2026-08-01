import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { bevelApiFetch } from '@/lib/bevel-api.server'

/**
 * GET  /api/traces?roomKind=&roomId=&tenantId=  — hydrate Trace pane
 * POST /api/traces                              — batch ingest (internal / trusted)
 */
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const qs = new URLSearchParams()
  for (const key of [
    'roomKind',
    'roomId',
    'tenantId',
    'limit',
    'before',
    'kind',
    'agentId',
  ] as const) {
    const v = searchParams.get(key)
    if (v) qs.set(key, v)
  }
  if (!qs.get('roomKind') || !qs.get('roomId') || !qs.get('tenantId')) {
    return NextResponse.json(
      { detail: 'roomKind, roomId, and tenantId are required' },
      { status: 400 },
    )
  }
  try {
    const res = await bevelApiFetch(`/api/v1/traces?${qs}`)
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'traces_unavailable',
        items: [],
      },
      { status: 502 },
    )
  }
}

export async function POST(request: Request) {
  const session = await auth()
  // Prefer signed-in operator; agents use API directly with internal key
  if (!session?.user?.email) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON' }, { status: 400 })
  }
  try {
    const res = await bevelApiFetch('/api/v1/traces', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'traces_ingest_failed',
      },
      { status: 502 },
    )
  }
}
