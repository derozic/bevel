'use client'

import { BookOpen, Braces, ExternalLink, FileJson, KeyRound, Server } from 'lucide-react'
import { bevelUrls } from '@/components/console/bevel-urls'

const LINKS = [
  {
    title: 'OpenAPI / Swagger UI',
    href: () => bevelUrls.docs(),
    body: 'Interactive FastAPI REST documentation — try tenants, fleet, handoff, announcements.',
    icon: FileJson,
  },
  {
    title: 'GraphQL (GraphiQL)',
    href: () => bevelUrls.graphql(),
    body: 'Strawberry GraphQL playground for tenants, channels, and messages.',
    icon: Braces,
  },
  {
    title: 'Health JSON',
    href: () => `${bevelUrls.api()}/health`,
    body: 'Postgres counts, realtime status, and process liveness for monitors.',
    icon: Server,
  },
  {
    title: 'API keys',
    href: () => '/console/api-keys',
    body: 'Issue scoped tokens for scripts and CI against the BEVEL control plane.',
    icon: KeyRound,
    internal: true,
  },
]

const SAMPLES = [
  {
    title: 'List tenants',
    lang: 'bash',
    code: `curl -sS https://api.bevel.is/api/v1/tenants | jq .`,
  },
  {
    title: 'Post channel message (internal key)',
    lang: 'bash',
    code: `curl -sS -X POST \\
  'https://api.bevel.is/api/v1/fleet/channels/general/messages?tenant=2x4m' \\
  -H "Content-Type: application/json" \\
  -H "X-Fleet-Internal-Key: $FLEET_INTERNAL_API_KEY" \\
  -d '{"body":"hello from API","speakerId":"human:you","speakerName":"You","speakerType":"human"}'`,
  },
  {
    title: 'GraphQL health-ish tenants',
    lang: 'graphql',
    code: `query {
  tenants { slug name plan }
}`,
  },
]

export default function ConsoleDocsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 pb-12">
      <div className="border-b border-border pb-6">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <BookOpen className="h-8 w-8 text-accent" />
          API documentation
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Code against BEVEL with FastAPI REST and GraphQL. Product data is PostgreSQL-only —
          no file or in-memory stores for tenants, channels, or messages.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {LINKS.map((link) => (
          <a
            key={link.title}
            href={link.href()}
            target={link.internal ? undefined : '_blank'}
            rel={link.internal ? undefined : 'noreferrer'}
            className="rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/40 hover:bg-surface-raised"
          >
            <link.icon className="h-6 w-6 text-accent" />
            <h2 className="mt-3 flex items-center gap-2 text-lg font-semibold">
              {link.title}
              {!link.internal ? <ExternalLink className="h-3.5 w-3.5 text-muted" /> : null}
            </h2>
            <p className="mt-1 text-sm text-muted">{link.body}</p>
          </a>
        ))}
      </div>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Quick samples</h2>
        {SAMPLES.map((s) => (
          <div key={s.title} className="overflow-hidden rounded-2xl border border-border">
            <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2">
              <span className="text-sm font-semibold">{s.title}</span>
              <span className="font-mono text-[10px] uppercase text-muted">{s.lang}</span>
            </div>
            <pre className="overflow-x-auto bg-background p-4 text-xs leading-relaxed text-foreground">
              <code>{s.code}</code>
            </pre>
          </div>
        ))}
      </section>
    </div>
  )
}
