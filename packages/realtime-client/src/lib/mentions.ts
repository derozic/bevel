import type { FleetAgent } from '../types'

export type MentionMatch = {
  /** Lowercase agent id */
  id: string
  /** Character index of the @ in the full text */
  start: number
  end: number
}

export type MentionDraft = {
  /** Query after the trailing @ (may be empty) */
  query: string
  /** Absolute start index of the @ that is being typed */
  start: number
  /** Cursor end (usually caret) */
  end: number
}

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
 * Active @ draft under the caret — used for autocomplete.
 * Returns null when caret is not inside an incomplete @token.
 */
export function mentionDraftAt(
  text: string,
  caret: number,
): MentionDraft | null {
  if (caret < 0 || caret > text.length) return null
  const before = text.slice(0, caret)
  const m = before.match(/@([a-z0-9_-]*)$/i)
  if (!m || m.index == null) return null
  // If previous char is wordish without @, skip (email mid-token etc.)
  if (m.index > 0) {
    const prev = before[m.index - 1]
    if (prev && /[a-z0-9_]/i.test(prev)) return null
  }
  return {
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

/** Insert a completed @mention, replacing the draft range. */
export function applyMention(
  text: string,
  draft: MentionDraft,
  agentId: string,
): { text: string; caret: number } {
  const insert = `@${agentId} `
  const next = text.slice(0, draft.start) + insert + text.slice(draft.end)
  return { text: next, caret: draft.start + insert.length }
}
