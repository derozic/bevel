'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Command,
  GitBranch,
  Key,
  Users,
  MessageSquare,
  Package,
  Settings,
  Terminal,
} from 'lucide-react'
import { bevelUrls } from '@/components/console/bevel-urls'

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
    href: '/console/fleet',
    title: 'Agent fleet',
    body: 'Working hierarchy and diamond fan-out / fan-in across the Entity fleet.',
    icon: Users,
  },
  {
    href: '/console/commands',
    title: 'Commands',
    body: 'CLI and operator command catalog for BEVEL operations.',
    icon: Command,
  },
  {
    href: 'https://bevel.is/workspaces',
    title: 'All workspaces',
    body: 'Platform home on bevel.is — pick another product workspace after sign-in.',
    icon: Terminal,
    external: true,
  },
]

export default function ConsoleHomePage() {
  const chatHref = useMemo(() => bevelUrls.workspaceChat(), [])

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <div className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight">BEVEL console</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          Platform control plane — settings, integrations, API credentials, workflows, and status.
          This is not the chat workspace. Press{' '}
          <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[11px]">
            ⌘H
          </kbd>{' '}
          or use <strong className="font-medium text-foreground">Back to chat</strong> anytime to
          return to ~general.
        </p>
      </div>

      <a
        href={chatHref}
        className="flex flex-col gap-3 rounded-2xl border-2 border-accent/50 bg-accent/10 p-5 transition hover:border-accent hover:bg-accent/15 sm:flex-row sm:items-center sm:justify-between"
        data-testid="console-home-back-to-chat"
      >
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-accent/20 p-3 text-accent">
            <MessageSquare className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Back to workspace chat</h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Open ~general — fleet channels, agents, and live conversation. Leave the console
              control plane and return to the product.
            </p>
          </div>
        </div>
        <span className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white sm:self-center">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Open chat
        </span>
      </a>

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
