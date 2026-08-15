/** Operator gestures on received chat. Kept in-process so realtime has no extra dep. */

export const GESTURE_KINDS = [
  'up',
  'down',
  'star',
  'heart',
  'vote_yes',
  'vote_no',
] as const

export type GestureKind = (typeof GESTURE_KINDS)[number]

export type MessageGesture = {
  kind: GestureKind
  userId: string
  userName?: string
  ts: number
}

const OPPOSITE: Partial<Record<GestureKind, GestureKind>> = {
  up: 'down',
  down: 'up',
  vote_yes: 'vote_no',
  vote_no: 'vote_yes',
}

const VOTE_MARKER =
  /\[vote(?::\s*([^\]]+))?\]|<!--\s*bevel:vote(?:\s+prompt="([^"]*)")?\s*-->/i

export function isGestureKind(raw: string): raw is GestureKind {
  return (GESTURE_KINDS as readonly string[]).includes(raw)
}

export function parseGestures(raw: unknown): MessageGesture[] {
  if (!raw) return []
  let list: unknown = raw
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(list)) return []
  const out: MessageGesture[] = []
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const kind = String(rec.kind ?? '')
    const userId = String(rec.userId ?? rec.user_id ?? '').trim()
    if (!isGestureKind(kind) || !userId) continue
    out.push({
      kind,
      userId,
      userName: String(rec.userName ?? rec.user_name ?? ''),
      ts: Number(rec.ts) || 0,
    })
  }
  return out
}

export function applyGesture(
  current: MessageGesture[],
  next: { kind: GestureKind; userId: string; userName?: string; ts?: number },
): MessageGesture[] {
  const userId = next.userId.trim()
  if (!userId || !isGestureKind(next.kind)) return current
  const opposite = OPPOSITE[next.kind]
  const hadSame = current.some((g) => g.userId === userId && g.kind === next.kind)
  const kept = current.filter((g) => {
    if (g.userId !== userId) return true
    if (g.kind === next.kind) return false
    if (opposite && g.kind === opposite) return false
    return true
  })
  if (hadSame) return kept
  return [
    ...kept,
    {
      kind: next.kind,
      userId,
      userName: (next.userName ?? '').trim(),
      ts: next.ts ?? Date.now(),
    },
  ]
}

export function parseVotePrompt(body: string, votePrompt?: string | null): string {
  const explicit = (votePrompt ?? '').trim()
  if (explicit) return explicit
  if (!body) return ''
  const match = VOTE_MARKER.exec(body)
  if (!match) return ''
  const tagged = (match[1] || match[2] || '').trim()
  if (tagged) return tagged
  const after = body
    .slice(match.index + match[0].length)
    .trim()
    .split('\n')[0]
    ?.trim()
  return after || 'Vote on this'
}

export function formatGestureFeedback(gestures: MessageGesture[]): string {
  if (!gestures.length) return ''
  const counts = { up: 0, down: 0, star: 0, heart: 0, vote_yes: 0, vote_no: 0 }
  for (const g of gestures) counts[g.kind] += 1
  const parts: string[] = []
  if (counts.up) parts.push(`${counts.up} thumbs up`)
  if (counts.down) parts.push(`${counts.down} thumbs down`)
  if (counts.star) parts.push(`${counts.star} star`)
  if (counts.heart) parts.push(`${counts.heart} heart`)
  if (counts.vote_yes || counts.vote_no) {
    parts.push(`vote ${counts.vote_yes} yes / ${counts.vote_no} no`)
  }
  return parts.length ? `Operator signals: ${parts.join(', ')}.` : ''
}
