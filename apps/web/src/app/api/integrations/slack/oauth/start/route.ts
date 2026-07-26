import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getTenantFromRequest } from '@bevel/tenant-config'
import { auth } from '@/auth'
import {
  buildSlackAuthorizeUrl,
  isSlackOAuthConfigured,
} from '@/lib/slack/oauth'
import { randomBytes } from 'node:crypto'

/**
 * GET /api/integrations/slack/oauth/start
 * Starts Slack OAuth v2 install. Requires session.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!isSlackOAuthConfigured()) {
    return NextResponse.json(
      {
        error: 'Slack OAuth not configured',
        hint: 'Set SLACK_CLIENT_ID, SLACK_CLIENT_SECRET, SLACK_SIGNING_SECRET (and optional SLACK_REDIRECT_URI)',
        docs: 'docs/SLACK_INTEGRATION.md',
      },
      { status: 503 },
    )
  }

  const tenant = await getTenantFromRequest()
  const slug = tenant?.slug || 'platform'
  const state = randomBytes(16).toString('hex')
  const cookieStore = await cookies()
  cookieStore.set('bevel_slack_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  cookieStore.set('bevel_slack_oauth_tenant', slug, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })

  const url = buildSlackAuthorizeUrl(state)
  return NextResponse.redirect(url)
}
