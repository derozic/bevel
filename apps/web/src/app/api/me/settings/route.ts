import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { bevelApiFetch } from '@/lib/bevel-api.server'

/**
 * Full BevelUserPreferences — source of truth is Postgres via FastAPI.
 * GET  → load preferences for the signed-in user
 * PUT  → deep-merge save profile, appearance, notifications, media, etc.
 */

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }

  try {
    const res = await bevelApiFetch('/api/v1/me/preferences')
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status })
    }
    const prefs = (data.preferences ?? {}) as Record<string, unknown>
    const profile = (prefs.profile ?? {}) as Record<string, unknown>
    return NextResponse.json({
      ok: true,
      preferences: prefs,
      profile,
      user: data.user ?? null,
      email: session.user.email,
      name: session.user.name,
      // Console-compat fields (legacy)
      profile_name:
        (profile.displayName as string) ||
        session.user.name ||
        session.user.email.split('@')[0] ||
        '',
      profile_handle:
        (profile.handle as string) ||
        session.user.email.split('@')[0] ||
        '',
      updatedAt: data.updatedAt ?? null,
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'failed',
      },
      { status: 502 },
    )
  }
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ detail: 'Sign in required' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  // Accept either { preferences: {...} } or a bare preferences document
  const preferences =
    body && typeof body === 'object' && body.preferences
      ? body.preferences
      : body
  const merge = body?.merge !== false
  const tenantId =
    body?.tenantId ||
    (session as { tenantSlug?: string }).tenantSlug ||
    undefined

  try {
    const res = await bevelApiFetch('/api/v1/me/preferences', {
      method: 'PUT',
      body: JSON.stringify({
        preferences,
        merge,
        tenantId,
      }),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(
      {
        ok: res.ok,
        saved: true,
        preferences: data.preferences ?? preferences,
        user: data.user ?? null,
        updatedAt: data.updatedAt ?? null,
        ...(res.ok ? {} : { detail: data.detail || data.error || 'save failed' }),
      },
      { status: res.status },
    )
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : 'failed',
      },
      { status: 502 },
    )
  }
}

export async function PATCH(request: Request) {
  return PUT(request)
}
