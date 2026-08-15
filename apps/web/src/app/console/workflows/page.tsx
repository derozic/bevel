'use client'

import { useState } from 'react'
import {
  ArrowRight,
  Clock,
  Cpu,
  ExternalLink,
  GitBranch,
  Play,
  Zap,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { WebhooksPanel } from '@/components/console/WebhooksPanel'

type Workflow = {
  id: string
  name: string
  description: string
  engine: 'n8n' | 'bevel'
  steps: string[]
  tags: string[]
}

const WORKFLOWS: Workflow[] = [
  {
    id: 'channel-mention',
    name: 'Track @mention routing',
    description:
      'When a human posts with @agent in a track, hydrate history from Postgres and dispatch the agent via realtime.',
    engine: 'bevel',
    steps: ['Message POST', 'Mention extract', 'Agent dispatch', 'Persist reply'],
    tags: ['realtime', 'postgres', 'agents'],
  },
  {
    id: 'n8n-standup',
    name: 'Daily standup (n8n)',
    description:
      'n8n cron collects GitHub + Linear activity, summarizes via LLM, posts into ^ops on BEVEL.',
    engine: 'n8n',
    steps: ['Cron 9am', 'GitHub API', 'LLM summary', 'BEVEL fleet POST'],
    tags: ['n8n', 'llm', 'ops'],
  },
  {
    id: 'n8n-deploy',
    name: 'Deploy notify (n8n)',
    description:
      'On successful GitHub Actions deploy, n8n posts a program event into the workspace track.',
    engine: 'n8n',
    steps: ['Webhook', 'Filter success', 'Format', 'program-events'],
    tags: ['ci', 'n8n'],
  },
  {
    id: 'handoff',
    name: 'Cross-host auth handoff',
    description:
      'Platform login on bevel.is issues a one-time Postgres code redeemed on bevel.2x4m.cc.',
    engine: 'bevel',
    steps: ['Google OAuth', 'Issue code', 'Redirect', 'Mint session'],
    tags: ['auth', 'postgres'],
  },
]

export default function ConsoleWorkflowsPage() {
  const [selected, setSelected] = useState(WORKFLOWS[0]!)

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      <div className="border-b border-border pb-6">
        <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
          <GitBranch className="h-8 w-8 text-accent" />
          Workflows
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Workflows start and end in tracks and conversations. Subscribe to
          New messages, Mentions, or First-time welcome — or mint an incoming
          URL so a pipeline can land in ~ops or a Hermes conversation.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <ul className="space-y-2">
          {WORKFLOWS.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                onClick={() => setSelected(w)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition-colors ${
                  selected.id === w.id
                    ? 'border-accent/40 bg-accent/10 text-foreground'
                    : 'border-border bg-surface text-muted hover:text-foreground'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{w.name}</span>
                  <span className="rounded-full bg-surface-raised px-2 py-0.5 text-[10px] font-mono uppercase">
                    {w.engine}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>

        <motion.div
          key={selected.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-surface p-6"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">{selected.name}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted">
                {selected.description}
              </p>
            </div>
            {selected.engine === 'n8n' ? (
              <a
                href="/console/integrations"
                className="inline-flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent"
              >
                <Cpu className="h-4 w-4" />
                Configure n8n
              </a>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm text-muted">
                <Zap className="h-4 w-4 text-accent" />
                Built-in
              </span>
            )}
          </div>

          <ol className="mt-8 flex flex-wrap items-center gap-2">
            {selected.steps.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold">
                  {step}
                </span>
                {i < selected.steps.length - 1 ? (
                  <ArrowRight className="h-3.5 w-3.5 text-muted" />
                ) : null}
              </li>
            ))}
          </ol>

          <div className="mt-6 flex flex-wrap gap-2">
            {selected.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] font-mono text-muted"
              >
                ^{tag}
              </span>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="https://api.bevel.is/docs"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
            >
              <Play className="h-4 w-4" />
              Open API docs
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>
            <a
              href="/console/docs"
              className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold"
            >
              <Clock className="h-4 w-4" />
              GraphQL + REST guide
            </a>
          </div>
        </motion.div>
      </div>

      <WebhooksPanel />
    </div>
  )
}
