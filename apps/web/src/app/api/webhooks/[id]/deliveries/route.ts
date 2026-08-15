import { NextResponse } from 'next/server'
import { bevelApiFetch } from '@/lib/bevel-api.server'

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  try {
    const res = await bevelApiFetch(
      `/api/v1/webhooks/${encodeURIComponent(id)}/deliveries`,
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
