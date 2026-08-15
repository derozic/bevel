import { NextResponse } from 'next/server'
import { bevelApiBase } from '@/lib/bevel-api.server'

export const runtime = 'nodejs'

/** Public ingest proxy — signature checked by the API. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const raw = await request.text()
  try {
    const res = await fetch(
      `${bevelApiBase()}/api/v1/webhooks/inbound/${encodeURIComponent(id)}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': request.headers.get('content-type') || 'application/json',
          Authorization: request.headers.get('authorization') || '',
          'X-Bevel-Signature': request.headers.get('x-bevel-signature') || '',
        },
        body: raw,
      },
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  return NextResponse.json({
    ok: true,
    hint: 'POST a workflow event to land in a track (~slug) or conversation (dm-*).',
    inbound: `/api/webhooks/inbound/${id}`,
    api: `/api/v1/webhooks/inbound/${id}`,
    auth: 'Authorization: Bearer <secret> or X-Bevel-Signature: t=…,v1=…',
  })
}
