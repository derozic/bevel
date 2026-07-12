/**
 * In-tab inverted index of messages the user has already loaded.
 * Zero network cost, sub-ms search for the open room + recently visited rooms.
 * Complements realtime disk index via /api/search (full history).
 */

export type LocalSearchDoc = {
  key: string
  messageId: string
  sessionId: string
  kind: 'channel' | 'session'
  channelSlug?: string
  speaker: string
  body: string
  ts: number
}

export type LocalSearchHit = LocalSearchDoc & {
  score: number
  snippet: string
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
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9_@#^./+-]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP.has(t))
}

function channelHref(slug: string, messageId: string, query: string): string {
  const s = slug.replace(/^[\^#]+/, '').toLowerCase()
  return `/^${s}?msg=${encodeURIComponent(messageId)}&q=${encodeURIComponent(query)}`
}

function sessionHref(sessionId: string, messageId: string, query: string): string {
  return `/session/${encodeURIComponent(sessionId)}?msg=${encodeURIComponent(messageId)}&q=${encodeURIComponent(query)}`
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

class LocalMessageIndex {
  private docs = new Map<string, LocalSearchDoc>()
  private inv = new Map<string, Set<string>>()

  clearRoom(sessionId: string): void {
    for (const [key, doc] of this.docs) {
      if (doc.sessionId === sessionId) {
        this.removeKey(key)
      }
    }
  }

  private removeKey(key: string): void {
    const doc = this.docs.get(key)
    if (!doc) return
    this.docs.delete(key)
    for (const token of tokenize(`${doc.body} ${doc.speaker}`)) {
      const set = this.inv.get(token)
      if (set) {
        set.delete(key)
        if (set.size === 0) this.inv.delete(token)
      }
    }
  }

  /** Upsert a batch (e.g. after room hydrate or new messages). */
  upsertMany(docs: LocalSearchDoc[]): void {
    for (const doc of docs) {
      if (!doc.messageId || !doc.body?.trim()) continue
      if (this.docs.has(doc.key)) this.removeKey(doc.key)
      this.docs.set(doc.key, doc)
      for (const token of tokenize(`${doc.body} ${doc.speaker}`)) {
        let set = this.inv.get(token)
        if (!set) {
          set = new Set()
          this.inv.set(token, set)
        }
        set.add(doc.key)
      }
    }
  }

  search(rawQuery: string, limit = 20): LocalSearchHit[] {
    const query = rawQuery.trim()
    if (!query) return []
    const terms = tokenize(query)
    const qLower = query.toLowerCase()

    let candidates: Set<string>
    if (terms.length === 0) {
      candidates = new Set(this.docs.keys())
    } else {
      candidates = new Set()
      for (const term of terms) {
        for (const k of this.inv.get(term) ?? []) candidates.add(k)
      }
    }

    const hits: LocalSearchHit[] = []
    for (const key of candidates) {
      const doc = this.docs.get(key)
      if (!doc) continue
      const lower = doc.body.toLowerCase()
      if (!lower.includes(qLower) && terms.every((t) => !lower.includes(t))) {
        // still allow speaker match
        if (!doc.speaker.toLowerCase().includes(qLower)) continue
      }
      let score = 0
      for (const term of terms) {
        if (lower.includes(term)) score += 10
        if (doc.speaker.toLowerCase().includes(term)) score += 4
      }
      if (lower.includes(qLower)) score += 15
      hits.push({
        ...doc,
        score,
        snippet: snippetAround(doc.body, terms.length ? terms : [qLower]),
        href:
          doc.kind === 'channel'
            ? channelHref(doc.channelSlug || doc.sessionId, doc.messageId, query)
            : sessionHref(doc.sessionId, doc.messageId, query),
      })
    }
    hits.sort((a, b) => b.score - a.score || b.ts - a.ts)
    return hits.slice(0, limit)
  }

  get size(): number {
    return this.docs.size
  }
}

/** Singleton per browser tab */
export const localMessageIndex =
  typeof globalThis !== 'undefined'
    ? ((globalThis as unknown as { __bevelLocalMsgIndex?: LocalMessageIndex })
        .__bevelLocalMsgIndex ??= new LocalMessageIndex())
    : new LocalMessageIndex()
