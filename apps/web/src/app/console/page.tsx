'use client'

import Link from 'next/link'
import {
  Activity,
  BookOpen,
  Command,
  GitBranch,
  Key,
  Package,
  Settings,
  Terminal,
} from 'lucide-react'

const CARDS = [
  {
    href: '/console/settings',
    title: 'Settings',
    body: 'Profile, LLM providers, and account preferences for the BEVEL platform.',
    icon: Settings,
  },
  {
    href: '/console/integrations',
    title: 'Integrations',
    body: 'n8n, GitHub, Linear, Slack, and partner services connected to your workspace.',
    icon: Package,
  },
  {
    href: '/console/api-keys',
    title: 'API keys',
    body: 'Scoped tokens for coding against FastAPI REST and GraphQL.',
    icon: Key,
  },
  {
    href: '/console/docs',
    title: 'API docs',
    body: 'OpenAPI Swagger UI, GraphiQL, and sample requests.',
    icon: BookOpen,
  },
  {
    href: '/console/status',
    title: 'Status',
    body: 'Live probes for web, Postgres API, and realtime uptime.',
    icon: Activity,
  },
  {
    href: '/console/workflows',
    title: 'Workflows',
    body: 'Built-in fleet flows and n8n automation templates.',
    icon: GitBranch,
  },
  {
    href: '/console/commands',
    title: 'Commands',
    body: 'CLI and operator command catalog for BEVEL operations.',
    icon: Command,
  },
  {
    href: 'https://bevel.is/workspaces',
    title: 'Open workspaces',
    body: 'Platform home on bevel.is — pick a product workspace after sign-in.',
    icon: Terminal,
    external: true,
  },
]

export default function ConsoleHomePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight">BEVEL console</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Platform control plane on bevel.is — settings, integrations, API credentials, workflows,
          and status. Press{' '}
          <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px]">
            ⌘K
          </kbd>{' '}
          for the command palette.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            target={card.external ? '_blank' : undefined}
            className="group rounded-2xl border border-border bg-surface p-5 transition-colors hover:border-accent/40 hover:bg-surface-raised"
          >
            <card.icon className="h-6 w-6 text-accent transition-transform group-hover:scale-105" />
            <h2 className="mt-3 text-lg font-semibold">{card.title}</h2>
            <p className="mt-1 text-sm text-muted">{card.body}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
