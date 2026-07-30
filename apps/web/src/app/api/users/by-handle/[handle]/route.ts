import { NextResponse } from 'next/server'
import { bevelApiFetch } from '@/lib/bevel-api.server'

export async function GET(
  request: Request,
  context: { params: Promise<{ handle: string }> },
) {
  const { handle } = await context.params
  const tenant = new URL(request.url).searchParams.get('tenant')
  const qs = tenant ? `?tenant=${encodeURIComponent(tenant)}` : ''
  try {
    const res = await bevelApiFetch(
      `/api/v1/users/by-handle/${encodeURIComponent(handle)}${qs}`,
      { auth: false },
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
