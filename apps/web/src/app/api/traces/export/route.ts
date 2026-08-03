import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { bevelApiFetch } from '@/lib/bevel-api.server'

/** GET /api/traces/export?roomKind=&roomId=&tenantId= — NDJSON */
export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const qs = new URLSearchParams()
  for (const key of ['roomKind', 'roomId', 'tenantId', 'limit'] as const) {
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
    const res = await bevelApiFetch(`/api/v1/traces/export?${qs}`)
    const text = await res.text()
    return new NextResponse(text, {
      status: res.status,
      headers: {
        'Content-Type':
          res.headers.get('content-type') || 'application/x-ndjson',
      },
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'traces_export_failed',
      },
      { status: 502 },
    )
  }
}
