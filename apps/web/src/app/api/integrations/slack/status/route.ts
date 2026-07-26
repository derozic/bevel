import { NextResponse } from 'next/server'
import { getTenantFromRequest } from '@bevel/tenant-config'
import { auth } from '@/auth'
import {
  SLACK_MCP_URL,
  isSlackOAuthConfigured,
  slackRedirectUri,
} from '@/lib/slack/oauth'
import { slackPublicStatus } from '@/lib/slack/workspace-config'
import { SLACK_BOT_SCOPES, SLACK_MCP_USER_SCOPES } from '@/lib/slack/scopes'
import { loadWorkspaceSlack } from '@/lib/slack/workspace-config'
import { tokenRotationStatus } from '@/lib/slack/tokens'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const tenant = await getTenantFromRequest()
  const slug = tenant?.slug || 'platform'
  const status = slackPublicStatus(slug)
  const cfg = loadWorkspaceSlack(slug)

  return NextResponse.json({
    ...status,
    oauthConfigured: isSlackOAuthConfigured(),
    redirectUri: slackRedirectUri(),
    requestedScopes: SLACK_BOT_SCOPES,
    mcpUserScopes: SLACK_MCP_USER_SCOPES,
    tokenRotation: tokenRotationStatus(cfg),
    mcp: {
      endpoint: SLACK_MCP_URL,
      configUrl: '/api/integrations/slack/mcp',
      docs: 'docs/SLACK_MCP.md',
    },
    docs: 'docs/SLACK_INTEGRATION.md',
    tokenRotationDocs: 'https://docs.slack.dev/authentication/using-token-rotation/',
    stance:
      'Complement Slack (people HQ) — BEVEL is the agent + work plane. Bridge digests, slash, and mentions; do not clone the client. Agents use Slack MCP at mcp.slack.com. Access tokens rotate every 12h when enabled on the Slack app.',
  })
}
