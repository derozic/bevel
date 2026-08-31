'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { BevelMark } from './BevelMark'
import { platformPublicUrl } from '@/lib/platform'

/**
 * Rail lockup: BEVEL™ wordmark + workspace name.
 * Space switching lives in the header on the right — never a second property pill here.
 */
export function WorkspaceBrand({ productName }: { productName?: string }) {
  const { data: session } = useSession()
  const slug = session?.tenantSlug
  const [fromDom, setFromDom] = useState<string | undefined>()

  useEffect(() => {
    const el = document.documentElement
    const read = () =>
      setFromDom(el.getAttribute('data-tenant-product') || undefined)
    read()
    const mo = new MutationObserver(read)
    mo.observe(el, {
      attributes: true,
      attributeFilter: ['data-tenant-product'],
    })
    return () => mo.disconnect()
  }, [])

  const rawName =
    productName ||
    fromDom ||
    (slug === '2x4m' ? '2x4m' : slug) ||
    'BEVEL'
  const name = rawName.replace(/\s+Agents$/i, '').trim() || rawName

  return (
    <div className="bevel-rail-brand">
      <Link
        href={platformPublicUrl()}
        className="bevel-rail-wordmark"
        title="BEVEL — platform home"
      >
        <BevelMark size="sm" />
      </Link>
      <span className="bevel-rail-brand-name">{name}</span>
    </div>
  )
}
