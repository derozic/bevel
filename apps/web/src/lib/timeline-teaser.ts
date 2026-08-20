export type TimelineTeaserItem = {
  id: string
  kind?: string
  priority?: string
  actorLabel?: string | null
  bodyPreview?: string | null
  channelSlug?: string | null
  createdAt?: string | null
  unread?: boolean
  escalated?: boolean
  ackedAt?: string | null
}

function recencyMs(item: TimelineTeaserItem): number {
  if (!item.createdAt) return 0
  const t = Date.parse(item.createdAt)
  return Number.isNaN(t) ? 0 : t
}

function collapsePreview(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

/** Escalations and unread items outrank a newer-but-quieter event. */
export function timelineImportance(item: TimelineTeaserItem): number {
  const escalated = item.kind === 'escalation' || item.escalated
  const high =
    item.priority === 'high' ||
    item.priority === 'urgent' ||
    item.priority === 'critical'
  let score = 0
  if (escalated) score += 40
  if (high) score += 20
  if (item.unread) score += 30
  if (escalated && !item.ackedAt) score += 15
  return score
}

export function pickTimelineTeaser(
  items: TimelineTeaserItem[],
): TimelineTeaserItem | null {
  if (items.length === 0) return null
  return [...items].sort((a, b) => {
    const byScore = timelineImportance(b) - timelineImportance(a)
    if (byScore !== 0) return byScore
    return recencyMs(b) - recencyMs(a)
  })[0]!
}

export function formatTimelineTeaser(item: TimelineTeaserItem): string {
  const actor = (item.actorLabel || '').trim() || 'Someone'
  const snippet = collapsePreview(item.bodyPreview || '')
  const where = item.channelSlug ? ` ~${item.channelSlug}` : ''
  const escalated = item.kind === 'escalation' || item.escalated
  const mark = escalated ? '^ ' : ''
  if (!snippet) return `${mark}${actor}${where}`.trim()
  return `${mark}${actor}${where} · ${snippet}`
}

export function countUnreadTimeline(items: TimelineTeaserItem[]): number {
  return items.filter((item) => item.unread).length
}

export type ConversationPreview = {
  title?: string
  preview?: string
  updatedAt?: number
}

/** When the mention feed is quiet, pull the newest conversation line. */
export function latestConversationPreview(
  conversations: ConversationPreview[],
): string | null {
  const ranked = conversations
    .filter((row) => (row.preview || '').trim())
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  const top = ranked[0]
  if (!top?.preview?.trim()) return null
  const who = (top.title || '').trim()
  const snippet = collapsePreview(top.preview)
  return who ? `${who} · ${snippet}` : snippet
}
