/**
 * Folksonomy — freeform tags shared across agents, people, and tracks.
 * Tags are lowercase slugs; the vocabulary exists because people used it.
 */
import { z } from 'zod'

export const FOLK_ENTITY_KINDS = ['agent', 'person', 'track'] as const
export type FolkEntityKind = (typeof FOLK_ENTITY_KINDS)[number]

export const FOLK_TAG_MAX = 32
export const FOLK_TAG_MIN = 2

const TAG_CLEAN = /[^a-z0-9]+/g

/** Normalize a folksonomy tag: `TypeScript` → `typescript`, `on call` → `on-call`. */
export function normalizeFolkTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(TAG_CLEAN, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, FOLK_TAG_MAX)
}

export function isFolkEntityKind(raw: string): raw is FolkEntityKind {
  return (FOLK_ENTITY_KINDS as readonly string[]).includes(raw)
}

export function parseFolkTags(raw: unknown): string[] {
  const list = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[,;\s]+/)
      : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of list) {
    const slug = normalizeFolkTag(String(item ?? ''))
    if (slug.length < FOLK_TAG_MIN || seen.has(slug)) continue
    seen.add(slug)
    out.push(slug)
  }
  return out
}

export const FolkTaggingSchema = z.object({
  slug: z.string().min(FOLK_TAG_MIN).max(FOLK_TAG_MAX),
  kind: z.enum(FOLK_ENTITY_KINDS),
  id: z.string().min(1).max(128),
})

export type FolkTagging = z.infer<typeof FolkTaggingSchema>

export function folkTagPath(slug: string): string {
  const clean = normalizeFolkTag(slug)
  return `/tags/${encodeURIComponent(clean || 'tag')}`
}

export function folkEntityHref(kind: FolkEntityKind, id: string): string {
  const key = id.trim()
  if (kind === 'agent') return `/talk/${encodeURIComponent(key.toLowerCase())}`
  if (kind === 'track') return `/~${encodeURIComponent(key.toLowerCase())}`
  return `/u/${encodeURIComponent(key.replace(/^[@^]+/, ''))}`
}
