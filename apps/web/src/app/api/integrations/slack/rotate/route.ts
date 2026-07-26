import { NextResponse } from 'next/server'
import { getTenantFromRequest } from '@bevel/tenant-config'
import { auth } from '@/auth'
import { loadWorkspaceSlack } from '@/lib/slack/workspace-config'
import {
  getValidBotToken,
  getValidUserToken,
  migrateLongLivedTokens,
  tokenRotationStatus,
} from '@/lib/slack/tokens'

/**
 * POST /api/integrations/slack/rotate
 * { "action": "refresh" | "migrate" }
 *
 * refresh — force refresh if refresh_token present (or no-op if not due)
 * migrate — oauth.v2.exchange long-lived tokens after enabling rotation in Slack app
 *
 * @see https://docs.slack.dev/authentication/using-token-rotation/
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const tenant = await getTenantFromRequest()
  const slug = tenant?.slug || 'platform'
  const cfg = loadWorkspaceSlack(slug)
  if (!cfg?.enabled) {
    return NextResponse.json({ error: 'Slack not connected' }, { status: 400 })
  }

  let body: { action?: string } = {}
  try {
    body = (await req.json()) as { action?: string }
  } catch {
    /* empty */
  }
  const action = body.action || 'refresh'

  try {
    if (action === 'migrate') {
      const next = await migrateLongLivedTokens(slug)
      return NextResponse.json({
        ok: true,
        action: 'migrate',
        rotation: tokenRotationStatus(next),
        message:
          'Long-lived tokens exchanged. Original tokens expire after first refresh — do not auth.revoke them.',
      })
    }

    // Default: ensure valid tokens (refresh if within buffer)
    const bot = await getValidBotToken(slug)
    const user = await getValidUserToken(slug)
    const next = loadWorkspaceSlack(slug)
    return NextResponse.json({
      ok: true,
      action: 'refresh',
      hasBot: Boolean(bot),
      hasUser: Boolean(user),
      rotation: tokenRotationStatus(next),
    })
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        action,
        error: e instanceof Error ? e.message : String(e),
        rotation: tokenRotationStatus(loadWorkspaceSlack(slug)),
      },
      { status: 502 },
    )
  }
}
