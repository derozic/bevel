import { NextResponse } from 'next/server'
import { bevelApiFetch } from '@/lib/bevel-api.server'

export async function GET(request: Request) {
  const tenant = new URL(request.url).searchParams.get('tenant')
  const qs = tenant ? `?tenant=${encodeURIComponent(tenant)}` : ''
  try {
    const res = await bevelApiFetch(`/api/v1/webhooks${qs}`)
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'failed' },
      { status: 502 },
    )
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  try {
    const res = await bevelApiFetch('/api/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'failed' },
      { status: 502 },
    )
  }
}
