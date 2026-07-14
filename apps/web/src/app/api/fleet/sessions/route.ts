import { auth } from '@/auth'
import { serverRealtimeUrl } from '@/lib/realtime-server'

/**
 * Proxy session archive list from realtime (JSONL recordings).
 * BevelRail expects /api/fleet/sessions; realtime exposes /api/sessions.
 */
export async function GET() {
  const session = await auth()
  const realtimeToken = session?.realtimeToken
  if (!realtimeToken) {
    return Response.json({ error: 'Sign in required' }, { status: 401 })
  }

  try {
    const res = await fetch(`${serverRealtimeUrl()}/api/sessions`, {
      headers: { Authorization: `Bearer ${realtimeToken}` },
      cache: 'no-store',
    })
    const body = await res.text()
    return new Response(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return Response.json(
      {
        error: 'Realtime unavailable',
        detail: e instanceof Error ? e.message : 'fetch failed',
      },
      { status: 503 },
    )
  }
}
