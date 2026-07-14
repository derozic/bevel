/**
 * Hyper-fast in-process conversation search index.
 *
 * Bookmark-style hits: every result is a concrete message with a deep-link target
 * so the client can open the room and scroll to the exact line with a highlight.
 *
 * Backed by inverted token → doc maps (no SQLite). Rebuilt from JSONL archives
 * on boot and updated live via recordEvent().
 */

import type { SessionEvent } from './recording.js'
import { listRecordings, readRecording } from './recording.js'

export type ConversationKind = 'channel' | 'session'

export type SearchDocument = {
  /** Stable key: `${sessionId}::${messageId}` */
  key: string
  messageId: string
  sessionId: string
  kind: ConversationKind
  channelSlug?: string
  speaker: string
  speakerType: string
  agentId?: string
  body: string
  ts: number
}

export type SearchHit = SearchDocument & {
  score: number
  /** Short body excerpt with match context */
  snippet: string
  /** Path relative to the tenant app origin */
  href: string
}

const STOP = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'to',
  'of',
  'in',
  'on',
  'for',
  'is',
  'it',
  'at',
  'as',
  'be',
  'by',
  'with',
  'this',
  'that',
  'from',
  'are',
  'was',
  'were',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_@#^./+-]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t))
}

function kindFromSessionId(sessionId: string): ConversationKind {
  if (sessionId.startsWith('dm-') || sessionId.startsWith('session-')) {
    return 'session'
  }
  // Channel rooms record with sessionId = channel slug
  if (/^[a-z0-9][a-z0-9-]*$/.test(sessionId)) return 'channel'
  return 'session'
}

