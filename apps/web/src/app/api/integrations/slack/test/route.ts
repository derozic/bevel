import { NextResponse } from 'next/server'
import { getTenantFromRequest } from '@bevel/tenant-config'
import { auth } from '@/auth'
import { loadWorkspaceSlack } from '@/lib/slack/workspace-config'
import { authTest, postFromWorkspace, bevelEventBlocks } from '@/lib/slack/client'
import { getValidBotToken, tokenRotationStatus } from '@/lib/slack/tokens'

/**
 * POST { "channel": "C… or mapped slug", "text"?: string }
 * Verifies bot token (with rotation refresh) and optionally posts a test card.
 */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const tenant = await getTenantFromRequest()
  const slug = tenant?.slug || 'platform'
  const cfg = loadWorkspaceSlack(slug)
  if (!cfg?.botToken) {
    return NextResponse.json(
      { error: 'Slack not connected', hint: 'GET /api/integrations/slack/oauth/start' },
      { status: 400 },
    )
  }

  let body: { channel?: string; text?: string } = {}
  try {
    body = (await req.json()) as { channel?: string; text?: string }
  } catch {
    /* empty */
  }

  let botToken: string
  try {
    botToken = (await getValidBotToken(slug)) || cfg.botToken
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        step: 'token.refresh',
        error: e instanceof Error ? e.message : String(e),
        rotation: tokenRotationStatus(cfg),
      },
      { status: 401 },
    )
  }

  const test = await authTest(botToken)
  if (!test.ok) {
    return NextResponse.json(
      {
        ok: false,
        step: 'auth.test',
        error: test.error,
        rotation: tokenRotationStatus(loadWorkspaceSlack(slug)),
      },
      { status: 502 },
    )
  }

  if (!body.channel?.trim()) {
    return NextResponse.json({
      ok: true,
      step: 'auth.test',
      team: test.data?.team,
      teamId: test.data?.team_id,
      botUser: test.data?.user_id,
      rotation: tokenRotationStatus(loadWorkspaceSlack(slug)),
      message: 'Token valid. Pass { channel } to post a test message.',
    })
  }

  const text =
    body.text?.trim() ||
    `BEVEL connected · workspace *${slug}* · ${new Date().toISOString()}`
  const publicBase =
    process.env.BEVEL_PUBLIC_URL ||
    process.env.AUTH_URL ||
    'https://bevel.is'
  const post = await postFromWorkspace(cfg, {
    token: botToken,
    channelOrSlug: body.channel.trim(),
    text,
    blocks: bevelEventBlocks({
      title: 'BEVEL · Slack bridge',
      body: text,
      href: `${publicBase.replace(/\/$/, '')}/console/integrations`,
      footer: 'Complement mode · agent + work plane · token rotation',
    }),
  })

  return NextResponse.json({
    ok: post.ok,
    step: 'chat.postMessage',
    auth: test.data,
    post: post.data,
    error: post.error,
    rotation: tokenRotationStatus(loadWorkspaceSlack(slug)),
  })
}
