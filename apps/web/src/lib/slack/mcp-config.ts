/**
 * MCP client configuration snippets for BEVEL + Slack.
 * @see docs/SLACK_MCP.md
 * @see https://docs.slack.dev/ai/slack-mcp-server
 */

import {
  SLACK_MCP_OAUTH_RESOURCE,
  SLACK_MCP_OAUTH_SERVER,
  SLACK_MCP_URL,
  isSlackOAuthConfigured,
  slackAppId,
  slackClientId,
  slackRedirectUri,
} from './oauth'
import { SLACK_MCP_USER_SCOPES, SLACK_BOT_SCOPES } from './scopes'

export type McpServerEntry =
  | {
      command: string
      args: string[]
      cwd?: string
      env?: Record<string, string>
    }
  | {
      url: string
      transport?: 'http' | 'sse'
      headers?: Record<string, string>
    }

export function buildMcpServersConfig(opts?: {
  bevelApiUrl?: string
  bevelApiCwd?: string
}): { mcpServers: Record<string, McpServerEntry> } {
  const apiUrl =
    opts?.bevelApiUrl ||
    process.env.BEVEL_API_URL ||
    process.env.NEXT_PUBLIC_BEVEL_API_URL ||
    'https://api.bevel.is'
  const cwd =
    opts?.bevelApiCwd ||
    process.env.BEVEL_API_CWD ||
    // monorepo default when developing on this machine
    `${process.env.HOME || ''}/dev/bevel/services/api`

  return {
    mcpServers: {
      bevel: {
        command: 'uv',
        args: ['run', 'bevel-mcp'],
        cwd,
        env: {
          BEVEL_API_URL: apiUrl.replace(/\/$/, ''),
        },
      },
      slack: {
        url: SLACK_MCP_URL,
        transport: 'http',
      },
    },
  }
}

/** Public metadata for Extensions / settings UI. */
export function slackMcpPublicMeta() {
  return {
    endpoint: SLACK_MCP_URL,
    transport: 'streamable-http' as const,
    protocol: 'JSON-RPC 2.0',
    oauth: {
      protectedResource: SLACK_MCP_OAUTH_RESOURCE,
      authorizationServer: SLACK_MCP_OAUTH_SERVER,
      authorizeUser: 'https://slack.com/oauth/v2_user/authorize',
      tokenUser: 'https://slack.com/api/oauth.v2.user.access',
      bevelRedirectUri: slackRedirectUri(),
      clientIdConfigured: Boolean(slackClientId()),
      appId: slackAppId() || null,
      oauthConfigured: isSlackOAuthConfigured(),
    },
    scopes: {
      mcpUser: SLACK_MCP_USER_SCOPES,
      bot: SLACK_BOT_SCOPES,
    },
    requirements: [
      'Slack app must be internal or Marketplace-listed (unlisted cannot use MCP)',
      'Register OAuth redirect: https://bevel.is/api/integrations/slack/oauth/callback',
      'MCP clients complete user OAuth; admins approve the app',
      'IP allowlists on the Slack app apply to mcp.slack.com traffic',
    ],
    partnerClients: [
      'https://claude.ai',
      'https://code.claude.com',
      'https://cursor.com',
      'https://perplexity.ai',
    ],
    docs: {
      slack: 'https://docs.slack.dev/ai/slack-mcp-server',
      bevel: 'docs/SLACK_MCP.md',
    },
    clientConfig: buildMcpServersConfig(),
  }
}
