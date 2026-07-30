import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { bevelApiFetch } from '@/lib/bevel-api.server'

export async function GET(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const qs = new URLSearchParams()
  for (const key of ['kind', 'limit', 'before'] as const) {
    const v = searchParams.get(key)
    if (v) qs.set(key, v)
  }
  const path = `/api/v1/timeline${qs.toString() ? `?${qs}` : ''}`
  try {
    const res = await bevelApiFetch(path)
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'timeline_unavailable',
        items: [],
      },
      { status: 502 },
    )
  }
}
