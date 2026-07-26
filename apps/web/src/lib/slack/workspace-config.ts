/**
 * Per-workspace Slack connection (server-only).
 * Tokens never ship to the browser.
 *
 * Token rotation: store access + refresh + expires_at for bot and user.
 * @see https://docs.slack.dev/authentication/using-token-rotation/
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

export type WorkspaceSlackConfig = {
  tenantSlug: string
  enabled: boolean
  teamId?: string
  teamName?: string
  botUserId?: string
  /** Bot access token (xoxb-… or rotating xoxe.xoxb-…) */
  botToken?: string
  /** Bot refresh token (xoxe-…) when token rotation is on */
  botRefreshToken?: string
  /** ISO expiry of bot access token */
  botTokenExpiresAt?: string
  /** User access token (xoxp-… or xoxe.xoxp-…) for MCP / act-as-user */
  userToken?: string
  userRefreshToken?: string
  userTokenExpiresAt?: string
  /** True when installation uses rotating tokens */
  tokenRotation?: boolean
  scopes: string[]
  userScopes?: string[]
  /** BEVEL channel slug → Slack channel id (C…) */
  channelMap: Record<string, string>
  installedAt?: string
  updatedAt: string
  updatedBy?: string
}

function secretsDir(): string {
  if (process.env.BEVEL_DATA_ROOT) {
    return join(process.env.BEVEL_DATA_ROOT, 'secrets', 'slack')
  }
  const fromWeb = join(process.cwd(), '../../data/secrets/slack')
  const fromRoot = join(process.cwd(), 'data/secrets/slack')
  if (existsSync(join(process.cwd(), 'apps/web'))) return fromRoot
  return fromWeb
}

function configPath(tenantSlug: string): string {
  const safe = tenantSlug.replace(/[^a-z0-9-_]/gi, '_').toLowerCase()
  return join(secretsDir(), `${safe}.json`)
}

export function loadWorkspaceSlack(
  tenantSlug: string,
): WorkspaceSlackConfig | null {
  const path = configPath(tenantSlug)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as WorkspaceSlackConfig
  } catch {
    return null
  }
}

export function saveWorkspaceSlack(
  tenantSlug: string,
  input: Partial<WorkspaceSlackConfig> & {
    enabled: boolean
    updatedBy?: string
  },
): WorkspaceSlackConfig {
  const dir = secretsDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  const existing = loadWorkspaceSlack(tenantSlug)
  const next: WorkspaceSlackConfig = {
    tenantSlug,
    enabled: input.enabled,
    teamId: input.teamId ?? existing?.teamId,
    teamName: input.teamName ?? existing?.teamName,
    botUserId: input.botUserId ?? existing?.botUserId,
    botToken: input.botToken?.trim() || existing?.botToken,
    botRefreshToken:
      input.botRefreshToken !== undefined
        ? input.botRefreshToken?.trim() || undefined
        : existing?.botRefreshToken,
    botTokenExpiresAt:
      input.botTokenExpiresAt !== undefined
        ? input.botTokenExpiresAt
        : existing?.botTokenExpiresAt,
    userToken: input.userToken?.trim() || existing?.userToken,
    userRefreshToken:
      input.userRefreshToken !== undefined
        ? input.userRefreshToken?.trim() || undefined
        : existing?.userRefreshToken,
    userTokenExpiresAt:
      input.userTokenExpiresAt !== undefined
        ? input.userTokenExpiresAt
        : existing?.userTokenExpiresAt,
    tokenRotation:
      input.tokenRotation ??
      existing?.tokenRotation ??
      Boolean(
        input.botRefreshToken ||
          input.userRefreshToken ||
          existing?.botRefreshToken ||
          existing?.userRefreshToken,
      ),
    scopes: input.scopes ?? existing?.scopes ?? [],
    userScopes: input.userScopes ?? existing?.userScopes,
    channelMap: input.channelMap ?? existing?.channelMap ?? {},
    installedAt: existing?.installedAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: input.updatedBy ?? existing?.updatedBy,
  }
  writeFileSync(configPath(tenantSlug), JSON.stringify(next, null, 2), 'utf8')
  return next
}

export function deleteWorkspaceSlack(tenantSlug: string): void {
  const path = configPath(tenantSlug)
  if (existsSync(path)) unlinkSync(path)
}

/** Safe public status (no tokens). */
export function slackPublicStatus(tenantSlug: string) {
  const cfg = loadWorkspaceSlack(tenantSlug)
  if (!cfg?.enabled || !cfg.botToken) {
    return {
      connected: false as const,
      tenantSlug,
    }
  }
  return {
    connected: true as const,
    tenantSlug,
    teamId: cfg.teamId,
    teamName: cfg.teamName,
    botUserId: cfg.botUserId,
    scopes: cfg.scopes,
    userScopes: cfg.userScopes,
    channelMap: cfg.channelMap,
    tokenRotation: Boolean(
      cfg.tokenRotation || cfg.botRefreshToken || cfg.userRefreshToken,
    ),
    botTokenExpiresAt: cfg.botTokenExpiresAt ?? null,
    userTokenExpiresAt: cfg.userTokenExpiresAt ?? null,
    installedAt: cfg.installedAt,
    updatedAt: cfg.updatedAt,
  }
}
