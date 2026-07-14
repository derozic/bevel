/**
 * OTP codes for email + SMS sign-in (server-only).
 * Codes are hashed at rest; plaintext is only returned to the sender path.
 */

import { createHash, randomInt } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type OtpChannel = 'email' | 'sms'

export type OtpRecord = {
  channel: OtpChannel
  destination: string
  /** SHA-256(code + secret) */
  hash: string
  expiresAt: string
  attempts: number
  createdAt: string
}

type Store = Record<string, OtpRecord>

const MAX_ATTEMPTS = 5
const TTL_MS = 10 * 60 * 1000

function dataDir(): string {
  if (process.env.BEVEL_DATA_ROOT) {
    return join(process.env.BEVEL_DATA_ROOT, 'otp')
  }
  if (existsSync(join(process.cwd(), 'apps/web'))) {
    return join(process.cwd(), 'data/otp')
  }
  return join(process.cwd(), '../../data/otp')
}

function storePath(): string {
  return join(dataDir(), 'codes.json')
}

function load(): Store {
  const path = storePath()
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Store
  } catch {
    return {}
  }
}

function save(store: Store) {
  const dir = dataDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  writeFileSync(storePath(), JSON.stringify(store, null, 2), 'utf8')
}

function normalizeDestination(channel: OtpChannel, raw: string): string {
  const t = raw.trim()
  if (channel === 'email') return t.toLowerCase()
  const digits = t.replace(/\D/g, '')
  if (t.startsWith('+')) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return `+${digits}`
}

function storeKey(channel: OtpChannel, destination: string): string {
  return `${channel}:${normalizeDestination(channel, destination)}`
}

function hashCode(code: string): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'bevel-dev'
  return createHash('sha256').update(`${code}:${secret}`).digest('hex')
}

export function generateOtpCode(): string {
  return String(randomInt(100000, 999999))
}

/** Create / replace OTP for destination. Returns plaintext code for delivery. */
export function issueOtp(
  channel: OtpChannel,
  destination: string,
): { code: string; expiresAt: string; destination: string } {
  const dest = normalizeDestination(channel, destination)
  if (channel === 'email' && !dest.includes('@')) {
    throw new Error('Valid email required')
  }
  if (channel === 'sms' && dest.replace(/\D/g, '').length < 10) {
    throw new Error('Valid phone required')
  }

  const code = generateOtpCode()
  const now = Date.now()
  const store = load()
  // prune expired
  for (const [k, v] of Object.entries(store)) {
    if (new Date(v.expiresAt).getTime() < now) delete store[k]
  }
  const expiresAt = new Date(now + TTL_MS).toISOString()
  store[storeKey(channel, dest)] = {
    channel,
    destination: dest,
    hash: hashCode(code),
    expiresAt,
    attempts: 0,
    createdAt: new Date(now).toISOString(),
  }
  save(store)
  return { code, expiresAt, destination: dest }
}

export type VerifyOtpResult =
  | { ok: true; channel: OtpChannel; destination: string }
  | { ok: false; reason: 'missing' | 'expired' | 'invalid' | 'locked' }

/** Consume OTP on success (one-time). */
export function verifyOtpCode(
  channel: OtpChannel,
  destination: string,
  code: string,
): VerifyOtpResult {
  const dest = normalizeDestination(channel, destination)
  const key = storeKey(channel, dest)
  const store = load()
  const rec = store[key]
  if (!rec) return { ok: false, reason: 'missing' }
  if (new Date(rec.expiresAt).getTime() < Date.now()) {
    delete store[key]
    save(store)
    return { ok: false, reason: 'expired' }
  }
  if (rec.attempts >= MAX_ATTEMPTS) {
    delete store[key]
    save(store)
    return { ok: false, reason: 'locked' }
  }
  const trimmed = code.trim()
  if (rec.hash !== hashCode(trimmed)) {
    rec.attempts += 1
    store[key] = rec
    save(store)
    return { ok: false, reason: 'invalid' }
  }
  delete store[key]
  save(store)
  return { ok: true, channel, destination: dest }
}

/** Synthetic Auth.js email for pure phone sign-in. */
export function phoneToSyntheticEmail(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, '')
  return `${digits}@phone.bevel.local`
}

export function isPhoneSyntheticEmail(email: string | null | undefined): boolean {
  return Boolean(email?.toLowerCase().endsWith('@phone.bevel.local'))
}
