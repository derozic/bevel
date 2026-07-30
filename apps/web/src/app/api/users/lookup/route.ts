import { NextResponse } from 'next/server'
import { bevelApiFetch } from '@/lib/bevel-api.server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const qs = new URLSearchParams()
  for (const key of ['q', 'tenant', 'limit'] as const) {
    const v = searchParams.get(key)
    if (v) qs.set(key, v)
  }
  const path = `/api/v1/users/lookup${qs.toString() ? `?${qs}` : ''}`
  try {
    const res = await bevelApiFetch(path, { auth: false })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'lookup_unavailable',
        users: [],
      },
      { status: 502 },
    )
  }
}
