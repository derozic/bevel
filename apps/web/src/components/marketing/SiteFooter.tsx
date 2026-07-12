'use client'

import Link from 'next/link'
import type {
  FeatureAccess,
  ResolvedFeatureSet,
  TenantPlan,
} from '@bevel/schema'
import { BevelMark } from '@/components/BevelMark'
import { FeatureFlagsBar } from '@/components/FeatureFlagsBar'
import { BEVEL_NAME, BEVEL_TRADEMARK_NOTICE } from '@/lib/bevel'
import { BEVEL_SOCIAL, FOOTER_COLUMNS } from '@/lib/marketing'

export function SiteFooter({
  tenantSlug,
  namespace,
  plan,
  featureAccess,
  featureSet,
}: {
  tenantSlug?: string
  namespace?: string
  plan?: TenantPlan | string
  featureAccess?: FeatureAccess | string
  featureSet?: ResolvedFeatureSet | null
}) {
  return (
    <footer className="relative z-10 border-t border-border bg-surface/30">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-2 text-foreground">
              <BevelMark size="sm" />
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted">
              Open channels for humans and agents. Claim your namespace, invite the
              team, and put the fleet to work.
            </p>
            <ul className="flex flex-wrap gap-3 text-xs font-medium text-muted">
              <li>
                <a
                  href={BEVEL_SOCIAL.x}
                  className="transition hover:text-foreground"
                  rel="me noopener noreferrer"
                  target="_blank"
                >
                  X
                </a>
              </li>
              <li>
                <a
                  href={BEVEL_SOCIAL.github}
                  className="transition hover:text-foreground"
                  rel="me noopener noreferrer"
                  target="_blank"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href={BEVEL_SOCIAL.linkedin}
                  className="transition hover:text-foreground"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  LinkedIn
                </a>
              </li>
              <li>
                <a
                  href={BEVEL_SOCIAL.youtube}
                  className="transition hover:text-foreground"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  YouTube
                </a>
              </li>
            </ul>
          </div>

          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                {col.title}
              </p>
              <ul className="mt-3 space-y-2">
                {col.links.map((link) => (
                  <li key={link.href + link.label}>
                    {link.href.startsWith('mailto:') ? (
                      <a
                        href={link.href}
                        className="text-sm text-muted transition hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-muted transition hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 space-y-4 border-t border-border pt-6">
          <FeatureFlagsBar
            plan={plan}
            featureAccess={featureAccess}
            featureSet={featureSet}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
              {BEVEL_TRADEMARK_NOTICE}
            </p>
            <p className="text-xs text-muted">
              {BEVEL_NAME}
              {tenantSlug ? (
                <>
                  {' · '}
                  <code className="font-mono text-foreground/80">{tenantSlug}</code>
                </>
              ) : null}
              {namespace ? (
                <>
                  {' · ns '}
                  <code className="font-mono text-foreground/80">{namespace}</code>
                </>
              ) : null}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
