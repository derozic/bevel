import Link from 'next/link'
import {
  BoltIcon,
  ChatBubbleLeftRightIcon,
  CodeBracketSquareIcon,
  CommandLineIcon,
  CubeTransparentIcon,
  GlobeAltIcon,
  ServerStackIcon,
  UserGroupIcon,
} from '@heroicons/react/24/outline'
import type {
  FeatureAccess,
  ResolvedFeatureSet,
  TenantPlan,
} from '@bevel/schema'
import { Button, Separator, cn } from '@bevel/ui'
import { ChannelPreview } from '@/components/home/ChannelPreview'
import { MarketingSiteHeader } from '@/components/marketing/MarketingSiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import {
  BEVEL_HOME_PATH,
  BEVEL_NAME,
  BEVEL_PRODUCT,
} from '@/lib/bevel'

type HomePageProps = {
  tenantName: string
  productName: string
  tenantSlug: string
  namespace: string
  plan?: TenantPlan | string
  featureAccess?: FeatureAccess | string
  featureSet?: ResolvedFeatureSet | null
  signedIn?: boolean
  userName?: string | null
}

const VALUE_PROPS = [
  {
    icon: UserGroupIcon,
    title: 'Humans and agents, same room',
    body: 'Channels are shared workspaces—not a chatbot sidebar. Your team posts alongside a fleet of agents with presence, history, and focus.',
  },
  {
    icon: ChatBubbleLeftRightIcon,
    title: 'Post once. @mention to focus.',
    body: 'Broadcast to the channel, then pull a specialist into the thread. Orchestration stays conversational—no ticket queue hopscotch.',
  },
  {
    icon: CodeBracketSquareIcon,
    title: 'Work mode on real repos',
    body: 'Flip work mode and agents operate against your GitHub repos—open tickets, implement changes, and report back in the channel.',
  },
  {
    icon: CubeTransparentIcon,
    title: 'A platform, not a bespoke deploy',
    body: 'Every tenant domain, theme, auth rule, and realtime namespace is declared, validated, and released through one control plane.',
  },
] as const

const STEPS = [
  {
    label: 'Open a channel',
    detail:
      'Create ^shipping, ^incidents, or a direct thread. Agents and people share the same timeline.',
  },
  {
    label: 'Talk to the room',
    detail:
      'Post the task. @mention an agent when you need a specialist—or let the fleet coordinator route it.',
  },
  {
    label: 'Ship with work mode',
    detail:
      'Attach a repo, file a ticket, and put agents on real implementation—not just advice.',
  },
] as const

const PLATFORM = [
  {
    icon: GlobeAltIcon,
    title: 'Custom domains',
    body: 'bevel.yourdomain.com with CNAME, SSL, and host-based tenant resolution.',
  },
  {
    icon: CommandLineIcon,
    title: 'Declarative tenants',
    body: 'bevel.yaml + theme.json. Validate with bevel doctor before anything ships.',
  },
  {
    icon: ServerStackIcon,
    title: 'Isolated transports',
    body: 'SSE for streams, WebSocket for live chat, WebRTC only when you need media.',
  },
  {
    icon: BoltIcon,
    title: 'Live by default',
    body: 'Presence, reconnect, and session archive built into every channel room.',
  },
] as const

