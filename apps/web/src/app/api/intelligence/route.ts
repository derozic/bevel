import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { bevelApiFetch } from '@/lib/bevel-api.server'

/** POST /api/intelligence — onboard default intelligence (Antigravity). */
export async function POST(request: Request) {
  const session = await auth()
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
    const res = await bevelApiFetch('/api/v1/intelligence', {
      method: 'POST',
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'intelligence_unavailable',
      },
      { status: 502 },
    )
  }
}

/** GET /api/intelligence — status (installed / configured). */
export async function GET() {
  try {
    const res = await bevelApiFetch('/api/v1/intelligence/status', {
      auth: false,
    })
    // status may be open; still attach fleet key when present
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        installed: false,
        configured: false,
        error: err instanceof Error ? err.message : 'intelligence_status_failed',
      },
      { status: 502 },
    )
  }
}
