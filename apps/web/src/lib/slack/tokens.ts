/**
 * Slack token rotation (RFC-style refresh).
 * @see https://docs.slack.dev/authentication/using-token-rotation/
 *
 * Access tokens expire every 12h when rotation is enabled.
 * Refresh with oauth.v2.access grant_type=refresh_token.
 * Refresh tokens are one-shot; always store the new pair.
 */

import {
  exchangeLongLivedToken,
  refreshRotatedToken,
  slackClientId,
  slackClientSecret,
} from './oauth'
import {
  loadWorkspaceSlack,
  saveWorkspaceSlack,
  type WorkspaceSlackConfig,
} from './workspace-config'

/** Refresh ~1h before expiry (Slack: 12h = 43200s). */
const REFRESH_BUFFER_MS = 60 * 60 * 1000

export type TokenKind = 'bot' | 'user'

function expiresAtFromSeconds(expiresIn: number | undefined): string | undefined {
  if (expiresIn == null || !Number.isFinite(expiresIn)) return undefined
  return new Date(Date.now() + expiresIn * 1000).toISOString()
}

function needsRefresh(expiresAtIso: string | undefined): boolean {
  if (!expiresAtIso) {
    // Long-lived token (no rotation) — treat as valid until Slack returns invalid_auth
    return false
  }
  const t = Date.parse(expiresAtIso)
  if (!Number.isFinite(t)) return true
  return Date.now() >= t - REFRESH_BUFFER_MS
}

/**
 * Persist tokens from oauth.v2.access / oauth.v2.user.access / refresh response.
 */
export function tokensFromOAuthExchange(exchanged: {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  token_type?: string
  bot_user_id?: string
  team?: { id?: string; name?: string }
  scope?: string
  authed_user?: {
    id?: string
    access_token?: string
    refresh_token?: string
    expires_in?: number
    scope?: string
  }
}): Partial<WorkspaceSlackConfig> {
  const patch: Partial<WorkspaceSlackConfig> = {
    teamId: exchanged.team?.id,
    teamName: exchanged.team?.name,
    botUserId: exchanged.bot_user_id,
    tokenRotation: Boolean(exchanged.refresh_token || exchanged.authed_user?.refresh_token),
  }

  // Top-level access_token is typically bot when using v2 install
  if (exchanged.access_token) {
    const isUser =
      exchanged.token_type === 'user' ||
      exchanged.access_token.includes('xoxp')
    if (isUser) {
      patch.userToken = exchanged.access_token
      patch.userRefreshToken = exchanged.refresh_token
      patch.userTokenExpiresAt = expiresAtFromSeconds(exchanged.expires_in)
    } else {
      patch.botToken = exchanged.access_token
      patch.botRefreshToken = exchanged.refresh_token
      patch.botTokenExpiresAt = expiresAtFromSeconds(exchanged.expires_in)
    }
  }

  if (exchanged.authed_user?.access_token) {
    patch.userToken = exchanged.authed_user.access_token
    if (exchanged.authed_user.refresh_token) {
      patch.userRefreshToken = exchanged.authed_user.refresh_token
    }
    if (exchanged.authed_user.expires_in != null) {
      patch.userTokenExpiresAt = expiresAtFromSeconds(
        exchanged.authed_user.expires_in,
      )
    }
  }

  if (exchanged.scope) {
    patch.scopes = exchanged.scope.split(',').filter(Boolean)
  } else if (exchanged.authed_user?.scope) {
    patch.userScopes = exchanged.authed_user.scope.split(',').filter(Boolean)
  }

  return patch
}

async function refreshAndSave(
  tenantSlug: string,
  kind: TokenKind,
  refreshToken: string,
): Promise<string> {
  const result = await refreshRotatedToken(refreshToken)
  if (!result.ok || !result.access_token) {
    throw new Error(
      result.error ||
        `Slack token refresh failed (${kind}). Re-connect Slack in Extensions.`,
    )
  }

  const patch = tokensFromOAuthExchange(result)
  // Ensure the correct side is updated even if type detection is ambiguous
  if (kind === 'bot') {
    patch.botToken = result.access_token
    patch.botRefreshToken = result.refresh_token
    patch.botTokenExpiresAt = expiresAtFromSeconds(result.expires_in)
  } else {
    patch.userToken = result.access_token
    patch.userRefreshToken = result.refresh_token
    patch.userTokenExpiresAt = expiresAtFromSeconds(result.expires_in)
  }

  saveWorkspaceSlack(tenantSlug, {
    enabled: true,
    ...patch,
    updatedBy: 'token-rotation',
  })

  return result.access_token
}

