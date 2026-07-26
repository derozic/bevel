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
  const state = randomBytes(24).toString('hex')
  const cookieStore = await cookies()
  // HTTPS always for local .lvh.me and production — secure cookies prevent leakage
  const secureCookie =
    process.env.NODE_ENV === 'production' ||
    process.env.AUTH_URL?.startsWith('https://') ||
    process.env.BEVEL_PUBLIC_URL?.startsWith('https://')
  const cookieBase = {
    httpOnly: true,
    secure: Boolean(secureCookie),
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 600,
  }
  cookieStore.set('bevel_slack_oauth_state', state, cookieBase)
  cookieStore.set('bevel_slack_oauth_tenant', slug, cookieBase)

  const url = buildSlackAuthorizeUrl(state)
  return NextResponse.redirect(url)
}
