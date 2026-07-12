/**
 * Per-workspace Twilio credentials (server-only file store).
 * Never commit secrets — path is under data/secrets/ (gitignored).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { TwilioConfig } from './client'

/** Cheap path only: SID + token + From long-code. No Messaging Service / Verify. */
export type WorkspaceTwilioConfig = {
  tenantSlug: string
  enabled: boolean
  accountSid: string
  authToken: string
  fromNumber: string
  /** Public webhook base for inbound SMS (optional override). */
  webhookBaseUrl?: string
  updatedAt: string
  updatedBy?: string
}

function secretsDir(): string {
  if (process.env.BEVEL_DATA_ROOT) {
    return join(process.env.BEVEL_DATA_ROOT, 'secrets', 'twilio')
  }
  // next dev cwd is apps/web → monorepo data/; scripts may run from repo root
  const fromWeb = join(process.cwd(), '../../data/secrets/twilio')
  const fromRoot = join(process.cwd(), 'data/secrets/twilio')
  if (existsSync(join(process.cwd(), 'apps/web'))) return fromRoot
  return fromWeb
}

function configPath(tenantSlug: string): string {
  const safe = tenantSlug.replace(/[^a-z0-9-_]/gi, '_').toLowerCase()
  return join(secretsDir(), `${safe}.json`)
}

export function loadWorkspaceTwilio(
  tenantSlug: string,
): WorkspaceTwilioConfig | null {
  const path = configPath(tenantSlug)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as WorkspaceTwilioConfig
  } catch {
    return null
  }
}

export function saveWorkspaceTwilio(
  tenantSlug: string,
  input: {
    enabled: boolean
    accountSid: string
    authToken: string
    fromNumber: string
    webhookBaseUrl?: string
    updatedBy?: string
  },
): WorkspaceTwilioConfig {
  const dir = secretsDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const existing = loadWorkspaceTwilio(tenantSlug)
  // Allow blank authToken to mean "keep previous"
  const authToken =
    input.authToken.trim() || existing?.authToken || ''

  const next: WorkspaceTwilioConfig = {
    tenantSlug,
    enabled: input.enabled,
    accountSid: input.accountSid.trim(),
    authToken,
    fromNumber: input.fromNumber.trim(),
    webhookBaseUrl: input.webhookBaseUrl?.trim() || undefined,
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy,
  }

  writeFileSync(configPath(tenantSlug), JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function toTwilioClientConfig(
  stored: WorkspaceTwilioConfig | null,
): Partial<TwilioConfig> | null {
  if (!stored?.enabled) return null
  return {
    accountSid: stored.accountSid,
    authToken: stored.authToken,
    fromNumber: stored.fromNumber,
  }
}

/** Public-safe view (never return full auth token). */
export function publicWorkspaceTwilio(stored: WorkspaceTwilioConfig | null) {
  if (!stored) {
    return {
      configured: false,
      enabled: false,
      mode: 'messages_api' as const,
      accountSidPreview: '',
      fromNumber: '',
      webhookBaseUrl: '',
      updatedAt: null as string | null,
    }
  }
  const sid = stored.accountSid
  return {
    configured: Boolean(sid && stored.authToken && stored.fromNumber),
    enabled: stored.enabled,
    /** Always bare Messages API — cheapest path. */
    mode: 'messages_api' as const,
    accountSidPreview:
      sid.length > 8 ? `${sid.slice(0, 4)}…${sid.slice(-4)}` : sid ? '••••' : '',
    fromNumber: stored.fromNumber,
    webhookBaseUrl: stored.webhookBaseUrl ?? '',
    updatedAt: stored.updatedAt,
  }
}
