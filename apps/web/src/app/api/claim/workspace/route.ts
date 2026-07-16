import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import {
  claimHostForSlug,
  claimHostPreview,
  isSoftClaimMode,
  isValidTenantSlug,
  lookupTenantBySlug,
  provisionTenant,
  publicTenantUrl,
  refreshTenantRegistry,
  resolveTenantsRoot,
  resolveWorkspacesForEmail,
  slugifyOrgName,
  tenantsRootWritableStatus,
} from '@bevel/tenant-config'
import { auth } from '@/auth'

export const runtime = 'nodejs'

async function softHostFromRequest(): Promise<string | undefined> {
  if (!isSoftClaimMode()) return undefined
  const headerStore = await headers()
  const host = (
    headerStore.get('x-bevel-host') ??
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host') ??
    ''
  )
    .toLowerCase()
    .split(':')[0]
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    try {
      if (process.env.BEVEL_PUBLIC_URL) {
        return new URL(process.env.BEVEL_PUBLIC_URL).hostname
      }
      if (process.env.AUTH_URL) {
        return new URL(process.env.AUTH_URL).hostname
      }
    } catch {
      /* ignore */
    }
    return undefined
  }
  return host
}

/**
 * GET /api/claim/workspace
 * Ops preflight: tenants root + soft-claim mode (no secrets).
 */
export async function GET() {
  const status = tenantsRootWritableStatus()
  const soft = isSoftClaimMode()
  let softHost: string | undefined
  try {
    softHost = await softHostFromRequest()
  } catch {
    softHost = undefined
  }
  return NextResponse.json({
    ok: true,
    hint: 'POST { name, slug } while signed in to claim a workspace namespace.',
    softClaim: soft,
    softHost: softHost ?? null,
    hostPreviewExample: claimHostPreview('your-org', softHost),
    tenantsRoot: status.tenantsRoot,
    tenantsRootExists: status.exists,
    tenantsRootWritable: status.writable,
    tenantsRootError: status.error ?? null,
  })
}

/**
 * POST /api/claim/workspace
 * Authenticated Google user claims a new org namespace (writes tenants/{slug}).
 */
export async function POST(request: Request) {
  try {
    const session = await auth()
    const email = session?.user?.email?.toLowerCase().trim()
    if (!session?.user || !email) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 })
    }

    let body: {
      name?: string
      slug?: string
      productName?: string
      accent?: string
    }
    try {
      body = (await request.json()) as typeof body
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
    }

    const name = (body.name ?? '').trim()
    const slug = (body.slug ?? slugifyOrgName(name)).trim().toLowerCase()
    const emailDomain = email.split('@')[1] ?? ''

    if (!name) {
      return NextResponse.json(
        { error: 'Organization name is required.' },
        { status: 400 },
      )
    }
    if (!isValidTenantSlug(slug)) {
      return NextResponse.json(
        {
          error:
            'Slug must be 2–48 lowercase letters, numbers, or hyphens.',
        },
        { status: 400 },
      )
    }

    if (lookupTenantBySlug(slug)) {
      return NextResponse.json(
        { error: `Workspace "${slug}" is already taken.`, code: 'taken' },
        { status: 409 },
      )
    }

    const softHost = await softHostFromRequest()

    const result = provisionTenant({
      name,
      slug,
      emailDomain,
      ownerEmail: email,
      productName: body.productName,
      accent: body.accent,
      softHost,
    })

    if (!result.ok) {
      const status =
        result.code === 'taken' || result.code === 'exists'
          ? 409
          : result.code === 'io' || result.code === 'config'
            ? 503
            : 400
      console.error('[claim/workspace] provision failed', {
        code: result.code,
        error: result.error,
        slug,
        tenantsRoot: resolveTenantsRoot(),
      })
      return NextResponse.json(
        { error: result.error, code: result.code },
        { status },
      )
    }

    refreshTenantRegistry()
    const { preferred, tenants } = resolveWorkspacesForEmail(email)
    const onboardingPath = `/onboarding?workspace=${encodeURIComponent(result.tenant.slug)}`
    // Soft multi-tenant: keep user on the claim host (no wildcard DNS required)
    const url =
      softHost || isSoftClaimMode()
        ? onboardingPath
        : publicTenantUrl(result.tenant, onboardingPath)

    return NextResponse.json({
      ok: true,
      slug: result.tenant.slug,
      name: result.tenant.name,
      host: result.host || claimHostForSlug(slug, softHost),
      namespace: result.tenant.realtime.namespace,
      url,
      softClaim: isSoftClaimMode() || Boolean(softHost),
      workspaces: tenants.map((t) => t.slug),
      preferred: preferred?.slug ?? result.tenant.slug,
    })
  } catch (err) {
    console.error('[claim/workspace] unhandled error', err)
    const message =
      err instanceof Error ? err.message : 'Unexpected server error'
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as NodeJS.ErrnoException).code)
        : undefined
    const isIo =
      code === 'EACCES' ||
      code === 'EROFS' ||
      code === 'EPERM' ||
      code === 'ENOENT' ||
      /not writable|EACCES|EROFS/i.test(message)
    return NextResponse.json(
      {
        error: isIo
          ? `Server cannot write tenant config (${code || 'io'}). Set BEVEL_TENANTS_ROOT to a writable path and ensure systemd ReadWritePaths includes it.`
          : message,
        code: isIo ? 'io' : 'server',
      },
      { status: isIo ? 503 : 500 },
    )
  }
}
