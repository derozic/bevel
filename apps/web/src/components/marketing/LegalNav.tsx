import Link from 'next/link'

/** Cross-links for the legal / trust document set. */
export const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/cookies', label: 'Cookies' },
  { href: '/ccpa', label: 'CCPA' },
  { href: '/dpa', label: 'DPA' },
  { href: '/subprocessors', label: 'Subprocessors' },
  { href: '/security', label: 'Security' },
] as const

export function LegalNav({ current }: { current?: string }) {
  return (
    <nav
      aria-label="Legal documents"
      className="not-prose mt-10 rounded-xl border border-border bg-surface/40 px-4 py-3"
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        Legal &amp; trust
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-sm">
        {LEGAL_LINKS.map((item) => {
          const active = current === item.href
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={
                  active
                    ? 'font-semibold text-foreground'
                    : 'text-accent hover:underline'
                }
                aria-current={active ? 'page' : undefined}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
