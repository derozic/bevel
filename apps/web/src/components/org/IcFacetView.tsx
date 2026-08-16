'use client'

import type { ReactNode } from 'react'
import { FunnelIcon } from '@heroicons/react/24/outline'
import {
  emptyIcFacets,
  filterIcs,
  icFacetOptions,
  type IcFacets,
  type IcRecord,
} from '@/lib/org-graph'
import { AgentAvatar, StatusDot } from './AgentAvatar'

type GroupBy = 'pod' | 'category'

function FacetChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
        active
          ? 'border-accent bg-accent/10 text-foreground'
          : 'border-border text-muted hover:border-accent/40'
      }`}
    >
      {children}
    </button>
  )
}

function FacetRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-16 shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </span>
      {children}
    </div>
  )
}

function groupIcs(ics: IcRecord[], by: GroupBy) {
  const groups = new Map<string, { key: string; label: string; items: IcRecord[] }>()
  for (const ic of ics) {
    const key =
      by === 'pod' ? (ic.manager?.id ?? 'unassigned') : ic.node.category || 'Fleet'
    const label =
      by === 'pod' ? (ic.manager?.name ?? 'Unassigned') : ic.node.category || 'Fleet'
    const current = groups.get(key)
    if (current) current.items.push(ic)
    else groups.set(key, { key, label, items: [ic] })
  }
  return [...groups.values()].sort(
    (a, b) => b.items.length - a.items.length || a.label.localeCompare(b.label),
  )
}

function IcCard({
  ic,
  selected,
  onSelect,
}: {
  ic: IcRecord
  selected: boolean
  onSelect: (id: string) => void
}) {
  const { node, manager, legacy } = ic
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className={`flex h-full flex-col rounded-2xl border p-3 text-left transition-colors ${
        selected
          ? 'border-accent bg-accent/10'
          : 'border-border bg-background hover:border-accent/40'
      }`}
    >
      <div className="flex items-start gap-3">
        <AgentAvatar node={node} size={40} />
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <StatusDot status={node.status} />
            <span className="truncate text-sm font-semibold text-foreground">
              {node.name}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-muted">
            {node.role}
          </span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {manager ? (
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
            {manager.name} pod
          </span>
        ) : null}
        {node.category ? (
          <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
            {node.category}
          </span>
        ) : null}
        {legacy ? (
          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-muted">
            Legacy
          </span>
        ) : null}
      </div>
      {node.deployments > 0 ? (
        <p className="mt-auto pt-3 text-[11px] tabular-nums text-muted">
          {node.deployments.toLocaleString()} deploys
        </p>
      ) : (
        <p className="mt-auto pt-3 text-[11px] text-muted">No deploys yet</p>
      )}
    </button>
  )
}

export function IcFacetView({
  ics,
  selectedId,
  onSelect,
  facets,
  onFacets,
}: {
  ics: IcRecord[]
  selectedId: string
  onSelect: (id: string) => void
  facets: IcFacets
  onFacets: (next: IcFacets) => void
}) {
  const options = icFacetOptions(ics)
  const visible = filterIcs(ics, facets)
  const groupBy: GroupBy = facets.pod !== 'all' ? 'category' : 'pod'
  const groups = groupIcs(visible, groupBy)
  const activeCount = Object.values(facets).filter((v) => v !== 'all').length

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
            Individual contributors
          </p>
          <p className="mt-1 text-sm text-muted">
            {visible.length} of {ics.length} ICs
            {activeCount > 0 ? ` · ${activeCount} filter${activeCount === 1 ? '' : 's'}` : ''}
          </p>
        </div>
        {activeCount > 0 ? (
          <button
            type="button"
            onClick={() => onFacets(emptyIcFacets)}
            className="text-xs font-medium text-muted hover:text-foreground"
          >
            Clear filters
          </button>
        ) : null}
      </div>

      <div className="space-y-2.5 rounded-2xl border border-border bg-background/60 p-3">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
          <FunnelIcon className="h-3.5 w-3.5" />
          Facets
        </p>
        <FacetRow label="Pod">
          <FacetChip
            active={facets.pod === 'all'}
            onClick={() => onFacets({ ...facets, pod: 'all' })}
          >
            All {ics.length}
          </FacetChip>
          {options.pods.map((pod) => (
            <FacetChip
              key={pod.id}
              active={facets.pod === pod.id}
              onClick={() =>
                onFacets({
                  ...facets,
                  pod: facets.pod === pod.id ? 'all' : pod.id,
                })
              }
            >
              {pod.name} {pod.count}
            </FacetChip>
          ))}
        </FacetRow>
        <FacetRow label="Practice">
          <FacetChip
            active={facets.category === 'all'}
            onClick={() => onFacets({ ...facets, category: 'all' })}
          >
            All
          </FacetChip>
          {options.categories.map((category) => (
            <FacetChip
              key={category.name}
              active={facets.category === category.name}
              onClick={() =>
                onFacets({
                  ...facets,
                  category:
                    facets.category === category.name ? 'all' : category.name,
                })
              }
            >
              {category.name} {category.count}
            </FacetChip>
          ))}
        </FacetRow>
        <FacetRow label="Status">
          <FacetChip
            active={facets.status === 'all'}
            onClick={() => onFacets({ ...facets, status: 'all' })}
          >
            All
          </FacetChip>
          {options.statuses.map((status) => (
            <FacetChip
              key={status.id}
              active={facets.status === status.id}
              onClick={() =>
                onFacets({
                  ...facets,
                  status: facets.status === status.id ? 'all' : status.id,
                })
              }
            >
              {status.id} {status.count}
            </FacetChip>
          ))}
        </FacetRow>
        {options.kinds.length > 1 ? (
          <FacetRow label="Kind">
            <FacetChip
              active={facets.kind === 'all'}
              onClick={() => onFacets({ ...facets, kind: 'all' })}
            >
              All
            </FacetChip>
            {options.kinds.map((kind) => (
              <FacetChip
                key={kind.id}
                active={facets.kind === kind.id}
                onClick={() =>
                  onFacets({
                    ...facets,
                    kind: facets.kind === kind.id ? 'all' : kind.id,
                  })
                }
              >
                {kind.id} {kind.count}
              </FacetChip>
            ))}
          </FacetRow>
        ) : null}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted">
          No ICs match these filters.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key}>
              <div className="mb-2 flex items-baseline justify-between">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                  {group.label}
                </h3>
                <span className="text-[11px] tabular-nums text-muted">
                  {group.items.length}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {group.items.map((ic) => (
                  <IcCard
                    key={ic.node.id}
                    ic={ic}
                    selected={selectedId === ic.node.id}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
