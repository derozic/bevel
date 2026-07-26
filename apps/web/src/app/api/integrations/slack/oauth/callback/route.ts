import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { exchangeSlackCode } from '@/lib/slack/oauth'
import { saveWorkspaceSlack } from '@/lib/slack/workspace-config'
import { tokensFromOAuthExchange } from '@/lib/slack/tokens'

/**
 * GET /api/integrations/slack/oauth/callback?code=&state=
 * Stores access + refresh tokens when token rotation is enabled on the Slack app.
 * @see https://docs.slack.dev/authentication/using-token-rotation/
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const err = url.searchParams.get('error')

  const origin = `${url.protocol}//${url.host}`
  const fail = (msg: string) =>
    NextResponse.redirect(
      `${origin}/console/integrations?slack=error&message=${encodeURIComponent(msg)}`,
    )

  if (err) return fail(err)
  if (!code || !state) return fail('Missing code or state')

  const cookieStore = await cookies()
  const expected = cookieStore.get('bevel_slack_oauth_state')?.value
  const tenantSlug =
    cookieStore.get('bevel_slack_oauth_tenant')?.value || 'platform'
  cookieStore.delete('bevel_slack_oauth_state')
  cookieStore.delete('bevel_slack_oauth_tenant')

  if (!expected || expected !== state) {
    return fail('Invalid OAuth state')
  }

  let exchanged: Awaited<ReturnType<typeof exchangeSlackCode>>
  try {
    exchanged = await exchangeSlackCode(code)
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : 'oauth.v2.access network error'
    // Never include secrets in redirect query
    return fail(msg.slice(0, 120))
  }
  if (!exchanged.ok || !exchanged.access_token) {
    return fail(exchanged.error || 'oauth.v2.access failed')
  }

  try {
    const tokenPatch = tokensFromOAuthExchange(exchanged)
    saveWorkspaceSlack(tenantSlug, {
      enabled: true,
      channelMap: {},
      ...tokenPatch,
      teamId: exchanged.team?.id ?? tokenPatch.teamId,
      teamName: exchanged.team?.name ?? tokenPatch.teamName,
      botUserId: exchanged.bot_user_id ?? tokenPatch.botUserId,
      scopes: (exchanged.scope || '').split(',').filter(Boolean),
      userScopes: exchanged.authed_user?.scope
        ? exchanged.authed_user.scope.split(',').filter(Boolean)
        : tokenPatch.userScopes,
      updatedBy: 'oauth',
    })
  } catch (e) {
    console.error('[slack/oauth/callback] secret store failed', {
      tenant: tenantSlug,
      err: e instanceof Error ? e.message : String(e),
    })
    return fail('Could not store Slack credentials securely')
  }

  const rotation = Boolean(
    exchanged.refresh_token || exchanged.authed_user?.refresh_token,
  )
  return NextResponse.redirect(
    `${origin}/console/integrations?slack=connected&team=${encodeURIComponent(exchanged.team?.name || '')}&rotation=${rotation ? '1' : '0'}`,
  )
}
