import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { bevelApiFetch } from '@/lib/bevel-api.server'

/**
 * GET  /api/fleet/channels/:slug/agents?tenant=
 * PUT  /api/fleet/channels/:slug/agents  body { agentIds: string[] }
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }
  const { slug } = await ctx.params
  const { searchParams } = new URL(request.url)
  const tenant =
    searchParams.get('tenant') ||
    session.tenantSlug ||
    process.env.NEXT_PUBLIC_DEFAULT_TENANT ||
    '2x4m'
  try {
    const res = await bevelApiFetch(
      `/api/v1/fleet/channels/${encodeURIComponent(slug)}/agents?tenant=${encodeURIComponent(tenant)}`,
    )
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'agents_unavailable' },
      { status: 502 },
    )
  }
}

export async function PUT(
  request: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }
  const { slug } = await ctx.params
  const { searchParams } = new URL(request.url)
  const tenant =
    searchParams.get('tenant') ||
    session.tenantSlug ||
    process.env.NEXT_PUBLIC_DEFAULT_TENANT ||
    '2x4m'
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ detail: 'Invalid JSON' }, { status: 400 })
  }
  try {
    const res = await bevelApiFetch(
      `/api/v1/fleet/channels/${encodeURIComponent(slug)}/agents?tenant=${encodeURIComponent(tenant)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          ...(typeof body === 'object' && body ? body : {}),
          addedBy: session.user.email,
        }),
      },
    )
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'agents_update_failed' },
      { status: 502 },
    )
  }
}
