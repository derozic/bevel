import Link from 'next/link'
import { listTenants } from '@bevel/tenant-config'
import { Globe, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const tenants = listTenants()

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Overview</h1>
        <p className="mt-1 text-sm text-[var(--bevel-text-muted)]">
          Platform health, tenants, and domain routing.
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--bevel-border)] bg-[var(--bevel-surface)] p-5">
          <p className="text-sm text-[var(--bevel-text-muted)]">Active tenants</p>
          <p className="mt-2 text-3xl font-semibold">{tenants.length}</p>
        </div>
        <Link
          href="/dashboard/domains"
          className="group rounded-xl border border-[var(--bevel-border)] bg-[var(--bevel-surface)] p-5 transition hover:border-[var(--bevel-accent)]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--bevel-text-muted)]">Custom domains</p>
              <p className="mt-2 font-medium">Configure CNAME routing</p>
            </div>
            <Globe className="h-5 w-5 text-[var(--bevel-text-muted)] group-hover:text-[var(--bevel-accent)]" />
          </div>
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium">Tenants</h2>
        <ul className="divide-y divide-[var(--bevel-border)] rounded-xl border border-[var(--bevel-border)] bg-[var(--bevel-surface)]">
          {tenants.map((tenant) => (
            <li key={tenant.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-medium">{tenant.name}</p>
                <p className="text-sm text-[var(--bevel-text-muted)]">
                  {tenant.host} · {tenant.realtime.namespace}
                </p>
              </div>
              <Link
                href={`/dashboard/domains?tenant=${tenant.slug}`}
                className="inline-flex items-center gap-1 text-sm text-[var(--bevel-accent)] hover:underline"
              >
                Domains
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}