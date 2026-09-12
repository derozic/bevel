import { NextResponse } from 'next/server'
import { bevelApiFetch } from '@/lib/bevel-api.server'

export const runtime = 'nodejs'

/** Standing ingest for channel nuggets (atom → page). Auth: fleet internal key. */
export async function GET() {
  try {
    const res = await bevelApiFetch('/api/v1/ingest/nuggets', {
      auth: false,
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

export async function POST(request: Request) {
  const incomingKey =
    request.headers.get('x-fleet-internal-key') ||
    request.headers.get('authorization') ||
    ''
  const body = await request.text()
  try {
    const res = await bevelApiFetch('/api/v1/ingest/nuggets', {
      method: 'POST',
      body,
      auth: false,
      headers: {
        'Content-Type': 'application/json',
        'X-Fleet-Internal-Key': incomingKey.replace(/^Bearer\s+/i, ''),
      },
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
