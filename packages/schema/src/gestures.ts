/**
 * Chat gestures — operator signals on received messages.
 * Icons are Heroicons in the UI; these ids are the durable kinds.
 */
import { z } from 'zod'

export const GESTURE_KINDS = ['up', 'down', 'star', 'heart'] as const
export const VOTE_KINDS = ['vote_yes', 'vote_no'] as const
export const ALL_GESTURE_KINDS = [...GESTURE_KINDS, ...VOTE_KINDS] as const

export type GestureKind = (typeof ALL_GESTURE_KINDS)[number]
export type SignalKind = (typeof GESTURE_KINDS)[number]
export type VoteKind = (typeof VOTE_KINDS)[number]

export const MessageGestureSchema = z.object({
  kind: z.enum(ALL_GESTURE_KINDS),
  userId: z.string().min(1),
  userName: z.string().optional().default(''),
  ts: z.number().int().nonnegative(),
})

export type MessageGesture = z.infer<typeof MessageGestureSchema>

const OPPOSITE: Partial<Record<GestureKind, GestureKind>> = {
  up: 'down',
  down: 'up',
  vote_yes: 'vote_no',
  vote_no: 'vote_yes',
}

const VOTE_MARKER =
  /\[vote(?::\s*([^\]]+))?\]|<!--\s*bevel:vote(?:\s+prompt="([^"]*)")?\s*-->/gi

export function isGestureKind(raw: string): raw is GestureKind {
  return (ALL_GESTURE_KINDS as readonly string[]).includes(raw)
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
    const parsed = MessageGestureSchema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

export function serializeGestures(gestures: MessageGesture[]): string {
  return JSON.stringify(gestures)
}

/** Toggle a gesture for one user. Thumbs and votes are exclusive pairs. */
export function applyGesture(
  current: MessageGesture[],
  next: { kind: GestureKind; userId: string; userName?: string; ts?: number },
): MessageGesture[] {
  const kind = next.kind
  const userId = next.userId.trim()
  if (!userId || !isGestureKind(kind)) return current
  const ts = next.ts ?? Date.now()
  const name = (next.userName ?? '').trim()
  const existing = current.find((g) => g.userId === userId && g.kind === kind)
  const withoutUserPair = current.filter((g) => {
    if (g.userId !== userId) return true
    if (g.kind === kind) return false
    if (OPPOSITE[kind] && g.kind === OPPOSITE[kind]) return false
    return true
  })
  if (existing) return withoutUserPair
  return [...withoutUserPair, { kind, userId, userName: name, ts }]
}

export function gestureCounts(
  gestures: MessageGesture[],
): Record<GestureKind, number> {
  const counts = {
    up: 0,
    down: 0,
    star: 0,
    heart: 0,
    vote_yes: 0,
    vote_no: 0,
  } satisfies Record<GestureKind, number>
  for (const g of gestures) counts[g.kind] += 1
  return counts
}

export function userGestureKinds(
  gestures: MessageGesture[],
  userId: string,
): Set<GestureKind> {
  const id = userId.trim()
  return new Set(gestures.filter((g) => g.userId === id).map((g) => g.kind))
}

export function parseVotePrompt(
  body: string,
  meta?: { voteRequired?: boolean; votePrompt?: string | null },
): string | null {
  const explicit = (meta?.votePrompt ?? '').trim()
  if (explicit) return explicit
  if (meta?.voteRequired) return 'Vote on this'
  if (!body) return null
  const match = new RegExp(VOTE_MARKER.source, 'i').exec(body)
  if (!match) return null
  const fromTag = (match[1] || match[2] || '').trim()
  if (fromTag) return fromTag
  const after = body
    .slice((match.index ?? 0) + match[0].length)
    .trim()
    .split(/\n/)[0]
    ?.trim()
  return after || 'Vote on this'
}

export function stripVoteMarker(body: string): string {
  return body.replace(VOTE_MARKER, '').trim()
}

export function formatGestureFeedback(gestures: MessageGesture[]): string {
  if (gestures.length === 0) return ''
  const counts = gestureCounts(gestures)
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
