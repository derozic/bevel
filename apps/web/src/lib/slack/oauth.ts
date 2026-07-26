/**
 * Slack OAuth v2 install URL + token exchange.
 * Bot install: oauth/v2/authorize + oauth.v2.access
 * MCP user tokens: oauth/v2_user/authorize + oauth.v2.user.access
 *
 * @see https://api.slack.com/authentication/oauth-v2
 * @see https://docs.slack.dev/ai/slack-mcp-server
 */

import { botScopeString, mcpUserScopeString, userScopeString } from './scopes'

/** Hosted Slack MCP (Streamable HTTP). */
export const SLACK_MCP_URL = 'https://mcp.slack.com/mcp'
export const SLACK_MCP_OAUTH_RESOURCE =
  'https://mcp.slack.com/.well-known/oauth-protected-resource'
export const SLACK_MCP_OAUTH_SERVER =
  'https://mcp.slack.com/.well-known/oauth-authorization-server'

export function slackClientId(): string {
  return process.env.SLACK_CLIENT_ID?.trim() || ''
}

export function slackClientSecret(): string {
  return process.env.SLACK_CLIENT_SECRET?.trim() || ''
}

export function slackSigningSecret(): string {
  return process.env.SLACK_SIGNING_SECRET?.trim() || ''
}

export function slackAppId(): string {
  return process.env.SLACK_APP_ID?.trim() || ''
}

export function slackRedirectUri(): string {
  if (process.env.SLACK_REDIRECT_URI?.trim()) {
    return process.env.SLACK_REDIRECT_URI.trim()
  }
  const base =
    process.env.BEVEL_PUBLIC_URL?.replace(/\/$/, '') ||
    process.env.AUTH_URL?.replace(/\/$/, '') ||
    'https://bevel.lvh.me'
  return `${base}/api/integrations/slack/oauth/callback`
}

export function isSlackOAuthConfigured(): boolean {
  return Boolean(slackClientId() && slackClientSecret())
}

/**
 * Combined install: bot scopes + user_scope for MCP tools.
 * Users land on Slack consent once from BEVEL Extensions.
 */
export function buildSlackAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: slackClientId(),
    scope: botScopeString(),
    // user_scope grants MCP-capable user token on authed_user
    user_scope: userScopeString(),
    redirect_uri: slackRedirectUri(),
    state,
  })
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`
}

/**
 * User-token-only authorize (MCP clients / secondary re-consent).
 * @see https://slack.com/oauth/v2_user/authorize
 */
export function buildSlackMcpUserAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: slackClientId(),
    user_scope: mcpUserScopeString(),
    redirect_uri: slackRedirectUri(),
    state,
  })
  return `https://slack.com/oauth/v2_user/authorize?${params.toString()}`
}

export type SlackOAuthExchange = {
  ok: boolean
  error?: string
  access_token?: string
  token_type?: string
  scope?: string
  bot_user_id?: string
  app_id?: string
  team?: { id?: string; name?: string }
  enterprise?: { id?: string; name?: string }
  authed_user?: {
    id?: string
    access_token?: string
    scope?: string
    token_type?: string
    /** Present when token rotation is enabled */
    refresh_token?: string
    expires_in?: number
  }
  /** Present when token rotation is enabled (bot or top-level user token) */
  refresh_token?: string
  /** Seconds until access_token expires (always 43200 with rotation) */
  expires_in?: number
}

export async function exchangeSlackCode(
  code: string,
): Promise<SlackOAuthExchange> {
  const body = new URLSearchParams({
    client_id: slackClientId(),
    client_secret: slackClientSecret(),
    code,
    redirect_uri: slackRedirectUri(),
  })
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = (await res.json()) as SlackOAuthExchange
  return data
}

/** Exchange code from v2_user authorize (MCP user token). */
export async function exchangeSlackUserCode(
  code: string,
): Promise<SlackOAuthExchange> {
  const body = new URLSearchParams({
    client_id: slackClientId(),
    client_secret: slackClientSecret(),
    code,
    redirect_uri: slackRedirectUri(),
  })
  const res = await fetch('https://slack.com/api/oauth.v2.user.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  const data = (await res.json()) as SlackOAuthExchange
  return data
}

/**
 * Refresh an expiring access token.
 * @see https://docs.slack.dev/authentication/using-token-rotation/#refresh
 *
 * POST oauth.v2.access with grant_type=refresh_token
 * Old refresh_token is revoked after a short grace period — always store the new pair.
 */
export async function refreshRotatedToken(
  refreshToken: string,
): Promise<SlackOAuthExchange> {
  const body = new URLSearchParams({
    client_id: slackClientId(),
    client_secret: slackClientSecret(),
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  return (await res.json()) as SlackOAuthExchange
}

/**
 * One-time: exchange a long-lived xoxb-/xoxp- token after enabling rotation.
 * @see https://docs.slack.dev/authentication/using-token-rotation/#exchange
 * Do NOT auth.revoke the old token yourself.
 */
export async function exchangeLongLivedToken(
  longLivedToken: string,
): Promise<SlackOAuthExchange> {
  const body = new URLSearchParams({
    client_id: slackClientId(),
    client_secret: slackClientSecret(),
    token: longLivedToken,
  })
  const res = await fetch('https://slack.com/api/oauth.v2.exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  return (await res.json()) as SlackOAuthExchange
}

/** HMAC verification for Events / interactions (Phase 1+). */
export async function verifySlackSignature(opts: {
  signingSecret: string
  signature: string
  timestamp: string
  rawBody: string
}): Promise<boolean> {
  const { signingSecret, signature, timestamp, rawBody } = opts
  if (!signingSecret || !signature || !timestamp) return false
  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) return false
  // 5 minute skew
  if (Math.abs(Date.now() / 1000 - ts) > 60 * 5) return false

  const base = `v0:${timestamp}:${rawBody}`
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(base),
  )
  const hex = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const expected = `v0=${hex}`
  return expected === signature
}
