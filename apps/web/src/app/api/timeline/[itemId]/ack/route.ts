import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { bevelApiFetch } from '@/lib/bevel-api.server'

export async function POST(
  _request: Request,
  context: { params: Promise<{ itemId: string }> },
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }
  const { itemId } = await context.params
  try {
    const res = await bevelApiFetch(
      `/api/v1/timeline/${encodeURIComponent(itemId)}/ack`,
      { method: 'POST' },
    )
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'failed' },
      { status: 502 },
    )
  }
}
