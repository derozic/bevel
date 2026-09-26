'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LEGAL_NAV } from '@/lib/legal'

export function LegalNav() {
  const pathname = usePathname()
  return (
    <nav className="legal-nav" aria-label="Legal pages">
      {LEGAL_NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          data-active={pathname === item.href ? 'true' : 'false'}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
