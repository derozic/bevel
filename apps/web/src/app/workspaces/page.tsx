import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Tenant } from '@bevel/schema'
import {
  isPlatformEntryHost,
  lookupTenantBySlug,
  needsAuthHandoff,
  publicTenantUrl,
  resolveWorkspacesForEmail,
} from '@bevel/tenant-config'
import { Button } from '@bevel/ui'
import { BevelNavMark } from '@/components/BevelNavMark'
import { SuiteNav } from '@/components/SuiteNav'
import { BEVEL_NAME, BEVEL_TRADEMARK_NOTICE } from '@/lib/bevel'
import { auth } from '@/auth'
import { issueAuthHandoffCode } from '@/lib/auth-handoff'

/**
 * Workspace chooser — apex memberships.
 * Always lists orgs for the signed-in email (even a single one when dogfooding).
 */
export default async function WorkspacesPage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/login?callbackUrl=%2Fworkspaces')
  }

  const headerStore = await headers()
  const host = (
    headerStore.get('x-bevel-host') ??
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host') ??
    ''
  )
    .toLowerCase()
    .split(':')[0]

  const { tenants, domain } = resolveWorkspacesForEmail(session.user.email)
  const candidateSlugs = session.workspaceCandidates?.length
    ? session.workspaceCandidates
    : tenants.map((t) => t.slug)

  const workspaces = candidateSlugs
    .map((slug) => lookupTenantBySlug(slug))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))

  const autoHandoff =
    process.env.BEVEL_PLATFORM_AUTO_HANDOFF !== '0' &&
    process.env.BEVEL_PLATFORM_AUTO_HANDOFF !== 'false'

  // Only auto-open a single workspace when not dogfooding and not on platform.
  if (workspaces.length === 1 && autoHandoff && !isPlatformEntryHost(host)) {
    redirect(publicTenantUrl(workspaces[0]!, '/~general'))
  }

  if (workspaces.length === 0) {
    redirect('/account')
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface">
              <BevelNavMark className="size-7" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Your workspaces
              </h1>
              <p className="text-xs text-muted">{BEVEL_NAME} apex</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted">
            <span className="text-foreground">{session.user.email}</span>
            {domain ? <> (@{domain})</> : null} — open a product workspace or
            manage your platform profile.
          </p>
        </div>
        <SuiteNav size="sm" showLabel={false} className="shrink-0" />
      </div>

      <ul className="space-y-3">
        {workspaces.map((ws) => (
          <li key={ws.slug}>
            <WorkspaceOpenLink
              ws={ws}
              email={session.user!.email!}
              name={session.user?.name}
              image={session.user?.image}
              fromHost={host}
            />
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/account">Platform profile</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/claim">Claim another workspace</Link>
        </Button>
      </div>

      <p className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
        {BEVEL_TRADEMARK_NOTICE}
      </p>
    </main>
  )
}

/** Server component: issues handoff when crossing eTLD+1. */
async function WorkspaceOpenLink({
  ws,
  email,
  name,
  image,
  fromHost,
}: {
  ws: Tenant
  email: string
  name?: string | null
  image?: string | null
  fromHost: string
}) {
  const orgHost = ws.host.toLowerCase().split(':')[0] || ws.host
  const callbackPath = '/~general'
  let href = publicTenantUrl(ws, callbackPath)

  if (fromHost && needsAuthHandoff(fromHost, orgHost)) {
    const issued = await issueAuthHandoffCode({
      email,
      name,
      imageUrl: image,
      tenantSlug: ws.slug,
      callbackPath,
    })
    if (issued?.code) {
      const dest = new URL(`https://${orgHost}/api/auth/handoff`)
      dest.searchParams.set('code', issued.code)
      dest.searchParams.set('callbackUrl', callbackPath)
      href = dest.toString()
    }
  }

  return (
    <Link
      href={href}
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
  )
}
