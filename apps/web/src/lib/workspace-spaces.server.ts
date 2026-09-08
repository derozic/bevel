import type { Tenant } from '@bevel/schema'
import {
  isPlatformEntryHost,
  isPreviewHost,
  lookupTenantByHost,
  lookupTenantBySlug,
  needsAuthHandoff,
  publicTenantUrl,
  tenantPublicHost,
} from '@bevel/tenant-config'
import { issueAuthHandoffCode } from '@/lib/auth-handoff'
import { BEVEL_HOME_PATH, BEVEL_PRIVATE_PATH } from '@/lib/bevel'
import { platformPublicUrl } from '@/lib/platform'

export const PRIVATE_SPACE_SLUG = 'private'

export type WorkspaceSpace = {
  slug: string
  label: string
  href: string
  current: boolean
  kind: 'private' | 'workspace'
}

function requestHost(raw?: string | null): string {
  return (raw || '').split(',')[0]?.trim().toLowerCase().split(':')[0] || ''
}

function stayOnPreview(fromHost: string, destHost: string): boolean {
  return (
    process.env.NODE_ENV !== 'production' ||
    isPreviewHost(fromHost) ||
    isPreviewHost(destHost)
  )
}

export async function workspaceOpenHref(opts: {
  tenant: Tenant
  fromHost: string
  email: string
  name?: string | null
  image?: string | null
  callbackPath?: string
}): Promise<string> {
  const callbackPath = opts.callbackPath || BEVEL_HOME_PATH
  const orgHost = tenantPublicHost(opts.tenant, opts.fromHost)
  let href = publicTenantUrl(opts.tenant, callbackPath, opts.fromHost)

  if (
    opts.fromHost &&
    !stayOnPreview(opts.fromHost, orgHost) &&
    needsAuthHandoff(opts.fromHost, orgHost)
  ) {
    const issued = await issueAuthHandoffCode({
      email: opts.email,
      name: opts.name,
      imageUrl: opts.image,
      tenantSlug: opts.tenant.slug,
      callbackPath,
    })
    if (issued?.code) {
      const dest = new URL(`https://${orgHost}/api/auth/handoff`)
      dest.searchParams.set('code', issued.code)
      dest.searchParams.set('callbackUrl', callbackPath)
      href = dest.toString()
    }
  }
  return href
}

export function currentWorkspaceSlug(fromHost: string): string {
  const host = requestHost(fromHost)
  if (isPlatformEntryHost(host)) return PRIVATE_SPACE_SLUG
  return lookupTenantByHost(host)?.slug || ''
}

export function listWorkspaceSpaces(opts: {
  fromHost: string
  candidateSlugs: string[]
}): WorkspaceSpace[] {
  const fromHost = requestHost(opts.fromHost)
  const current = currentWorkspaceSlug(fromHost)
  const spaces: WorkspaceSpace[] = [
    {
      slug: PRIVATE_SPACE_SLUG,
      label: 'Private',
      href: `/api/workspaces/open?slug=${PRIVATE_SPACE_SLUG}`,
      current: current === PRIVATE_SPACE_SLUG,
      kind: 'private',
    },
  ]

  for (const slug of opts.candidateSlugs) {
    const ws = lookupTenantBySlug(slug)
    if (!ws) continue
    spaces.push({
      slug: ws.slug,
      label: ws.theme.productName || ws.name,
      href: `/api/workspaces/open?slug=${encodeURIComponent(ws.slug)}`,
      current: current === ws.slug,
      kind: 'workspace',
    })
  }

  return spaces
}

export async function resolveWorkspaceOpenUrl(opts: {
  slug: string
  email: string
  name?: string | null
  image?: string | null
  fromHost: string
}): Promise<string | null> {
  const fromHost = requestHost(opts.fromHost)
  const slug = opts.slug.trim().toLowerCase()

  if (slug === PRIVATE_SPACE_SLUG || slug === 'platform' || slug === 'me') {
    if (isPlatformEntryHost(fromHost)) return BEVEL_PRIVATE_PATH
    const dest = platformPublicUrl(BEVEL_PRIVATE_PATH)
    try {
      const host = new URL(dest).hostname
      if (
        fromHost &&
        !stayOnPreview(fromHost, host) &&
        needsAuthHandoff(fromHost, host)
      ) {
        const issued = await issueAuthHandoffCode({
          email: opts.email,
          name: opts.name,
          imageUrl: opts.image,
          tenantSlug: 'platform',
          callbackPath: BEVEL_PRIVATE_PATH,
        })
        if (issued?.code) {
          const url = new URL(`https://${host}/api/auth/handoff`)
          url.searchParams.set('code', issued.code)
          url.searchParams.set('callbackUrl', BEVEL_PRIVATE_PATH)
          return url.toString()
        }
      }
    } catch {
      /* fall through to dest */
    }
    return dest
  }

  const tenant = lookupTenantBySlug(slug)
  if (!tenant) return null
  return workspaceOpenHref({
    tenant,
    fromHost,
    email: opts.email,
    name: opts.name,
    image: opts.image,
  })
}
