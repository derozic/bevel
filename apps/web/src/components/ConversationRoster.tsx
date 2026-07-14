'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  CheckIcon,
  PlusIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { agents } from '@/lib/agent-catalog'
import { bevelTalkPath } from '@/lib/bevel'
import { WORKSPACE_PEOPLE, type WorkspacePerson } from '@/lib/workspace-directory'
import { cn } from '@/lib/utils'

/**
 * Compose a new direct conversation: multi-select agents + people (e.g. Peter),
 * then open a stable session. Agents drive the live room; people are invitees
 * (shown in the title until people rooms ship).
 */
export function ConversationRoster({
  onStarted,
  className,
}: {
  onStarted?: () => void
  className?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [agentIds, setAgentIds] = useState<string[]>([])
  const [peopleIds, setPeopleIds] = useState<string[]>([])
  const [query, setQuery] = useState('')

  const q = query.trim().toLowerCase()

  const agentHits = useMemo(
    () =>
      agents.filter(
        (a) =>
          !q ||
          a.id.includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q),
      ),
    [q],
  )

  const peopleHits = useMemo(
    () =>
      WORKSPACE_PEOPLE.filter(
        (p) =>
          !q ||
          p.id.includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.handle.toLowerCase().includes(q),
      ),
    [q],
  )

  const selectedPeople: WorkspacePerson[] = peopleIds
    .map((id) => WORKSPACE_PEOPLE.find((p) => p.id === id))
    .filter((p): p is WorkspacePerson => Boolean(p))

  const selectedAgents = agentIds
    .map((id) => agents.find((a) => a.id === id))
    .filter(Boolean)

  function toggleAgent(id: string) {
    setAgentIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function togglePerson(id: string) {
    setPeopleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  function start() {
    if (agentIds.length === 0 && peopleIds.length === 0) return

    // Agents drive the room today. People-only → still open a soft session via first agent if any.
    if (agentIds.length === 0) {
      // People-only: park as multi-agent empty session with people in query for future
      const invite = peopleIds.join(',')
      router.push(
        `/session/dm-people-${invite}?invite=${encodeURIComponent(invite)}`,
      )
      setOpen(false)
      onStarted?.()
      return
    }

    const primary = agentIds[0]!
    const rest = agentIds.slice(1)
    const agentsParam = rest.length > 0 ? rest.join(',') : undefined
    let href = bevelTalkPath(primary, agentsParam)
    if (peopleIds.length > 0) {
      const sep = href.includes('?') ? '&' : '?'
      href = `${href}${sep}invite=${encodeURIComponent(peopleIds.join(','))}`
    }
    router.push(href)
    setOpen(false)
    setAgentIds([])
    setPeopleIds([])
    setQuery('')
    onStarted?.()
  }

  const canStart = agentIds.length > 0 || peopleIds.length > 0

  return (
    <div className={cn('bevel-roster', className)}>
      <button
        type="button"
        className="bevel-rail-new-channel w-full justify-center"
        onClick={() => setOpen(true)}
      >
        <PlusIcon className="h-3.5 w-3.5" aria-hidden />
        New conversation
      </button>

      {open ? (
        <div
          className="bevel-roster-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bevel-roster-title"
        >
          <div
            className="bevel-roster-scrim"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="bevel-roster-panel">
            <header className="bevel-roster-header">
              <div>
                <p className="bevel-roster-kicker">
                  <UserGroupIcon className="h-3.5 w-3.5" aria-hidden />
                  Roster
                </p>
                <h2 id="bevel-roster-title" className="bevel-roster-title">
                  Start a conversation
                </h2>
                <p className="bevel-roster-sub">
                  Add one or more agents and people (e.g. Peter). Agents open a
                  live thread; people ride along as invitees.
                </p>
              </div>
              <button
                type="button"
                className="bevel-roster-close"
                aria-label="Close"
                onClick={() => setOpen(false)}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </header>

            {(selectedAgents.length > 0 || selectedPeople.length > 0) && (
              <div className="bevel-roster-selected">
                {selectedAgents.map((a) =>
                  a ? (
                    <button
                      key={a.id}
                      type="button"
                      className="bevel-roster-chip"
                      data-kind="agent"
                      onClick={() => toggleAgent(a.id)}
                      title="Remove"
                    >
                      {a.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.avatarUrl} alt="" />
                      ) : null}
                      {a.name}
                      <XMarkIcon className="h-3 w-3 opacity-70" aria-hidden />
                    </button>
                  ) : null,
                )}
                {selectedPeople.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="bevel-roster-chip"
                    data-kind="person"
                    onClick={() => togglePerson(p.id)}
                    title="Remove"
                  >
                    {p.name}
                    <XMarkIcon className="h-3 w-3 opacity-70" aria-hidden />
                  </button>
                ))}
              </div>
            )}

            <input
              className="bevel-roster-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search agents and people…"
              aria-label="Search roster"
            />

            <div className="bevel-roster-lists">
              <section>
                <h3 className="bevel-roster-section-label">Agents</h3>
                <ul className="bevel-roster-list">
                  {agentHits.map((a) => {
                    const on = agentIds.includes(a.id)
                    return (
                      <li key={a.id}>
                        <button
                          type="button"
                          className="bevel-roster-row"
                          data-selected={on ? 'true' : 'false'}
                          onClick={() => toggleAgent(a.id)}
                        >
                          {a.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={a.avatarUrl}
                              alt=""
                              className="bevel-roster-avatar"
                            />
                          ) : (
                            <span className="bevel-roster-avatar bevel-roster-avatar--fallback">
                              {a.name.slice(0, 1)}
                            </span>
                          )}
                          <span className="bevel-roster-row-text">
                            <span className="bevel-roster-row-name">{a.name}</span>
                            <span className="bevel-roster-row-meta">
                              @{a.id} · {a.role}
                            </span>
                          </span>
                          <span className="bevel-roster-check" aria-hidden>
                            {on ? (
                              <CheckIcon className="h-4 w-4" />
                            ) : (
                              <PlusIcon className="h-4 w-4" />
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>

              <section>
                <h3 className="bevel-roster-section-label">People</h3>
                <ul className="bevel-roster-list">
                  {peopleHits.map((p) => {
                    const on = peopleIds.includes(p.id)
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="bevel-roster-row"
                          data-selected={on ? 'true' : 'false'}
                          data-kind="person"
                          onClick={() => togglePerson(p.id)}
                        >
                          <span className="bevel-roster-avatar bevel-roster-avatar--person">
                            {p.name.slice(0, 1)}
                          </span>
                          <span className="bevel-roster-row-text">
                            <span className="bevel-roster-row-name">{p.name}</span>
                            <span className="bevel-roster-row-meta">
                              @{p.handle}
                              {p.role ? ` · ${p.role}` : ''}
                            </span>
                          </span>
                          <span className="bevel-roster-check" aria-hidden>
                            {on ? (
                              <CheckIcon className="h-4 w-4" />
                            ) : (
                              <PlusIcon className="h-4 w-4" />
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </section>
            </div>

            <footer className="bevel-roster-footer">
              <p className="bevel-roster-hint">
                {agentIds.length === 0 && peopleIds.length > 0
                  ? 'People-only threads are soft-start until people rooms ship — invite is preserved.'
                  : 'Pick at least one agent or person to continue.'}
              </p>
              <button
                type="button"
                className="bevel-roster-start"
                disabled={!canStart}
                onClick={start}
              >
                Start conversation
                {selectedAgents.length + selectedPeople.length > 0
                  ? ` (${selectedAgents.length + selectedPeople.length})`
                  : ''}
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </div>
  )
}
