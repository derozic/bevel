import type { ReactNode } from 'react'
import { headers } from 'next/headers'
import type {
  FeatureAccess,
  ResolvedFeatureSet,
  TenantPlan,
} from '@bevel/schema'
import { LegalNav } from '@/components/marketing/LegalNav'
import { MarketingSiteHeader } from '@/components/marketing/MarketingSiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { auth } from '@/auth'
import { BEVEL_NAME } from '@/lib/bevel'
import { signedInProductHome } from '@/lib/marketing'

export async function MarketingPage({
  title,
  kicker,
  children,
  tenantSlug,
  namespace,
  plan,
  featureAccess,
  featureSet,
  article = false,
}: {
  title: string
  kicker?: string
  article?: boolean
  children: ReactNode
  tenantSlug?: string
  namespace?: string
  plan?: TenantPlan | string
  featureAccess?: FeatureAccess | string
  featureSet?: ResolvedFeatureSet | null
}) {
  const session = await auth()
  const headerStore = await headers()
  const host = (
    headerStore.get('x-bevel-host') ??
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host') ??
    ''
  )
    .split(',')[0]
    ?.trim()
    .toLowerCase()
    .split(':')[0] || ''
  const signedIn = Boolean(session?.user?.email)
  const productHome = signedInProductHome(host)

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="bevel-home-atmosphere" aria-hidden="true">
        <div className="bevel-home-mesh" />
        <div className="bevel-home-grid" />
      </div>

      <MarketingSiteHeader
        actions="marketing"
        signedIn={signedIn}
        userLabel={session?.user?.name || session?.user?.email || null}
        productHref={productHome.href}
        productLabel={productHome.label}
      />

      <main className="relative z-10 mx-auto max-w-3xl px-6 pb-20 pt-10">
        <div className={article ? 'legal-article' : undefined}>
          {article ? <LegalNav /> : null}
          {kicker ? (
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
              {kicker}
            </p>
          ) : null}
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          <div className="prose-bevel mt-8 space-y-4 leading-relaxed">
            {children}
          </div>
          <p className="mt-12 text-sm text-muted">
            {BEVEL_NAME} · open channels for humans and agents
          </p>
        </div>
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
