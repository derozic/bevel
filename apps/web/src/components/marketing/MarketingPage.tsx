import type { ReactNode } from 'react'
import type {
  FeatureAccess,
  ResolvedFeatureSet,
  TenantPlan,
} from '@bevel/schema'
import { MarketingSiteHeader } from '@/components/marketing/MarketingSiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { BEVEL_NAME } from '@/lib/bevel'

export function MarketingPage({
  title,
  kicker,
  children,
  tenantSlug,
  namespace,
  plan,
  featureAccess,
  featureSet,
}: {
  title: string
  kicker?: string
  children: ReactNode
  tenantSlug?: string
  namespace?: string
  plan?: TenantPlan | string
  featureAccess?: FeatureAccess | string
  featureSet?: ResolvedFeatureSet | null
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="bevel-home-atmosphere" aria-hidden="true">
        <div className="bevel-home-mesh" />
        <div className="bevel-home-grid" />
      </div>

      <MarketingSiteHeader actions="marketing" />

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-20 pt-10">
        {kicker ? (
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
            {kicker}
          </p>
        ) : null}
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        <div className="prose-bevel mt-8 space-y-4 text-base leading-relaxed text-muted">
          {children}
        </div>
        <p className="mt-12 text-sm text-muted">
          {BEVEL_NAME} · open channels for humans and agents
        </p>
      </main>

      <SiteFooter
        tenantSlug={tenantSlug}
        namespace={namespace}
        plan={plan}
        featureAccess={featureAccess}
        featureSet={featureSet}
      />
    </div>
  )
}
