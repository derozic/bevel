import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import type { Tenant } from '@bevel/schema'
import {
  isPlatformEntryHost,
  lookupTenantBySlug,
  publicTenantUrl,
  resolveWorkspacesForEmail,
  tenantPublicHost,
} from '@bevel/tenant-config'
import { Button } from '@bevel/ui'
import { BevelNavMark } from '@/components/BevelNavMark'
import { SuiteNav } from '@/components/SuiteNav'
import {
  BEVEL_HOME_PATH,
  BEVEL_NAME,
  BEVEL_PRIVATE_PATH,
  BEVEL_TRADEMARK_NOTICE,
} from '@/lib/bevel'
import { BrandSquare } from '@/components/BrandSquare'
import { auth } from '@/auth'
import { workspaceOpenHref } from '@/lib/workspace-spaces.server'
import {
  NATIVE_COMPLETE_PATH,
  isNativeLoginPending,
} from '@/lib/auth-native'

/**
 * Chooser after apex login: **Private** (agents only) + every product workspace
 * the email is allowed into. Never auto-skip on bevel.is when orgs exist.
 */
export default async function WorkspacesPage() {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/login?callbackUrl=%2Fworkspaces')
  }

  if (await isNativeLoginPending()) {
    redirect(NATIVE_COMPLETE_PATH)
  }

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

  const onPlatform = isPlatformEntryHost(host)
  const { tenants, domain } = resolveWorkspacesForEmail(session.user.email)
  const candidateSlugs = session.workspaceCandidates?.length
    ? session.workspaceCandidates
    : tenants.map((t) => t.slug)

  const workspaces = candidateSlugs
    .map((slug) => lookupTenantBySlug(slug))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))

  // Only auto-open a single org when already on a non-platform host.
  if (
    workspaces.length === 1 &&
    !onPlatform &&
    process.env.BEVEL_PLATFORM_AUTO_HANDOFF !== '0'
  ) {
    redirect(publicTenantUrl(workspaces[0]!, BEVEL_HOME_PATH, host))
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-8 px-6 py-16">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface">
              <BevelNavMark className="size-7" />
            </span>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                Where do you want to go?
              </h1>
              <p className="text-xs text-muted">{BEVEL_NAME} · choose a space</p>
            </div>
          </div>
          <p className="text-sm leading-relaxed text-muted">
            <span className="text-foreground">{session.user.email}</span>
            {domain ? <> (@{domain})</> : null}
            {' — '}
            one identity. Private is always yours; product workspaces are
            memberships you enter on purpose.
          </p>
        </div>
        <SuiteNav size="sm" showLabel={false} className="shrink-0" />
      </div>

      <div className="bevel-brand-square-grid bevel-brand-square-grid--wide">
        <BrandSquare
          href={BEVEL_PRIVATE_PATH}
          label="Private"
          caption="you + agents"
          logoUrl="/brand/bevel-mark.svg"
          processKey="private"
        />
        {workspaces.map((ws) => (
          <WorkspaceOpenLink
            key={ws.slug}
            ws={ws}
            email={session.user!.email!}
            name={session.user?.name}
            image={session.user?.image}
            fromHost={host}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/account">Platform profile</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href="/claim">Claim workspace</Link>
        </Button>
      </div>

      <p className="text-[10px] uppercase tracking-[0.16em] text-muted/80">
        {BEVEL_TRADEMARK_NOTICE}
      </p>
    </main>
  )
}

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
  const orgHost = tenantPublicHost(ws, fromHost)
  const href = await workspaceOpenHref({
    tenant: ws,
    fromHost,
    email,
    name,
    image,
  })

  return (
    <BrandSquare
      href={href}
      label={ws.theme.productName || ws.name}
      caption={orgHost}
      logoUrl={ws.theme.brandIconUrl || ws.theme.logoUrl || ws.theme.markUrl}
      processKey={ws.slug}
      process={ws.theme.accent}
      title={`${ws.name} · ${orgHost}`}
    />
  )
}
