'use client'

import { useMemo, useState } from 'react'
import {
  ChartBarIcon,
  UsersIcon,
} from '@heroicons/react/24/outline'
import {
  emptyIcFacets,
  filterIcs,
  getChildren,
  getDiamondWorkflows,
  getIcs,
  getOrgNode,
  getOrgNodes,
  orgDynamics,
  type DiamondWorkflow,
  type IcFacets,
  type OrgNode,
} from '@/lib/org-graph'
import { AgentAvatar, StatusDot } from './AgentAvatar'
import { AgentProfile } from './AgentProfile'
import { IcFacetView } from './IcFacetView'

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
}: {
  selectedId: string
  onSelect: (id: string) => void
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
      <div className="relative flex flex-col items-center">
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
  const ics = useMemo(() => getIcs(nodes), [nodes])
  const { stats } = dynamics
  const [mode, setMode] = useState<'hierarchy' | 'diamond' | 'ics'>('hierarchy')
  const [icFacets, setIcFacets] = useState<IcFacets>(emptyIcFacets)
  const [selectedId, setSelectedId] = useState('hermes')
  const [diamondId, setDiamondId] = useState(diamonds[0]?.id ?? '')
  const selected = getOrgNode(selectedId) ?? getOrgNode('hermes')
  const activeDiamond =
    diamonds.find((d) => d.id === diamondId) ?? diamonds[0]
  const coveragePct = Math.round(dynamics.coverage * 100)
  const availablePct = stats.fleet
    ? Math.round((stats.available / stats.fleet) * 100)
    : 0

  function openIcs(podId?: string) {
    const next: IcFacets = {
      ...emptyIcFacets,
      pod: podId ?? 'all',
    }
    setIcFacets(next)
    setMode('ics')
    const visible = filterIcs(ics, next)
    const current = getOrgNode(selectedId)
    if (current?.tier !== 'ic' && visible[0]) {
      setSelectedId(visible[0].node.id)
    } else if (
      current?.tier === 'ic' &&
      !visible.some((ic) => ic.node.id === current.id) &&
      visible[0]
    ) {
      setSelectedId(visible[0].node.id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight">
            <UsersIcon className="h-8 w-8 text-accent" />
            Agent fleet
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            The working Entity fleet. Hierarchy is who reports to whom.
            ICs are the working bench — filter by pod and practice.
            Diamond is how work moves — fan-out, then join.
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
          onClick={() => {
            if (mode !== 'ics') openIcs()
          }}
          className={`rounded-full border px-3 py-1 text-sm font-medium ${
            mode === 'ics'
              ? 'border-accent bg-accent/10 text-foreground'
              : 'border-border text-muted'
          }`}
        >
          ICs
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

      <div className="grid gap-4 xl:grid-cols-[200px_minmax(0,1fr)_300px]">
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
          <button type="button" onClick={() => openIcs()} className="text-left">
            <Kpi
              label="ICs"
              value={stats.byTier.ic}
              hint="Open the IC facet view"
            />
          </button>
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
          <div className="border-t border-border pt-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
              Staffed pods
            </p>
            <ul className="mt-2 space-y-1">
              {dynamics.pods.map((pod) => (
                <li key={pod.directorId}>
                  <button
                    type="button"
                    onClick={() => openIcs(pod.directorId)}
                    className="flex w-full items-center justify-between text-left text-xs hover:text-foreground"
                  >
                    <span className="truncate text-muted">{pod.directorName}</span>
                    <span className="tabular-nums">{pod.size}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <div className="overflow-x-auto rounded-2xl border border-border bg-surface p-6">
          {mode === 'hierarchy' ? (
            <HierarchyView
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : mode === 'ics' ? (
            <IcFacetView
              ics={ics}
              selectedId={selectedId}
              onSelect={setSelectedId}
              facets={icFacets}
              onFacets={setIcFacets}
            />
          ) : activeDiamond ? (
            <DiamondView
              workflow={activeDiamond}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          ) : null}
        </div>

        {selected ? <AgentProfile node={selected} /> : <div />}
      </div>
    </div>
  )
}
