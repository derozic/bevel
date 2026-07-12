'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { DaypartId, Tenant } from '@bevel/schema'
import { resolveWorkspaceLogoUrl } from '@/lib/workspace-logo'

/** Product home links for workspace → platform (used by rail back-link). */
export const PLATFORM_HOME_LINKS: Record<string, { href: string; label: string }> = {
  '2x4m': { href: 'https://2x4m.lvh.me', label: '2x4m' },
}

const PLATFORM_LINKS = PLATFORM_HOME_LINKS

/**
 * Top platform strip — workspace logo (left of product name) + optional
 * link back to the product home. Logo switches with day-part (4 unique marks).
 */
export function TenantChrome({ tenant }: { tenant: Tenant }) {
  const link = PLATFORM_LINKS[tenant.slug]
  const productName = (
    tenant.theme.productName ??
    tenant.name ??
    tenant.slug
  ).replace(/\s+Agents$/i, '')
  const [daypart, setDaypart] = useState<DaypartId | undefined>(undefined)

  useEffect(() => {
    const el = document.documentElement
    const read = () =>
      setDaypart((el.getAttribute('data-daypart') as DaypartId) || undefined)
    read()
    const mo = new MutationObserver(read)
    mo.observe(el, { attributes: true, attributeFilter: ['data-daypart'] })
    return () => mo.disconnect()
  }, [])

  const logoUrl = resolveWorkspaceLogoUrl({
    daypart,
    logoUrl: tenant.theme.logoUrl || tenant.theme.markUrl,
    logoUrlsByDaypart: tenant.theme.logoUrlsByDaypart,
    tenantSlug: tenant.slug,
  })

  return (
    <header
      className="flex h-14 items-center justify-between gap-3 border-b px-4"
      style={{
        borderColor: 'color-mix(in srgb, var(--ink) 12%, transparent)',
        background: 'color-mix(in srgb, var(--cream) 92%, transparent)',
      }}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={logoUrl}
            src={logoUrl}
            alt=""
            className="h-7 w-auto max-w-[2.25rem] object-contain"
            style={{ filter: 'var(--tenant-logo-filter, none)' }}
          />
        ) : null}
        <span
          className="truncate text-sm font-semibold"
          style={{ color: 'var(--ink)' }}
        >
          {productName}
        </span>
      </div>
      {link ? (
        <Link
          href={link.href}
          className="shrink-0 text-sm font-medium hover:underline"
          style={{ color: 'var(--ink)' }}
        >
          ← {link.label}
        </Link>
      ) : (
        <span className="text-xs text-muted" style={{ color: 'var(--sticker-muted)' }}>
          {tenant.slug}
        </span>
      )}
    </header>
  )
}
