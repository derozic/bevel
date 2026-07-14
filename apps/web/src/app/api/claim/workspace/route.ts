import { NextResponse } from 'next/server'
import {
  claimHostForSlug,
  isValidTenantSlug,
  lookupTenantBySlug,
  provisionTenant,
  publicTenantUrl,
  refreshTenantRegistry,
  resolveWorkspacesForEmail,
  slugifyOrgName,
} from '@bevel/tenant-config'
import { auth } from '@/auth'

export const runtime = 'nodejs'

/**
 * POST /api/claim/workspace
 * Authenticated Google user claims a new org namespace (writes tenants/{slug}).
 */
export async function POST(request: Request) {
  const session = await auth()
  const email = session?.user?.email?.toLowerCase().trim()
  if (!session?.user || !email) {
    return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
  }

  let body: { name?: string; slug?: string; productName?: string; accent?: string }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const name = (body.name ?? '').trim()
  const slug = (body.slug ?? slugifyOrgName(name)).trim().toLowerCase()
  const emailDomain = email.split('@')[1] ?? ''

  if (!name) {
    return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 })
  }
  if (!isValidTenantSlug(slug)) {
    return NextResponse.json(
      { error: 'Slug must be 2–48 lowercase letters, numbers, or hyphens.' },
      { status: 400 },
    )
  }

  // Domain already preferred elsewhere → still allow claim if unique slug,
  // but warn via multi-workspace picker later.
  if (lookupTenantBySlug(slug)) {
    return NextResponse.json(
      { error: `Workspace “${slug}” is already taken.` },
      { status: 409 },
    )
  }

  const result = provisionTenant({
    name,
    slug,
    emailDomain,
    ownerEmail: email,
    productName: body.productName,
    accent: body.accent,
  })

  if (!result.ok) {
    const status =
      result.code === 'taken' || result.code === 'exists'
        ? 409
        : result.code === 'reserved'
          ? 400
          : 400
    return NextResponse.json({ error: result.error, code: result.code }, { status })
  }

  refreshTenantRegistry()
  const { preferred, tenants } = resolveWorkspacesForEmail(email)
  const url = publicTenantUrl(result.tenant, '/onboarding')

  return NextResponse.json({
    ok: true,
    slug: result.tenant.slug,
    name: result.tenant.name,
    host: result.host || claimHostForSlug(slug),
    namespace: result.tenant.realtime.namespace,
    url,
    workspaces: tenants.map((t) => t.slug),
    preferred: preferred?.slug ?? result.tenant.slug,
  })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST { name, slug } while signed in to claim a workspace namespace.',
  })
}
