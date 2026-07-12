'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { DaypartId, DaypartLogoUrls } from '@bevel/schema'
import { BevelMark } from './BevelMark'
import { resolveWorkspaceLogoUrl } from '@/lib/workspace-logo'

/**
 * Workspace mark + product name for the rail header.
 * Logo is day-part aware: up to four unique marks (morning / midday /
 * afternoon / night), served from /brand/{tenantSlug}/logo-{daypart}.*
 */
export function WorkspaceBrand({
  productName,
  logoUrl,
  logoUrlsByDaypart,
}: {
  productName?: string
  logoUrl?: string
  logoUrlsByDaypart?: DaypartLogoUrls
}) {
  const { data: session } = useSession()
  const slug = session?.tenantSlug
  const [fromDom, setFromDom] = useState<{
    product?: string
    logo?: string
    logos?: DaypartLogoUrls
    daypart?: DaypartId
  }>({})

  useEffect(() => {
    const el = document.documentElement
    const read = () => {
      let logos: DaypartLogoUrls | undefined
      const raw = el.getAttribute('data-tenant-logos')
      if (raw) {
        try {
          logos = JSON.parse(raw) as DaypartLogoUrls
        } catch {
          logos = undefined
        }
      }
      setFromDom({
        product: el.getAttribute('data-tenant-product') || undefined,
        logo: el.getAttribute('data-tenant-logo') || undefined,
        logos,
        daypart: (el.getAttribute('data-daypart') as DaypartId) || undefined,
      })
    }
    read()
    const mo = new MutationObserver(read)
    mo.observe(el, {
      attributes: true,
      attributeFilter: [
        'data-daypart',
        'data-tenant-logo',
        'data-tenant-logos',
        'data-tenant-product',
      ],
    })
    return () => mo.disconnect()
  }, [])

  const resolvedLogo = useMemo(() => {
    return resolveWorkspaceLogoUrl({
      daypart: fromDom.daypart,
      logoUrl: logoUrl || fromDom.logo,
      logoUrlsByDaypart: logoUrlsByDaypart || fromDom.logos,
      tenantSlug: slug,
    })
  }, [
    fromDom.daypart,
    fromDom.logo,
    fromDom.logos,
    logoUrl,
    logoUrlsByDaypart,
    slug,
  ])

  const rawName =
    productName ||
    fromDom.product ||
    (slug === '2x4m' ? '2x4m' : slug) ||
    'BEVEL'
  // Product brand only — never the legacy "… Agents" suffix in the rail
  const name = rawName.replace(/\s+Agents$/i, '').trim() || rawName
  const [logoFailed, setLogoFailed] = useState(false)
  // Reset fail state when URL changes (e.g. daypart or upload)
  useEffect(() => {
    setLogoFailed(false)
  }, [resolvedLogo])

  const showLogo = Boolean(resolvedLogo) && !logoFailed

  return (
    <div className="flex min-w-0 items-center gap-2">
      {showLogo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={resolvedLogo}
          src={resolvedLogo}
          alt=""
          className="h-6 w-auto max-w-[1.75rem] shrink-0 object-contain"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <span className="inline-flex shrink-0">
          <BevelMark size="sm" />
        </span>
      )}
      <span className="truncate text-sm font-semibold tracking-tight text-ink">
        {name}
      </span>
    </div>
  )
}