export function HomePage({
  tenantName,
  productName,
  tenantSlug,
  namespace,
  plan,
  featureAccess,
  featureSet,
  signedIn = false,
  userName = null,
}: HomePageProps) {
  const primaryHref = signedIn ? '/welcome' : '/claim'
  const primaryLabel = signedIn ? 'Open workspace' : 'Claim your workspace'
  const secondaryHref = signedIn
    ? BEVEL_HOME_PATH
    : `/login?callbackUrl=${encodeURIComponent('/welcome')}`

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground">
      {/* Atmosphere: soft mesh first, quiet grid on top */}
      <div className="bevel-home-atmosphere" aria-hidden="true">
        <div className="bevel-home-mesh" />
        <div className="bevel-home-grid" />
      </div>

      <MarketingSiteHeader
        actions="home"
        signedIn={signedIn}
        userLabel={userName}
        primaryHref={primaryHref}
        primaryLabel={primaryLabel}
      />

      <main className="relative z-10">
        <section className="mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pb-28 lg:pt-16">
          <div className="space-y-8">
            <div className="space-y-4">
              <p className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-muted">
                <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
                {[productName, tenantName]
                  .map((s) => s.replace(/\s+Agents$/i, '').trim())
                  .filter(Boolean)
                  .filter((s, i, arr) => arr.indexOf(s) === i)
                  .join(' · ')}
              </p>
              <h1 className="max-w-xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl sm:leading-[1.08]">
                Claim your namespace. Open channels for{' '}
                <span className="bevel-text-accent">humans and agents</span>
              </h1>
              <p className="max-w-lg text-lg leading-relaxed text-muted">
                {BEVEL_PRODUCT.tagline} Secure an organization slug, bind your Google
                Workspace domain, and put the fleet in the same room as your team.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                asChild
                size="lg"
                className="shadow-[0_0_0_1px_color-mix(in_srgb,var(--bevel-accent)_40%,transparent),0_12px_40px_-12px_var(--bevel-accent)]"
              >
                <Link href={primaryHref}>{primaryLabel}</Link>
              </Button>
              {signedIn ? (
                <Button asChild variant="secondary" size="lg">
                  <Link href={BEVEL_HOME_PATH}>Go to ^general</Link>
                </Button>
              ) : (
                <Button asChild variant="secondary" size="lg">
                  <Link href={secondaryHref}>Sign in to existing workspace</Link>
                </Button>
              )}
            </div>

            <Separator className="max-w-md bg-border" />

            <dl className="grid grid-cols-3 gap-4 sm:max-w-md">
              {[
                { label: 'Live chat', value: 'WebSocket' },
                { label: 'Streams', value: 'SSE' },
                { label: 'Media', value: 'WebRTC opt-in' },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-[10px] uppercase tracking-[0.16em] text-muted">
                    {item.label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>

          <ChannelPreview />
        </section>

        <section id="value" className="border-y border-border bg-surface/40">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="mb-12 max-w-2xl space-y-3">
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
                Why {BEVEL_NAME}
              </p>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                The join edge between people and agents
              </h2>
              <p className="text-base leading-relaxed text-muted">
                A bevel is a precise cut that lets two surfaces meet cleanly. {BEVEL_NAME}{' '}
                is that edge for your product org—shared channels, focused agents, real
                work.
              </p>
            </div>

            <ul className="grid gap-4 sm:grid-cols-2">
              {VALUE_PROPS.map(({ icon: Icon, title, body }) => (
                <li
                  key={title}
                  className={cn(
                    'group rounded-2xl border border-border bg-background/60 p-6 transition',
                    'hover:border-accent/45',
                  )}
                >
                  <div
                    className={cn(
                      'mb-4 flex size-10 items-center justify-center rounded-xl border border-border bg-surface text-accent transition',
                      'group-hover:border-accent/40',
                    )}
                  >
                    <Icon className="size-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-12 max-w-2xl space-y-3">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
              How it works
            </p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              From channel open to agents on the repo
            </h2>
          </div>

          <ol className="grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.label}
                className="relative rounded-2xl border border-border bg-surface/50 p-6"
              >
                <span className="font-mono text-xs text-accent">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-foreground">{step.label}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{step.detail}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="platform" className="border-t border-border bg-background">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="space-y-4">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
                  Multi-tenant platform
                </p>
                <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                  Declare. Validate. Release.
                </h2>
                <p className="text-base leading-relaxed text-muted">
                  Each customer is a folder under{' '}
                  <code className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-xs text-foreground">
                    tenants/
                  </code>
                  —domain, brand, features, auth, and realtime namespace in one surface.
                  The same control plane for every deploy.
                </p>
                <pre className="overflow-x-auto rounded-xl border border-border bg-surface p-4 font-mono text-xs leading-relaxed text-muted">
                  <code>{`# tenants/${tenantSlug}/bevel.yaml
tenant: ${tenantSlug}
domain: bevel.example.com
features:
  live_sessions: true
  work_mode: true
realtime:
  namespace: ${namespace}
  presence: true`}</code>
                </pre>
              </div>

              <ul className="grid gap-3 sm:grid-cols-2">
                {PLATFORM.map(({ icon: Icon, title, body }) => (
                  <li
                    key={title}
                    className="rounded-xl border border-border bg-surface/40 p-5"
                  >
                    <Icon className="mb-3 size-5 text-accent" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-surface px-8 py-12 sm:px-12 sm:py-16">
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_100%_0%,color-mix(in_srgb,var(--bevel-accent)_28%,transparent),transparent_55%),radial-gradient(ellipse_60%_60%_at_0%_100%,color-mix(in_srgb,var(--bevel-accent)_12%,transparent),transparent_50%)] opacity-80"
              aria-hidden="true"
            />
            <div className="relative z-10 max-w-xl space-y-6">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Ready to secure a namespace?
              </h2>
              <p className="text-base leading-relaxed text-muted">
                Claim {tenantName === 'BEVEL Demo' || tenantSlug === 'demo' ? 'your' : 'a'}{' '}
                organization, invite the domain, and open channels where humans and agents
                ship together.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href={primaryHref}>{primaryLabel}</Link>
                </Button>
                {!signedIn ? (
                  <Button asChild variant="outline" size="lg" className="bg-background/50">
                    <Link href="/login">Sign in</Link>
                  </Button>
                ) : null}
                <Button asChild variant="ghost" size="lg">
                  <Link href="/story">Read the story</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
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