function hrefFor(doc: SearchDocument, query: string): string {
  const q = encodeURIComponent(query)
  const msg = encodeURIComponent(doc.messageId)
  if (doc.kind === 'channel') {
    const slug = (doc.channelSlug ?? doc.sessionId)
      .toLowerCase()
      .replace(/^[\^#]+/, '')
    // Public short path: /^general?msg=&q= (middleware rewrites to /bevel/*)
    return `/^${encodeURIComponent(slug)}?msg=${msg}&q=${q}`
  }
  return `/session/${encodeURIComponent(doc.sessionId)}?msg=${msg}&q=${q}`
}

function snippetAround(body: string, terms: string[], max = 140): string {
  const lower = body.toLowerCase()
  let best = 0
  for (const t of terms) {
    const i = lower.indexOf(t)
    if (i >= 0) {
      best = i
      break
    }
  }
  const start = Math.max(0, best - 40)
  const end = Math.min(body.length, start + max)
  let snip = body.slice(start, end).replace(/\s+/g, ' ').trim()
  if (start > 0) snip = `…${snip}`
  if (end < body.length) snip = `${snip}…`
  return snip
}

function messageIdFromEvent(event: SessionEvent, index: number): string {
  const metaId = event.meta?.messageId
  if (typeof metaId === 'string' && metaId.length > 0) return metaId
  // Stable synthetic id for archive lines without explicit message ids
  return `evt-${event.sessionId}-${event.ts}-${index}`
}

class ConversationSearchIndex {
  private docs = new Map<string, SearchDocument>()
  /** token → set of doc keys */
  private inv = new Map<string, Set<string>>()
  private ready = false

  get size(): number {
    return this.docs.size
  }

  isReady(): boolean {
    return this.ready
  }

  clear(): void {
    this.docs.clear()
    this.inv.clear()
    this.ready = false
  }

  indexDocument(doc: SearchDocument): void {
    // Re-index: remove prior posting
    const existing = this.docs.get(doc.key)
    if (existing) this.unindexKey(doc.key)

    this.docs.set(doc.key, doc)
    const tokens = new Set([
      ...tokenize(doc.body),
      ...tokenize(doc.speaker),
      ...(doc.agentId ? tokenize(doc.agentId) : []),
      ...(doc.channelSlug ? tokenize(doc.channelSlug) : []),
    ])
    for (const token of tokens) {
      let set = this.inv.get(token)
      if (!set) {
        set = new Set()
        this.inv.set(token, set)
      }
      set.add(doc.key)
      // Prefix index for typeahead (bounded)
      if (token.length >= 3) {
        for (let i = 3; i < token.length; i++) {
          const prefix = token.slice(0, i)
          let pset = this.inv.get(`p:${prefix}`)
          if (!pset) {
            pset = new Set()
            this.inv.set(`p:${prefix}`, pset)
          }
          pset.add(doc.key)
        }
      }
    }
  }

  private unindexKey(key: string): void {
    const doc = this.docs.get(key)
    if (!doc) return
    this.docs.delete(key)
    for (const [token, set] of this.inv) {
      if (set.delete(key) && set.size === 0) this.inv.delete(token)
    }
  }

  indexEvent(event: SessionEvent, lineIndex = 0): void {
    if (event.type !== 'message' && event.type !== 'agent_reply') return
    if (!event.body?.trim()) return
    if (event.speakerType === 'system') return

    const messageId = messageIdFromEvent(event, lineIndex)
    const kind = kindFromSessionId(event.sessionId)
    this.indexDocument({
      key: `${event.sessionId}::${messageId}`,
      messageId,
      sessionId: event.sessionId,
      kind,
      channelSlug: kind === 'channel' ? event.sessionId : undefined,
      speaker: event.speaker,
      speakerType: event.speakerType,
      agentId: event.agentId,
      body: event.body,
      ts: event.ts,
    })
  }

  rebuildFromDisk(): { documents: number; sessions: number } {
    this.clear()
    const sessions = listRecordings()
    for (const sessionId of sessions) {
      const events = readRecording(sessionId)
      events.forEach((event, i) => this.indexEvent(event, i))
    }
    this.ready = true
    return { documents: this.docs.size, sessions: sessions.length }
  }

  markReady(): void {
    this.ready = true
  }

  search(rawQuery: string, opts: { limit?: number } = {}): SearchHit[] {
    const limit = opts.limit ?? 25
    const query = rawQuery.trim()
    if (!query || query.length < 1) return []

    const terms = tokenize(query)
    if (terms.length === 0) {
      // Fallback: treat whole query as one token-ish substring scan (rare)
      return this.substringScan(query.toLowerCase(), limit)
    }

    // Intersect postings for multi-term AND; fall back to union ranked if empty
    let candidate: Set<string> | null = null
    for (const term of terms) {
      const exact = this.inv.get(term) ?? new Set<string>()
      const prefix = this.inv.get(`p:${term}`) ?? new Set<string>()
      const union = new Set<string>([...exact, ...prefix])
      if (candidate === null) candidate = union
      else {
        const next = new Set<string>()
        for (const k of candidate) if (union.has(k)) next.add(k)
        candidate = next
      }
    }

    if (!candidate || candidate.size === 0) {
      // Soft: OR across terms
      candidate = new Set()
      for (const term of terms) {
        for (const k of this.inv.get(term) ?? []) candidate.add(k)
        for (const k of this.inv.get(`p:${term}`) ?? []) candidate.add(k)
      }
    }

    if (candidate.size === 0) {
      return this.substringScan(query.toLowerCase(), limit)
    }

    const now = Date.now()
    const hits: SearchHit[] = []
    for (const key of candidate) {
      const doc = this.docs.get(key)
      if (!doc) continue
      const lower = doc.body.toLowerCase()
      let score = 0
      for (const term of terms) {
        if (lower.includes(term)) score += 10
        if (doc.speaker.toLowerCase().includes(term)) score += 4
        if (doc.channelSlug?.includes(term)) score += 3
        // Full-token exact
        if (tokenize(doc.body).includes(term)) score += 6
      }
      // Recency boost (half-life ~14 days)
      const ageDays = Math.max(0, (now - doc.ts) / 86_400_000)
      score += Math.max(0, 8 - ageDays * 0.5)
      hits.push({
        ...doc,
        score,
        snippet: snippetAround(doc.body, terms),
        href: hrefFor(doc, query),
      })
    }

    hits.sort((a, b) => b.score - a.score || b.ts - a.ts)
    return hits.slice(0, limit)
  }

  private substringScan(q: string, limit: number): SearchHit[] {
    const hits: SearchHit[] = []
    for (const doc of this.docs.values()) {
      if (!doc.body.toLowerCase().includes(q)) continue
      hits.push({
        ...doc,
        score: 5,
        snippet: snippetAround(doc.body, [q]),
        href: hrefFor(doc, q),
      })
    }
    hits.sort((a, b) => b.ts - a.ts)
    return hits.slice(0, limit)
  }
}

export const conversationSearchIndex = new ConversationSearchIndex()

export function rebuildConversationSearchIndex(): {
  documents: number
  sessions: number
} {
  return conversationSearchIndex.rebuildFromDisk()
}
