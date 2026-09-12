import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  isPlatformEntryTenantSlug,
  requireTenantFromRequest,
} from '@bevel/tenant-config'
import { Button } from '@bevel/ui'
import { BevelDaypartMark } from '@/components/BevelDaypartMark'
import { FleetAvatar } from '@/components/avatars/FleetAvatar'
import { agents } from '@/lib/agent-catalog'
import { auth } from '@/auth'
import { FolksonomyChips } from '@/components/FolksonomyChips'
import { FirstRunPanel } from '@/components/onboarding/FirstRunPanel'
import {
  BEVEL_PRIVATE_PATH,
  BEVEL_TAGS_PATH,
  BEVEL_TIMELINE_PATH,
  bevelAgentProfilePath,
  bevelTalkPath,
} from '@/lib/bevel'
import {
  personalAgentTalkPath,
  resolvePersonalAgentId,
} from '@/lib/personal-agent'

/**
 * Top-level private space on bevel.is — just you and your agents.
 * Org workspaces remain optional (picker / claim).
 */
export default async function PrivateMePage() {
  const session = await auth()
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(BEVEL_PRIVATE_PATH)}`)
  }

  const tenant = await requireTenantFromRequest()
  const personalId = resolvePersonalAgentId(
    (session.user as { personalAgentId?: string }).personalAgentId,
  )
  const primary = agents.find((a) => a.id === personalId) ?? agents[0]!

  // On org hosts, private me still works but chrome is workspace-branded.
  const isApex = isPlatformEntryTenantSlug(tenant.slug)

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-10">
        <header className="flex items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface shadow-sm">
            <BevelDaypartMark className="size-9" />
          </span>
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              {isApex ? 'Private · bevel.is' : 'Private agents'}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Just you and your agents
            </h1>
            <p className="text-sm leading-relaxed text-muted">
              Top-level BEVEL space — no org channels required. Open a direct
              thread, set your primary agent in preferences, or jump into a
              product workspace when you need team history.
            </p>
          </div>
        </header>

        {isApex ? <FirstRunPanel mode="private" /> : null}

        <section className="rounded-2xl border border-accent/25 bg-accent/5 p-5 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Primary agent
          </p>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-foreground">
                {primary.name}
              </p>
              <p className="text-sm text-muted">
                {primary.tagline ?? primary.role}
              </p>
            </div>
            <Button asChild size="md">
              <Link href={personalAgentTalkPath(personalId)}>
                Open conversation
              </Link>
            </Button>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Your agents
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {agents.map((agent) => (
              <li
                key={agent.id}
                className="rounded-xl border border-border bg-surface/60 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <Link
                    href={bevelAgentProfilePath(agent.id)}
                    className="shrink-0"
                    title={`${agent.name} profile`}
                  >
                    <FleetAvatar
                      agentId={agent.id}
                      name={agent.name}
                      accent={agent.accent}
                      size={36}
                    />
                  </Link>
                  <Link
                    href={bevelTalkPath(agent.id)}
                    className="min-w-0 flex-1 transition hover:opacity-90"
                  >
                    <p className="truncate font-medium text-foreground">
                      {agent.name}
                      {agent.id === personalId ? (
                        <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-accent">
                          primary
                        </span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {agent.tagline ?? agent.role}
                    </p>
                  </Link>
                </div>
                <div className="mt-2 pl-12">
                  <FolksonomyChips kind="agent" id={agent.id} compact />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="flex flex-wrap gap-3 border-t border-border pt-6">
          <Button asChild variant="outline" size="sm">
            <Link href="/workspaces">Product workspaces</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/account">Platform profile</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={BEVEL_TAGS_PATH}>Tags</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={BEVEL_TIMELINE_PATH}>Timeline</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/claim">Claim workspace</Link>
          </Button>
        </section>
      </div>
    </div>
  )
}
