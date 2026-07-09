import Link from 'next/link'
import type { Tenant } from '@bevel/schema'

const PLATFORM_LINKS: Record<string, { href: string; label: string }> = {
  '2x4m': { href: 'https://agents.2x4m.lvh.me', label: '2x4m Agents' },
}

export function TenantChrome({ tenant }: { tenant: Tenant }) {
  const link = PLATFORM_LINKS[tenant.slug]
  if (!link) return null

  return (
    <header
      className="flex h-14 items-center justify-between border-b px-4"
      style={{
        borderColor: 'color-mix(in srgb, var(--ink) 12%, transparent)',
        background: 'color-mix(in srgb, var(--cream) 92%, transparent)',
      }}
    >
      <Link
        href={link.href}
        className="text-sm font-medium hover:underline"
        style={{ color: 'var(--ink)' }}
      >
        ← {link.label}
      </Link>
      <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
        {tenant.theme.productName ?? tenant.name}
      </span>
    </header>
  )
}