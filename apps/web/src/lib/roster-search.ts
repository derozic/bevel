/**
 * Roster search — bios, tags, roles, and folksonomy so you can start
 * a thread with "product" or "legal" (or both).
 */
import type { Agent } from './agent-catalog'
import type { WorkspacePerson } from './workspace-directory'

export function tokenizeRosterQuery(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.toLowerCase().split(/[\s,+/|]+/)) {
    const t = part.replace(/^[@^~#]+/, '').trim()
    if (t.length < 2 || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

function blob(parts: Array<string | string[] | undefined | null>): string {
  return parts
    .flatMap((p) => (Array.isArray(p) ? p : p ? [p] : []))
    .join(' ')
    .toLowerCase()
}

export function agentSearchBlob(
  agent: Agent,
  extraTags: string[] = [],
): string {
  return blob([
    agent.id,
    agent.name,
    agent.role,
    agent.tagline,
    agent.bio,
    agent.summary,
    agent.category,
    agent.industry,
    agent.skills,
    extraTags,
  ])
}

export function personSearchBlob(
  person: WorkspacePerson,
  extraTags: string[] = [],
): string {
  return blob([
    person.id,
    person.name,
    person.handle,
    person.role,
    person.bio,
    person.email,
    person.tags,
    extraTags,
  ])
}

export function rosterMatches(
  haystack: string,
  tokens: string[],
): boolean {
  if (tokens.length === 0) return true
  return tokens.some((t) => haystack.includes(t))
}

export function matchLabel(
  haystack: string,
  tokens: string[],
): string | null {
  const hit = tokens.find((t) => haystack.includes(t))
  return hit ?? null
}

export function filterAgents(
  agents: Agent[],
  query: string,
  extraTagsById: Record<string, string[]> = {},
): Agent[] {
  const tokens = tokenizeRosterQuery(query)
  return agents.filter((a) =>
    rosterMatches(agentSearchBlob(a, extraTagsById[a.id] ?? []), tokens),
  )
}

export function filterPeople(
  people: WorkspacePerson[],
  query: string,
  extraTagsById: Record<string, string[]> = {},
): WorkspacePerson[] {
  const tokens = tokenizeRosterQuery(query)
  return people.filter((p) =>
    rosterMatches(
      personSearchBlob(p, extraTagsById[p.id] ?? extraTagsById[p.handle] ?? []),
      tokens,
    ),
  )
}
