import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getTenantFromRequest } from '@bevel/tenant-config'
import { sendSms } from '@/lib/twilio/client'
import { smsEntitlementDenied } from '@/lib/twilio/entitlement'
import {
  loadWorkspaceTwilio,
  toTwilioClientConfig,
} from '@/lib/twilio/workspace-config'

/** Send a test SMS to confirm workspace Twilio credentials. */
export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }

  const tenant = await getTenantFromRequest()
  const denied = smsEntitlementDenied(tenant)
  if (denied) {
    return NextResponse.json(
      { error: denied.error, plan: denied.plan, upgradeRequired: true },
      { status: denied.status },
    )
  }

  const body = (await request.json().catch(() => ({}))) as { to?: string }
  if (!body.to?.trim()) {
    return NextResponse.json({ error: 'to phone required' }, { status: 400 })
  }

  const slug = session.tenantSlug ?? tenant?.slug ?? 'default'
  const workspace = loadWorkspaceTwilio(slug)
  const cfg = toTwilioClientConfig(workspace)

  try {
    const result = await sendSms({
      to: body.to,
      body: `BEVEL (${slug}): Twilio test from workspace settings. You are wired for presence SMS.`,
      cfg,
      allowSimulate: true,
    })
    return NextResponse.json({
      ok: true,
      sid: result.sid,
      status: result.status,
      simulated: result.simulated ?? false,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Send failed' },
      { status: 502 },
    )
  }
}
