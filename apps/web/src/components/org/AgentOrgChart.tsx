'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChartBarIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import {
  agentTalkHref,
  getChildren,
  getDiamondWorkflows,
  getOrgNode,
  getOrgNodes,
  orgDynamics,
  type DiamondWorkflow,
  type OrgNode,
} from '@/lib/org-graph'

const TIER_LABEL: Record<OrgNode['tier'], string> = {
  founder: 'Founder',
  'co-founder': 'Co-founder',
  director: 'Director',
  ic: 'IC',
}

function StatusDot({ status }: { status: OrgNode['status'] }) {
  const color =
    status === 'available'
      ? 'bg-success'
      : status === 'busy'
        ? 'bg-warning'
        : 'bg-muted'
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${color}`}
      title={status}
    />
  )
}

function AgentAvatar({
  node,
  size = 32,
}: {
  node: OrgNode
  size?: number
}) {
  const [failed, setFailed] = useState(false)
  const initial = (node.name.trim()[0] || '?').toUpperCase()
  if (failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-lg font-bold text-white"
        style={{
          width: size,
          height: size,
          background: node.accent,
          fontSize: size * 0.42,
        }}
      >
        {initial}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={node.avatarUrl}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-lg object-cover"
      style={{
        width: size,
        height: size,
        boxShadow: `inset 0 0 0 2px ${node.accent}`,
      }}
      onError={() => setFailed(true)}
    />
  )
}

function AgentChip({
  node,
  selected,
  onSelect,
  compact = false,
}: {
  node: OrgNode
  selected: boolean
  onSelect: (id: string) => void
  compact?: boolean
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className={`flex items-center gap-2 rounded-xl border text-left transition-colors ${
        compact ? 'min-w-0 px-2 py-1.5' : 'min-w-[148px] px-2.5 py-2'
      } ${
        selected
          ? 'border-accent bg-accent/10'
          : 'border-border bg-surface hover:border-accent/40'
      }`}
    >
      <AgentAvatar node={node} size={compact ? 28 : 32} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <StatusDot status={node.status} />
          <span className="truncate text-sm font-semibold text-foreground">
            {node.name}
          </span>
        </span>
        <span className="block truncate text-[11px] text-muted">
          {compact ? node.category || node.role : node.role}
        </span>
      </span>
    </button>
  )
}

function DiamondStage({
  kicker,
  title,
}: {
  kicker: string
  title: string
}) {
  return (
    <div className="mb-2 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
        {kicker}
      </p>
      <p className="text-xs text-muted">{title}</p>
    </div>
  )
}

function DiamondRails({
  direction,
  count,
}: {
  direction: 'out' | 'in'
  count: number
}) {
  const out = direction === 'out'
  return (
    <div className="relative my-1 h-10 w-full max-w-md" aria-hidden>
      <div
        className="absolute inset-0 bg-accent/10"
        style={{
          clipPath: out
            ? 'polygon(46% 0, 54% 0, 100% 100%, 0 100%)'
            : 'polygon(0 0, 100% 0, 54% 100%, 46% 100%)',
        }}
      />
      <div
        className="absolute inset-[1px] bg-surface"
        style={{
          clipPath: out
            ? 'polygon(47% 0, 53% 0, 98% 100%, 2% 100%)'
            : 'polygon(2% 0, 98% 0, 53% 100%, 47% 100%)',
        }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {out ? `fan-out ${count}` : `join ${count}`}
      </span>
    </div>
  )
}

function HierarchyView({
  selectedId,
  onSelect,
  showIcs,
}: {
  selectedId: string
  onSelect: (id: string) => void
  showIcs: boolean
}) {
  const nodes = getOrgNodes()
  const founder = nodes.find((n) => n.tier === 'founder') ?? getOrgNode('scott')
  const hermes = getOrgNode('hermes')
  if (!founder || !hermes) return null
  const directors = getChildren('hermes', nodes)

  return (
    <div className="flex flex-col items-center gap-0">
      <AgentChip
        node={founder}
        selected={selectedId === founder.id}
        onSelect={onSelect}
      />
      <div className="h-4 w-px bg-border" />
      <AgentChip
        node={hermes}
        selected={selectedId === hermes.id}
        onSelect={onSelect}
      />
      <div className="h-4 w-px bg-border" />
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
        Directors
      </p>
      <div className="flex w-full flex-wrap justify-center gap-2">
        {directors.map((director) => (
          <AgentChip
            key={director.id}
            node={director}
            selected={selectedId === director.id}
            onSelect={onSelect}
          />
        ))}
      </div>
      {showIcs &&
      directors.some((d) => getChildren(d.id, nodes).some((c) => c.tier === 'ic')) ? (
        <>
          <div className="mt-6 h-4 w-px bg-border" />
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Pods
          </p>
          <div className="flex w-full flex-wrap justify-center gap-6">
            {directors
              .map((director) => ({
                director,
                ics: getChildren(director.id, nodes).filter((c) => c.tier === 'ic'),
              }))
              .filter((col) => col.ics.length > 0)
              .map(({ director, ics }) => (
                <div
                  key={director.id}
                  className="flex max-w-[180px] flex-col items-center gap-1.5"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    {director.name}
                  </p>
                  {ics.map((ic) => (
                    <AgentChip
                      key={ic.id}
                      node={ic}
                      selected={selectedId === ic.id}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              ))}
          </div>
        </>
      ) : null}
    </div>
  )
}

function DiamondView({
  workflow,
  selectedId,
  onSelect,
}: {
  workflow: DiamondWorkflow
  selectedId: string
  onSelect: (id: string) => void
}) {
  const source = getOrgNode(workflow.sourceId)
  const sink = getOrgNode(workflow.sinkId)
  const parallels = workflow.parallelIds
    .map((id) => getOrgNode(id))
    .filter((n): n is OrgNode => Boolean(n))
  if (!source || !sink) return null

  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <div
        className="pointer-events-none absolute inset-x-[8%] inset-y-6 rounded-[2rem] bg-accent/[0.04]"
        style={{ clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' }}
        aria-hidden
      />
      <div className="relative z-10 flex flex-col items-center">
        <p className="mb-5 max-w-lg text-center text-sm text-muted">
          {workflow.description}
        </p>
        <DiamondStage kicker="Split" title={`${source.name} owns the brief`} />
        <AgentChip
          node={source}
          selected={selectedId === source.id}
          onSelect={onSelect}
        />
        <DiamondRails direction="out" count={parallels.length} />
        <DiamondStage
          kicker="Parallel"
          title={`${parallels.length} agents work the same problem at once`}
        />
        <div className="flex w-full max-w-2xl flex-wrap justify-center gap-2">
          {parallels.map((n) => (
            <div key={n.id} className="w-[calc(50%-0.25rem)] sm:w-[calc(33.333%-0.35rem)]">
              <AgentChip
                node={n}
                selected={selectedId === n.id}
                onSelect={onSelect}
                compact
              />
            </div>
          ))}
        </div>
        <DiamondRails direction="in" count={parallels.length} />
        <DiamondStage
          kicker="Join"
          title={`${sink.name} synthesizes the result`}
        />
        <AgentChip
          node={sink}
          selected={selectedId === sink.id}
          onSelect={onSelect}
        />
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-0.5 text-xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-[11px] text-muted">{hint}</p> : null}
    </div>
  )
}

export function AgentOrgChart() {
  const nodes = useMemo(() => getOrgNodes(), [])
  const diamonds = useMemo(() => getDiamondWorkflows(nodes), [nodes])
  const dynamics = useMemo(() => orgDynamics(nodes), [nodes])
  const { stats } = dynamics
  const [mode, setMode] = useState<'hierarchy' | 'diamond'>('hierarchy')
  const [showIcs, setShowIcs] = useState(false)
  const [selectedId, setSelectedId] = useState('hermes')
  const [diamondId, setDiamondId] = useState(diamonds[0]?.id ?? '')
  const selected = getOrgNode(selectedId) ?? getOrgNode('hermes')
  const activeDiamond =
    diamonds.find((d) => d.id === diamondId) ?? diamonds[0]
  const coveragePct = Math.round(dynamics.coverage * 100)
  const availablePct = stats.fleet
    ? Math.round((stats.available / stats.fleet) * 100)
    : 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <UsersIcon className="h-8 w-8 text-accent" />
            Agent org
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Working Entity fleet: hierarchy is who reports to whom. Diamond
            is how work actually moves — fan-out to parallel agents, then join.
          </p>
        </div>
        <div className="flex items-end gap-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
              Fleet size
            </p>
            <p className="text-4xl font-semibold tabular-nums leading-none tracking-tight">
              {stats.fleet}
            </p>
            <p className="mt-1 text-xs text-muted">
              {stats.byTier.director} directors · {stats.byTier.ic} ICs
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setMode('hierarchy')}
          className={`rounded-full border px-3 py-1 text-sm font-medium ${
            mode === 'hierarchy'
              ? 'border-accent bg-accent/10 text-foreground'
              : 'border-border text-muted'
          }`}
        >
          Hierarchy
        </button>
        <button
          type="button"
          onClick={() => setMode('diamond')}
          className={`rounded-full border px-3 py-1 text-sm font-medium ${
            mode === 'diamond'
              ? 'border-accent bg-accent/10 text-foreground'
              : 'border-border text-muted'
          }`}
        >
          Diamond parallel
        </button>
        <button
          type="button"
          aria-pressed={showIcs}
          onClick={() => setShowIcs((v) => !v)}
          className={`rounded-full border px-3 py-1 text-sm font-medium ${
            showIcs
              ? 'border-accent bg-accent/10 text-foreground'
              : 'border-border text-muted'
          }`}
        >
          {showIcs ? 'Hide ICs' : 'Show ICs'}
        </button>
      </div>

      {mode === 'diamond' && (
        <div className="flex flex-wrap gap-2">
          {diamonds.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => {
                setDiamondId(d.id)
                setSelectedId(d.sourceId)
              }}
              className={`rounded-lg border px-2.5 py-1 text-xs ${
                activeDiamond?.id === d.id
                  ? 'border-accent bg-accent/10'
                  : 'border-border text-muted'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_240px]">
        <aside className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
            <ChartBarIcon className="h-3.5 w-3.5" />
            Fleet KPIs
          </p>
          <Kpi label="Fleet" value={stats.fleet} hint="Agents in the working org" />
          <Kpi
            label="Available"
            value={`${availablePct}%`}
            hint={`${stats.available} ready · ${stats.busy} busy · ${stats.offline} off`}
          />
          <Kpi
            label="Directors"
            value={stats.byTier.director}
            hint={`${dynamics.staffed} staffed · ${dynamics.uncovered} solo`}
          />
          <Kpi
            label="ICs"
            value={stats.byTier.ic}
            hint={`Avg span ${dynamics.span.toFixed(1)}`}
          />
          <Kpi label="Diamonds" value={stats.diamonds} hint="Parallel fan-out joins" />
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] text-muted">
              <span>Director coverage</span>
              <span className="tabular-nums">{coveragePct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${coveragePct}%` }}
              />
            </div>
          </div>
        </aside>

        <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-6">
          {mode === 'hierarchy' ? (
            <HierarchyView
              selectedId={selectedId}
              onSelect={setSelectedId}
              showIcs={showIcs}
            />
          ) : activeDiamond ? (
            <DiamondView
              workflow={activeDiamond}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : null}
        </div>

        <aside className="space-y-4 rounded-2xl border border-border bg-surface p-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Team dynamics
            </p>
            <ul className="mt-2 space-y-2">
              {dynamics.pods.length === 0 ? (
                <li className="text-xs text-muted">No IC pods staffed yet.</li>
              ) : (
                dynamics.pods.map((pod) => (
                  <li key={pod.directorId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(pod.directorId)}
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-0.5 text-left text-sm hover:bg-background"
                    >
                      <span className="truncate font-medium">{pod.directorName}</span>
                      <span className="tabular-nums text-xs text-muted">
                        {pod.size} IC{pod.size === 1 ? '' : 's'}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
              Functions
            </p>
            <ul className="mt-2 space-y-1.5">
              {dynamics.topCategories.map((cat) => (
                <li
                  key={cat.name}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="truncate text-muted">{cat.name}</span>
                  <span className="tabular-nums font-medium">{cat.count}</span>
                </li>
              ))}
            </ul>
          </div>
          {selected ? (
            <div className="border-t border-border pt-4">
              <div className="flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={selected.avatarUrl}
                  alt=""
                  className="h-10 w-10 rounded-xl object-cover"
                />
                <div>
                  <h2 className="text-sm font-semibold">{selected.name}</h2>
                  <p className="text-xs text-muted">{selected.role}</p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wide text-muted">
                    {TIER_LABEL[selected.tier]} · {selected.status}
                  </p>
                </div>
              </div>
              {selected.bio ? (
                <p className="mt-2 line-clamp-4 text-xs leading-relaxed text-muted">
                  {selected.bio}
                </p>
              ) : null}
              {selected.id !== 'scott' ? (
                <Link
                  href={agentTalkHref(selected.id)}
                  className="mt-3 inline-flex rounded-full bg-cta px-3 py-1.5 text-xs font-semibold text-cta-fg"
                >
                  Talk to {selected.name}
                </Link>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
