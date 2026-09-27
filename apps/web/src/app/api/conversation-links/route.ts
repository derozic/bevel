import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { bevelApiFetch, hostTenantSlug } from '@/lib/bevel-api.server'
import { sessionActorId } from '@/lib/session-user'

export async function POST(request: Request) {
  const session = await auth()
  const actor = sessionActorId(session)
  if (!actor) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }
  const body = (await request.json().catch(() => null)) as {
    targetKind?: string
    targetId?: string
    title?: string
    agentIds?: string[]
    expireInDays?: number | null
    pin?: string | null
    pinLength?: number | null
    allowOutside?: boolean
    verify?: 'single' | 'double'
  } | null
  if (!body?.targetKind || !body.targetId) {
    return NextResponse.json({ error: 'Choose a conversation' }, { status: 400 })
  }
  const tenant = (await hostTenantSlug()) || 'platform'
  const expire = body.expireInDays === null ? null : 7
  const res = await bevelApiFetch('/api/v1/conversation-links', {
    method: 'POST',
    body: JSON.stringify({
      tenantSlug: tenant,
      targetKind: body.targetKind,
      targetId: body.targetId,
      title: body.title ?? '',
      agentIds: body.agentIds ?? [],
      expireInDays: expire,
      pin: body.pin ?? null,
      pinLength: body.pinLength ?? null,
      allowOutside: body.allowOutside !== false,
      verify: body.verify === 'double' ? 'double' : 'single',
    }),
  })
  const data = (await res.json().catch(() => ({}))) as { path?: string; detail?: string }
  if (!res.ok || !data.path) {
    const detail = typeof data.detail === 'string' ? data.detail : 'Could not create the link'
    return NextResponse.json({ error: detail }, { status: res.status || 502 })
  }
  const origin = new URL(request.url).origin
  return NextResponse.json({ url: `${origin}${data.path}`, expiresAt: (data as { expiresAt?: string }).expiresAt ?? null })
}
