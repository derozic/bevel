import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  lookupTenantBySlug,
  publicTenantUrl,
  resolveWorkspacesForEmail,
} from '@bevel/tenant-config'
import { Button } from '@bevel/ui'
import { BevelMark } from '@/components/BevelMark'
import { BEVEL_NAME, BEVEL_TRADEMARK_NOTICE } from '@/lib/bevel'
import { auth } from '@/auth'

/**
 * Multi-workspace chooser when one Google Workspace email maps to several BEVEL orgs.
 */
export default async function WorkspacesPage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/login?callbackUrl=%2Fworkspaces')
  }

  const { tenants, domain } = resolveWorkspacesForEmail(session.user.email)
  const candidateSlugs = session.workspaceCandidates?.length
    ? session.workspaceCandidates
    : tenants.map((t) => t.slug)

  const workspaces = candidateSlugs
    .map((slug) => lookupTenantBySlug(slug))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))

  if (workspaces.length === 1) {
    redirect(publicTenantUrl(workspaces[0]!, '/bevel'))
  }

  if (workspaces.length === 0) {
    redirect('/login?error=AccessDenied')
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <BevelMark size="md" />
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Choose a workspace
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          <span className="text-foreground">{session.user.email}</span>
          {domain ? (
            <>
              {' '}
              (@{domain}) has access to more than one organization on {BEVEL_NAME}.
            </>
          ) : (
            <> has access to more than one organization on {BEVEL_NAME}.</>
          )}{' '}
          Pick where you want to open channels and history.
        </p>
      </div>

      <ul className="space-y-3">
        {workspaces.map((ws) => (
          <li key={ws.slug}>
            <Link
              href={publicTenantUrl(ws, '/bevel')}
              className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface/60 px-5 py-4 transition hover:border-accent/50 hover:bg-surface"
            >
              <div>
                <p className="font-semibold text-foreground">{ws.name}</p>
                <p className="text-xs text-muted">
                  {ws.host} · namespace {ws.realtime.namespace}
                </p>
              </div>
              <span className="text-sm font-medium text-accent">Open</span>
            </Link>
          </li>
        ))}
      </ul>

      <Button asChild variant="ghost" size="sm" className="self-start">
        <Link href="/">Back to home</Link>
      </Button>

      <p className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
        {BEVEL_TRADEMARK_NOTICE}
      </p>
    </main>
  )
}
