import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { bevelApiFetch } from '@/lib/bevel-api.server'

/**
 * Profile (h-card) + identity.
 * GET  → preferences.profile merged with user columns from Postgres
 * PUT  → update profile section (and denorm name/handle/photo) in Postgres
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
      profile,
      preferences: prefs,
      user: data.user ?? null,
      personalAgentId:
        profile.personalAgentId ||
        data.user?.personalAgentId ||
        null,
      handle: profile.handle || data.user?.handle || null,
      name: profile.displayName || data.user?.name || session.user.name,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'failed' },
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
  try {
    // Support both flat identity fields and nested profile object
    const profilePatch =
      body.profile && typeof body.profile === 'object'
        ? body.profile
        : {
            ...(body.displayName || body.name
              ? { displayName: body.displayName || body.name }
              : {}),
            ...(body.handle !== undefined ? { handle: body.handle } : {}),
            ...(body.photoUrl || body.imageUrl
              ? { photoUrl: body.photoUrl || body.imageUrl }
              : {}),
            ...(body.bio !== undefined ? { bio: body.bio } : {}),
            ...(body.description !== undefined
              ? { description: body.description }
              : {}),
            ...(body.personalAgentId !== undefined
              ? { personalAgentId: body.personalAgentId }
              : {}),
            ...(body.givenName !== undefined ? { givenName: body.givenName } : {}),
            ...(body.familyName !== undefined
              ? { familyName: body.familyName }
              : {}),
            ...(body.pronouns !== undefined ? { pronouns: body.pronouns } : {}),
            ...(body.org !== undefined ? { org: body.org } : {}),
            ...(body.jobTitle !== undefined ? { jobTitle: body.jobTitle } : {}),
            ...(body.location !== undefined ? { location: body.location } : {}),
            ...(body.url !== undefined ? { url: body.url } : {}),
            ...(body.tags !== undefined ? { tags: body.tags } : {}),
            ...(body.attributes !== undefined
              ? { attributes: body.attributes }
              : {}),
            ...(body.socials !== undefined ? { socials: body.socials } : {}),
            ...(body.emailPublic !== undefined
              ? { emailPublic: body.emailPublic }
              : {}),
          }

    const res = await bevelApiFetch('/api/v1/me/profile', {
      method: 'PUT',
      body: JSON.stringify({
        handle: body.handle ?? profilePatch.handle,
        name: body.name ?? profilePatch.displayName,
        imageUrl: body.imageUrl ?? profilePatch.photoUrl,
        personalAgentId: body.personalAgentId ?? profilePatch.personalAgentId,
        clearPersonalAgent: body.clearPersonalAgent === true,
        tenantId:
          body.tenantId ||
          (session as { tenantSlug?: string }).tenantSlug ||
          undefined,
        personalAgentConfig: body.personalAgentConfig,
        profile: profilePatch,
        preferences: body.preferences,
      }),
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
