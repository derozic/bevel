/**
 * JOHNNY-style vote records for SMS presence alerts.
 * Votes: open | snooze | ack (or up/down aliases).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'

export type SmsVoteKind = 'open' | 'snooze' | 'ack'

export type PendingSmsAlert = {
  token: string
  tenantSlug: string
  userKey: string
  phoneE164: string
  channelSlug: string
  messagePreview: string
  messageId?: string
  createdAt: string
  expiresAt: string
  vote?: SmsVoteKind
  votedAt?: string
}

type Store = {
  pending: Record<string, PendingSmsAlert>
}

function dataDir(): string {
  if (process.env.BEVEL_DATA_ROOT) {
    return join(process.env.BEVEL_DATA_ROOT, 'sms')
  }
  if (existsSync(join(process.cwd(), 'apps/web'))) {
    return join(process.cwd(), 'data/sms')
  }
  return join(process.cwd(), '../../data/sms')
}

function storePath(): string {
  return join(dataDir(), 'votes.json')
}

function load(): Store {
  const path = storePath()
  if (!existsSync(path)) return { pending: {} }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Store
  } catch {
    return { pending: {} }
  }
}

function save(store: Store) {
  const dir = dataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(storePath(), JSON.stringify(store, null, 2), 'utf8')
}

export function createPendingAlert(input: {
  tenantSlug: string
  userKey: string
  phoneE164: string
  channelSlug: string
  messagePreview: string
  messageId?: string
  ttlMinutes?: number
}): PendingSmsAlert {
  const store = load()
  const token = randomBytes(16).toString('hex')
  const now = Date.now()
  const ttl = (input.ttlMinutes ?? 60) * 60_000
  const alert: PendingSmsAlert = {
    token,
    tenantSlug: input.tenantSlug,
    userKey: input.userKey,
    phoneE164: input.phoneE164,
    channelSlug: input.channelSlug,
    messagePreview: input.messagePreview.slice(0, 280),
    messageId: input.messageId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
  }
  store.pending[token] = alert
  // prune expired
  for (const [k, v] of Object.entries(store.pending)) {
    if (new Date(v.expiresAt).getTime() < now) delete store.pending[k]
  }
  save(store)
  return alert
}

export function getPendingAlert(token: string): PendingSmsAlert | null {
  const store = load()
  const alert = store.pending[token]
  if (!alert) return null
  if (new Date(alert.expiresAt).getTime() < Date.now()) return null
  return alert
}

/** Latest unvoted, unexpired alert for a phone (inbound SMS replies). */
export function findLatestPendingForPhone(
  phoneE164: string,
): PendingSmsAlert | null {
  const store = load()
  const now = Date.now()
  const list = Object.values(store.pending)
    .filter(
      (a) =>
        a.phoneE164 === phoneE164 &&
        !a.vote &&
        new Date(a.expiresAt).getTime() > now,
    )
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  return list[0] ?? null
}

export function recordVote(
  token: string,
  vote: SmsVoteKind,
): PendingSmsAlert | null {
  const store = load()
  const alert = store.pending[token]
  if (!alert) return null
  if (new Date(alert.expiresAt).getTime() < Date.now()) return null
  alert.vote = vote
  alert.votedAt = new Date().toISOString()
  store.pending[token] = alert
  save(store)
  return alert
}

/** Parse inbound SMS body into a vote kind (JOHNNY-style). */
export function parseVoteFromSmsBody(body: string): SmsVoteKind | null {
  const t = body.trim().toLowerCase()
  if (!t) return null
  if (
    ['y', 'yes', '1', '+', '+1', 'up', 'open', 'o', 'read'].includes(t)
  ) {
    return 'open'
  }
  if (['s', 'snooze', 'later', '2'].includes(t)) {
    return 'snooze'
  }
  if (['n', 'no', 'ack', 'ok', '3', 'down', 'dismiss'].includes(t)) {
    return 'ack'
  }
  return null
}

export function buildVoteUrls(
  origin: string,
  token: string,
): Record<SmsVoteKind, string> {
  const base = origin.replace(/\/$/, '')
  return {
    open: `${base}/api/twilio/vote?token=${token}&v=open`,
    snooze: `${base}/api/twilio/vote?token=${token}&v=snooze`,
    ack: `${base}/api/twilio/vote?token=${token}&v=ack`,
  }
}

/**
 * Cheap SMS copy. Prefer reply-only (1 segment) over full vote URLs (often 2–3).
 * When voteUrls are included, still keep body short — cost is per segment.
 */
export function composePresenceSms(opts: {
  productName: string
  channelSlug: string
  preview: string
  voteUrls?: Record<SmsVoteKind, string> | null
  /** Prefer short reply-only text (cheapest). Default true when no voteUrls. */
  compact?: boolean
}): string {
  const head = `${opts.productName} #${opts.channelSlug}`
  const preview = (opts.preview.trim() || 'unread').slice(0, 60)
  if (!opts.voteUrls) {
    // ~1 GSM segment
    return `${head}: ${preview}. Reply Y=open S=later N=ack`
  }
  // URLs force multi-segment; keep minimal labels
  return (
    `${head}: ${preview}\n` +
    `Y ${opts.voteUrls.open}\n` +
    `S ${opts.voteUrls.snooze}\n` +
    `N ${opts.voteUrls.ack}`
  )
}
