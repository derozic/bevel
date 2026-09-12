'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ChevronRightIcon,
  PencilSquareIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { Button } from '@bevel/ui'
import { FleetAvatar } from '@/components/avatars/FleetAvatar'
import type { Agent } from '@/lib/agent-catalog'
import type { AgentDoc, AgentDossier as Dossier } from '@/lib/agent-files'
import {
  linkifyNestedSkills,
  markdownToHtml,
} from '@/lib/agent-markdown'
import {
  bevelAgentProfilePath,
  bevelAgentSkillPath,
  bevelAgentSoulPath,
  bevelTalkPath,
} from '@/lib/bevel'
import { cn } from '@/lib/utils'

function hrefForDoc(agentId: string, path: string): string {
  if (path === 'SOUL.md') return bevelAgentSoulPath(agentId)
  if (path === 'SKILL.md') return bevelAgentSkillPath(agentId)
  const nested = path
    .replace(/^skills\//, '')
    .replace(/\.md$/i, '')
  return bevelAgentSkillPath(agentId, nested)
}

function treeLabel(path: string): string {
  if (path === 'SOUL.md') return 'Backstory'
  if (path === 'SKILL.md') return 'Skill'
  return path.replace(/\.md$/i, '')
}

export function AgentDossier({
  agent,
  dossier,
  canEdit,
  initialPath,
}: {
  agent: Agent
  dossier: Dossier
  canEdit: boolean
  initialPath?: string
}) {
  const files = dossier.files
  const defaultPath =
    initialPath && files.some((f) => f.path === initialPath)
      ? initialPath
      : dossier.soul?.path || dossier.skill?.path || files[0]?.path
  const [activePath, setActivePath] = useState(defaultPath ?? 'SOUL.md')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [local, setLocal] = useState<Record<string, string>>({})

  const active = useMemo(() => {
    const file = files.find((f) => f.path === activePath)
    if (!file) return null
    const content = local[file.path] ?? file.content
    return { ...file, content }
  }, [files, activePath, local])

  const knownSkills = files
    .filter((f) => f.kind === 'nested' || f.path === 'SKILL.md')
    .map((f) => f.path)

  const html = useMemo(() => {
    if (!active) return ''
    return linkifyNestedSkills(
      markdownToHtml(active.content),
      agent.id,
      knownSkills,
    )
  }, [active, agent.id, knownSkills])

  function openDoc(doc: AgentDoc) {
    setActivePath(doc.path)
    setEditing(false)
    setError(null)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', hrefForDoc(agent.id, doc.path))
    }
  }

  async function save() {
    if (!active || !canEdit) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/agents/${encodeURIComponent(agent.id)}/docs`,
        {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: active.path, content: draft }),
        },
      )
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(data.error || `Save failed (${res.status})`)
      }
      setLocal((prev) => ({ ...prev, [active.path]: draft }))
      setEditing(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const soulBits = (agent.soulMd || agent.bio || '').trim()

  return (
    <div className="agent-dossier">
      <header className="agent-dossier-hero">
        <FleetAvatar
          agentId={agent.id}
          name={agent.name}
          accent={agent.accent}
          size={72}
        />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            {agent.tier || 'agent'} · {agent.category}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            {agent.name}
          </h1>
          <p className="text-sm text-muted">{agent.role}</p>
          {soulBits ? (
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">
              {soulBits}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={bevelTalkPath(agent.id)}>Talk to {agent.name}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href={bevelAgentProfilePath(agent.id)}>Profile</Link>
            </Button>
          </div>
        </div>
      </header>

      {agent.skills.length > 0 ? (
        <ul className="agent-dossier-caps">
          {agent.skills.slice(0, 10).map((skill) => (
            <li key={skill}>{skill}</li>
          ))}
        </ul>
      ) : null}

      <div className="agent-dossier-grid">
        <nav className="agent-dossier-tree" aria-label="Agent files">
          <p className="agent-dossier-tree-label">Files</p>
          {files.length === 0 ? (
            <p className="text-xs text-muted">
              No SOUL.md or SKILL.md synced yet.
            </p>
          ) : (
            <ul>
              {files.map((file) => {
                const nested = file.path.includes('/')
                return (
                  <li key={file.path}>
                    <button
                      type="button"
                      className={cn(
                        'agent-dossier-tree-item',
                        nested && 'agent-dossier-tree-item--nested',
                      )}
                      data-active={file.path === activePath ? 'true' : 'false'}
                      onClick={() => openDoc(file)}
                    >
                      <ChevronRightIcon
                        className="h-3 w-3 shrink-0 opacity-50"
                        aria-hidden
                      />
                      <span className="truncate">{treeLabel(file.path)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </nav>

        <section className="agent-dossier-doc">
          {active ? (
            <>
              <div className="agent-dossier-doc-bar">
                <p className="font-mono text-[11px] text-muted">{active.path}</p>
                {canEdit ? (
                  editing ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => void save()}
                        disabled={saving}
                      >
                        {saving ? 'Saving…' : 'Save'}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditing(false)
                          setError(null)
                        }}
                      >
                        <XMarkIcon className="h-4 w-4" aria-hidden />
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setDraft(active.content)
                        setEditing(true)
                        setError(null)
                      }}
                    >
                      <PencilSquareIcon className="h-4 w-4" aria-hidden />
                      Edit
                    </Button>
                  )
                ) : null}
              </div>
              {error ? (
                <p className="px-4 py-2 text-sm text-red-600">{error}</p>
              ) : null}
              {editing ? (
                <textarea
                  className="agent-dossier-editor"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  spellCheck={false}
                  aria-label={`Edit ${active.path}`}
                />
              ) : (
                <div
                  className="agent-doc-prose"
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              )}
            </>
          ) : (
            <p className="p-6 text-sm text-muted">
              This agent does not have a dossier yet.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
