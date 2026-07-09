import Link from 'next/link'
import { requireTenantFromRequest } from '@bevel/tenant-config'
import { BEVEL_PRODUCT } from '@bevel/realtime-client'

export default async function HomePage() {
  const tenant = await requireTenantFromRequest()

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm uppercase tracking-[0.2em] text-[var(--bevel-text-muted)]">
          {tenant.theme.productName ?? BEVEL_PRODUCT.name}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          {tenant.name}
        </h1>
        <p className="text-lg text-[var(--bevel-text-muted)]">
          {BEVEL_PRODUCT.tagline}
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link
          href="/bevel"
          className="inline-flex h-11 items-center rounded-lg bg-[var(--bevel-accent)] px-5 text-sm font-medium text-white hover:opacity-90"
        >
          Open workspace
        </Link>
        <Link
          href="/login"
          className="inline-flex h-11 items-center rounded-lg border border-[var(--bevel-border)] px-5 text-sm font-medium hover:bg-white/5"
        >
          Sign in
        </Link>
      </div>
      <p className="text-xs text-[var(--bevel-text-muted)]">
        Tenant <code className="font-mono">{tenant.slug}</code> · namespace{' '}
        <code className="font-mono">{tenant.realtime.namespace}</code>
      </p>
    </main>
  )
}