/**
 * Return a usable bot access token, refreshing if near expiry.
 */
export async function getValidBotToken(tenantSlug: string): Promise<string | null> {
  const cfg = loadWorkspaceSlack(tenantSlug)
  if (!cfg?.enabled || !cfg.botToken) return null

  if (!needsRefresh(cfg.botTokenExpiresAt)) {
    return cfg.botToken
  }

  if (!cfg.botRefreshToken) {
    // Long-lived or rotation not enabled — use as-is
    return cfg.botToken
  }

  return refreshAndSave(tenantSlug, 'bot', cfg.botRefreshToken)
}

/**
 * Return a usable user access token (MCP / act-as-user), refreshing if needed.
 */
export async function getValidUserToken(tenantSlug: string): Promise<string | null> {
  const cfg = loadWorkspaceSlack(tenantSlug)
  if (!cfg?.enabled || !cfg.userToken) return null

  if (!needsRefresh(cfg.userTokenExpiresAt)) {
    return cfg.userToken
  }

  if (!cfg.userRefreshToken) {
    return cfg.userToken
  }

  return refreshAndSave(tenantSlug, 'user', cfg.userRefreshToken)
}

/**
 * One-time migration: long-lived xoxb/xoxp → rotating tokens via oauth.v2.exchange.
 * Call after enabling token rotation in Slack app settings.
 */
export async function migrateLongLivedTokens(
  tenantSlug: string,
): Promise<WorkspaceSlackConfig> {
  const cfg = loadWorkspaceSlack(tenantSlug)
  if (!cfg) {
    throw new Error('No Slack connection for tenant')
  }
  if (!slackClientId() || !slackClientSecret()) {
    throw new Error('SLACK_CLIENT_ID / SLACK_CLIENT_SECRET required')
  }

  const patch: Partial<WorkspaceSlackConfig> = { tokenRotation: true }

  if (cfg.botToken && !cfg.botRefreshToken && !cfg.botToken.startsWith('xoxe.')) {
    const ex = await exchangeLongLivedToken(cfg.botToken)
    if (!ex.ok || !ex.access_token) {
      throw new Error(ex.error || 'oauth.v2.exchange failed for bot token')
    }
    Object.assign(patch, tokensFromOAuthExchange(ex))
    patch.botToken = ex.access_token
    patch.botRefreshToken = ex.refresh_token
    patch.botTokenExpiresAt = expiresAtFromSeconds(ex.expires_in)
  }

  if (cfg.userToken && !cfg.userRefreshToken && !cfg.userToken.startsWith('xoxe.')) {
    const ex = await exchangeLongLivedToken(cfg.userToken)
    if (!ex.ok || !ex.access_token) {
      throw new Error(ex.error || 'oauth.v2.exchange failed for user token')
    }
    patch.userToken = ex.access_token
    patch.userRefreshToken = ex.refresh_token
    patch.userTokenExpiresAt = expiresAtFromSeconds(ex.expires_in)
  }

  return saveWorkspaceSlack(tenantSlug, {
    enabled: true,
    ...patch,
    updatedBy: 'token-rotation-migrate',
  })
}

/** Public rotation health for status API (no secrets). */
export function tokenRotationStatus(cfg: WorkspaceSlackConfig | null) {
  if (!cfg?.enabled) {
    return { enabled: false as const, rotation: false }
  }
  return {
    enabled: true as const,
    rotation: Boolean(
      cfg.tokenRotation ||
        cfg.botRefreshToken ||
        cfg.userRefreshToken ||
        cfg.botToken?.startsWith('xoxe.') ||
        cfg.userToken?.startsWith('xoxe.'),
    ),
    botExpiresAt: cfg.botTokenExpiresAt ?? null,
    userExpiresAt: cfg.userTokenExpiresAt ?? null,
    botNeedsRefresh: needsRefresh(cfg.botTokenExpiresAt),
    userNeedsRefresh: needsRefresh(cfg.userTokenExpiresAt),
  }
}
