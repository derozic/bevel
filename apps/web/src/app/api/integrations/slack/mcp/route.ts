import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { slackMcpPublicMeta } from '@/lib/slack/mcp-config'
import { slackPublicStatus } from '@/lib/slack/workspace-config'
import { getTenantFromRequest } from '@bevel/tenant-config'

/**
 * GET /api/integrations/slack/mcp
 * Returns Slack MCP endpoint metadata + agent client config snippets.
 * Auth optional for public metadata; connection status requires session.
 */
export async function GET() {
  const meta = slackMcpPublicMeta()
  const session = await auth()
  let connection: ReturnType<typeof slackPublicStatus> | null = null
  if (session?.user) {
    const tenant = await getTenantFromRequest()
    connection = slackPublicStatus(tenant?.slug || 'platform')
  }

  return NextResponse.json({
    ...meta,
    connection,
    stance:
      'Use Slack MCP for HQ search/send as the user; BEVEL MCP for control plane and agent work channels.',
  })
}
