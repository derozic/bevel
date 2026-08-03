import Link from 'next/link'
import { redirect } from 'next/navigation'
import { resolveWorkspacesForEmail } from '@bevel/tenant-config'
import { Button } from '@bevel/ui'
import { BevelNavMark } from '@/components/BevelNavMark'
import { SuiteNav } from '@/components/SuiteNav'
import { BEVEL_NAME, BEVEL_PRIVATE_PATH, BEVEL_TRADEMARK_NOTICE } from '@/lib/bevel'
import { auth } from '@/auth'

/**
 * Apex platform account (bevel.is) — profile metadata + primary agent + memberships.
 * Distinct from any single product workspace.
 */
export default async function AccountPage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/login?callbackUrl=%2Faccount')
  }

  const email = session.user.email
  const { tenants } = resolveWorkspacesForEmail(email)
  const personalAgent =
    (session.user as { personalAgentId?: string } | undefined)?.personalAgentId ||
    'antigravity (default intelligence)'

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-10 px-6 py-16">
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-2xl border border-border bg-surface shadow-sm">
            <BevelNavMark className="size-9" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              {BEVEL_NAME} apex
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Platform profile
            </h1>
            <p className="mt-1 text-sm text-muted">
              Identity and primary agent live here — workspaces open on product hosts.
            </p>
          </div>
        </div>
        <SuiteNav size="sm" />
      </header>

      <section className="rounded-2xl border border-border bg-surface/50 p-6 space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Account
        </h2>
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">Name</dt>
            <dd className="font-medium text-foreground">
              {session.user.name || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-muted">Email</dt>
            <dd className="font-medium text-foreground">{email}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted">Primary agent / intelligence</dt>
            <dd className="font-medium text-foreground">{personalAgent}</dd>
            <p className="mt-1 text-xs text-muted">
              Default onboard provider: Google Antigravity (LLM). Set personal
              agent in workspace preferences after opening an org.
            </p>
          </div>
        </dl>
      </section>

      <section className="rounded-2xl border border-accent/20 bg-accent/5 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Private
        </h2>
        <p className="mt-2 text-sm text-muted">
          Top-level space with only your agents — no org channels required.
        </p>
        <Button asChild size="sm" className="mt-3">
          <Link href={BEVEL_PRIVATE_PATH}>Open private agents</Link>
        </Button>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Workspaces
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/workspaces">Open picker</Link>
          </Button>
        </div>
        {tenants.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted">
            No product workspaces yet for this email.{' '}
            <Link href="/claim" className="font-medium text-accent underline-offset-2 hover:underline">
              Claim a workspace
            </Link>
            .
          </p>
        ) : (
          <ul className="space-y-2">
            {tenants.map((t) => (
              <li
                key={t.slug}
                className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-foreground">{t.name}</p>
                  <p className="text-xs text-muted">{t.host}</p>
                </div>
                <Link
                  href="/workspaces"
                  className="font-medium text-accent hover:underline"
                >
                  Switch
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
        {BEVEL_TRADEMARK_NOTICE}
      </p>
    </main>
  )
}
