/**
 * Slack OAuth scopes.
 * Bot scopes: deterministic BEVEL → Slack bridge (Web API).
 * MCP user scopes: agent tools via https://mcp.slack.com/mcp
 *
 * @see https://docs.slack.dev/ai/slack-mcp-server
 * @see https://api.slack.com/scopes
 */

/** Bot scopes for complement-mode posts + slash + mentions. */
export const SLACK_BOT_SCOPES = [
  'chat:write',
  'chat:write.public',
  'channels:read',
  'groups:read',
  'commands',
  'app_mentions:read',
  'im:write',
  'users:read',
] as const

/**
 * User token scopes required by Slack hosted MCP tools.
 * Authorize via https://slack.com/oauth/v2_user/authorize
 */
export const SLACK_MCP_USER_SCOPES = [
  // search
  'search:read.public',
  'search:read.private',
  'search:read.mpim',
  'search:read.im',
  'search:read.files',
  'search:read.users',
  // messages
  'chat:write',
  'channels:history',
  'groups:history',
  'mpim:history',
  'im:history',
  // conversations
  'channels:write',
  'groups:write',
  'im:write',
  'mpim:write',
  'channels:read',
  'groups:read',
  'mpim:read',
  // users / reactions / files / emoji / canvases
  'users:read',
  'users:read.email',
  'reactions:write',
  'reactions:read',
  'emoji:read',
  'files:read',
  'canvases:read',
  'canvases:write',
] as const

/** Lightweight identity (legacy / non-MCP). */
export const SLACK_USER_IDENTITY_SCOPES = [
  'identity.basic',
  'identity.email',
] as const

export function botScopeString(extra: string[] = []): string {
  return [...new Set([...SLACK_BOT_SCOPES, ...extra])].join(',')
}

/** Full MCP-capable user scope list for authorize URL. */
export function mcpUserScopeString(extra: string[] = []): string {
  return [...new Set([...SLACK_MCP_USER_SCOPES, ...extra])].join(',')
}

export function userScopeString(extra: string[] = []): string {
  // Prefer MCP scopes; identity alone is insufficient for Slack MCP tools
  return mcpUserScopeString(extra)
}
