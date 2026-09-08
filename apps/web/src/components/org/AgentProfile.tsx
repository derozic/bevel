'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  agentTalkHref,
  getChildren,
  getOrgNode,
  type OrgNode,
} from '@/lib/org-graph'

const TIER_LABEL: Record<OrgNode['tier'], string> = {
  founder: 'Founder',
  'co-founder': 'Co-founder',
  director: 'Director',
  ic: 'IC',
}

function soulParts(soul: string): { headline: string; rest: string } {
  const raw = soul.trim()
  if (!raw) return { headline: '', rest: '' }
  const cut = raw.split(/\s[—–]\s/)
  if (cut.length >= 2) {
    return { headline: cut[0]!.trim(), rest: cut.slice(1).join(' — ').trim() }
  }
  const comma = raw.indexOf(',')
  if (comma > 12 && comma < 72) {
    return {
      headline: raw.slice(0, comma).trim(),
      rest: raw.slice(comma + 1).trim(),
    }
  }
  return { headline: raw, rest: '' }
}

function exampleLabel(slug: string): string {
  return slug
    .split(/[-_]/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function ProfileAvatar({ node }: { node: OrgNode }) {
  const [failed, setFailed] = useState(false)
  const initial = (node.name.trim()[0] || '?').toUpperCase()
  if (failed) {
    return (
      <span
        className="flex h-24 w-24 items-center justify-center rounded-3xl text-3xl font-bold text-white shadow-sm"
        style={{ background: node.accent }}
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
      width={96}
      height={96}
      className="h-24 w-24 rounded-3xl object-cover shadow-sm"
      style={{ boxShadow: `0 0 0 3px color-mix(in srgb, ${node.accent} 45%, transparent)` }}
      onError={() => setFailed(true)}
    />
  )
}

export function AgentProfile({ node }: { node: OrgNode }) {
  const { headline, rest } = soulParts(node.soul)
  const reports = getChildren(node.id)
  const manager = node.parentId ? getOrgNode(node.parentId) : undefined
  const tags = [
    TIER_LABEL[node.tier],
    node.category,
    node.status,
  ].filter(Boolean)
  const skills = node.skills.slice(0, 8)
  const examples = node.workflows.slice(0, 5)

  return (
    <aside className="flex h-full min-h-[28rem] flex-col rounded-2xl border border-border bg-surface p-5">
      <div className="flex flex-col items-start gap-3">
        <ProfileAvatar node={node} />
        <div>
          <h2 className="text-xl font-semibold tracking-tight">{node.name}</h2>
          <p className="text-sm text-muted">{node.role}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {headline ? (
        <blockquote className="mt-5 border-l-2 pl-3" style={{ borderColor: node.accent }}>
          <p className="text-sm font-medium leading-snug text-foreground">
            {headline}
          </p>
          {rest ? (
            <p className="mt-1 text-xs leading-relaxed text-muted">{rest}</p>
          ) : null}
        </blockquote>
      ) : node.bio ? (
        <p className="mt-5 text-sm leading-relaxed text-muted">{node.bio}</p>
      ) : null}

      {skills.length > 0 ? (
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            Skills
          </p>
          <ul className="mt-2 space-y-1.5">
            {skills.map((skill) => (
              <li
                key={skill}
                className="flex items-start gap-2 text-sm leading-snug text-foreground"
              >
                <span
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: node.accent }}
                />
                <span>{skill}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {examples.length > 0 || node.runHint ? (
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
            In practice
          </p>
          {node.runHint ? (
            <p className="mt-2 text-xs leading-relaxed text-muted">{node.runHint}</p>
          ) : null}
          {examples.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {examples.map((ex) => (
                <li
                  key={ex}
                  className="rounded-lg bg-background px-2 py-1 text-[11px] font-medium text-foreground"
                >
                  {exampleLabel(ex)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {reports.length > 0 ? (
        <p className="mt-4 text-xs text-muted">
          Directs {reports.map((r) => r.name).join(', ')}
        </p>
      ) : manager ? (
        <p className="mt-4 text-xs text-muted">Reports to {manager.name}</p>
      ) : null}

      <div className="mt-auto pt-5">
        {node.id !== 'scott' ? (
          <Link
            href={agentTalkHref(node.id)}
            className="inline-flex min-h-10 w-full items-center justify-center rounded-full bg-cta px-4 text-sm font-semibold text-cta-fg"
          >
            Talk to {node.name}
          </Link>
        ) : (
          <p className="text-xs text-muted">Talk to the fleet through Hermes.</p>
        )}
      </div>
    </aside>
  )
}
