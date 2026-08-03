import type { FleetAgent } from '../types'

export type MentionMatch = {
  /** Lowercase agent id */
  id: string
  /** Character index of the @ in the full text */
  start: number
  end: number
}

export type MentionDraft = {
  /** Soft @ mention or hard ^ escalation */
  kind: 'mention' | 'escalation'
  /** Query after the trailing @ or ^ (may be empty) */
  query: string
  /** Absolute start index of the @ or ^ that is being typed */
  start: number
  /** Cursor end (usually caret) */
  end: number
}

export type PersonCandidate = {
  handle: string
  name?: string
  imageUrl?: string | null
}

export type MentionCandidate =
  | { type: 'agent'; agent: FleetAgent }
  | { type: 'person'; person: PersonCandidate; escalate: boolean }

/**
 * Fully resolved @agent tokens in text (word boundary after id).
 */
export function parseResolvedMentions(
  text: string,
  catalog: Pick<FleetAgent, 'id' | 'name'>[],
): MentionMatch[] {
  const ids = new Set(catalog.map((a) => a.id.toLowerCase()))
  const names = new Map(
    catalog.map((a) => [a.name.toLowerCase(), a.id.toLowerCase()] as const),
  )
  const found: MentionMatch[] = []
  for (const m of text.matchAll(/@([a-z0-9_-]+)\b/gi)) {
    const raw = m[1]!.toLowerCase()
    const id = ids.has(raw) ? raw : names.get(raw)
    if (!id || m.index == null) continue
    found.push({ id, start: m.index, end: m.index + m[0].length })
  }
  return found
}

export function mentionedAgentIds(
  text: string,
  catalog: Pick<FleetAgent, 'id' | 'name'>[],
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of parseResolvedMentions(text, catalog)) {
    if (seen.has(m.id)) continue
    seen.add(m.id)
    out.push(m.id)
  }
  return out
}

/**
 * Active @ or ^ draft under the caret — used for autocomplete.
 * Returns null when caret is not inside an incomplete token.
 */
export function mentionDraftAt(
  text: string,
  caret: number,
): MentionDraft | null {
  if (caret < 0 || caret > text.length) return null
  const before = text.slice(0, caret)
  // Prefer the closest trailing token
  const esc = before.match(/\^([a-z0-9_-]*)$/i)
  if (esc && esc.index != null) {
    if (esc.index > 0) {
      const prev = before[esc.index - 1]
      if (prev && /[a-z0-9_]/i.test(prev)) {
        /* fall through to @ check */
      } else {
        return {
          kind: 'escalation',
          query: esc[1] ?? '',
          start: esc.index,
          end: caret,
        }
      }
    } else {
      return {
        kind: 'escalation',
        query: esc[1] ?? '',
        start: esc.index,
        end: caret,
      }
    }
  }
  const m = before.match(/@([a-z0-9_-]*)$/i)
  if (!m || m.index == null) return null
  // If previous char is wordish without @, skip (email mid-token etc.)
  if (m.index > 0) {
    const prev = before[m.index - 1]
    if (prev && /[a-z0-9_]/i.test(prev)) return null
  }
  return {
    kind: 'mention',
    query: m[1] ?? '',
    start: m.index,
    end: caret,
  }
}

export function filterMentionCandidates(
  catalog: FleetAgent[],
  query: string,
): FleetAgent[] {
  const q = query.trim().toLowerCase()
  if (!q) return catalog.slice(0, 8)
  return catalog
    .filter(
      (a) =>
        a.id.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.category?.toLowerCase().includes(q),
    )
    .slice(0, 8)
}

export function filterPersonCandidates(
  people: PersonCandidate[],
  query: string,
): PersonCandidate[] {
  const q = query.trim().toLowerCase()
  if (!q) return people.slice(0, 8)
  return people
    .filter(
      (p) =>
        p.handle.toLowerCase().includes(q) ||
        (p.name ?? '').toLowerCase().includes(q),
    )
    .slice(0, 8)
}

/**
 * Merge people + agents for autocomplete.
 * - @ draft: people first, then agents
 * - ^ draft: people only (escalation)
 */
export function filterMixedMentionCandidates(
  kind: 'mention' | 'escalation',
  catalog: FleetAgent[],
  people: PersonCandidate[],
  query: string,
): MentionCandidate[] {
  const persons = filterPersonCandidates(people, query).map(
    (person): MentionCandidate => ({
      type: 'person',
      person,
      escalate: kind === 'escalation',
    }),
  )
  if (kind === 'escalation') return persons.slice(0, 8)
  const agents = filterMentionCandidates(catalog, query).map(
    (agent): MentionCandidate => ({ type: 'agent', agent }),
  )
  return [...persons, ...agents].slice(0, 10)
}

/** Insert a completed @mention or ^escalation, replacing the draft range. */
export function applyMention(
  text: string,
  draft: MentionDraft,
  token: string,
  kind: 'mention' | 'escalation' = draft.kind,
): { text: string; caret: number } {
  const prefix = kind === 'escalation' ? '^' : '@'
  const insert = `${prefix}${token.replace(/^[@^]/, '')} `
  const next = text.slice(0, draft.start) + insert + text.slice(draft.end)
  return { text: next, caret: draft.start + insert.length }
}

/**
 * Composer highlight segments — resolved tokens become chip spans (Slack/iMessage feel).
 * Unresolved @words stay plain text until autocomplete accepts a catalog match.
 */
export type ComposerHighlightSegment =
  | { kind: 'text'; value: string }
  | { kind: 'agent'; value: string; id: string }
  | { kind: 'person'; value: string; handle: string }
  | { kind: 'escalation'; value: string; handle: string }

export function highlightComposerText(
  text: string,
  catalog: Pick<FleetAgent, 'id' | 'name'>[],
  peopleHandles: Iterable<string> = [],
): ComposerHighlightSegment[] {
  if (!text) return [{ kind: 'text', value: '' }]

  const agentIds = new Set(catalog.map((a) => a.id.toLowerCase()))
  const agentNames = new Map(
    catalog.map((a) => [a.name.toLowerCase(), a.id.toLowerCase()] as const),
  )
  const people = new Set(
    [...peopleHandles].map((h) => h.replace(/^[@^]/, '').toLowerCase()),
  )

  const segments: ComposerHighlightSegment[] = []
  let cursor = 0
  const re = /([@^])([a-zA-Z0-9_-]+)\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const start = m.index
    if (start > cursor) {
      segments.push({ kind: 'text', value: text.slice(cursor, start) })
    }
    const sigil = m[1]!
    const raw = m[2]!
    const token = m[0]!
    const lower = raw.toLowerCase()
    if (sigil === '^') {
      segments.push({ kind: 'escalation', value: token, handle: lower })
    } else {
      const agentId = agentIds.has(lower) ? lower : agentNames.get(lower)
      if (agentId) {
        segments.push({ kind: 'agent', value: token, id: agentId })
      } else if (people.has(lower)) {
        segments.push({ kind: 'person', value: token, handle: lower })
      } else {
        segments.push({ kind: 'text', value: token })
      }
    }
    cursor = start + token.length
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', value: text.slice(cursor) })
  }
  if (segments.length === 0) segments.push({ kind: 'text', value: text })
  return segments
}
