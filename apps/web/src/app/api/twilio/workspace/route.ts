import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getTenantFromRequest } from '@bevel/tenant-config'
import { smsEntitlementDenied } from '@/lib/twilio/entitlement'
import {
  loadWorkspaceTwilio,
  publicWorkspaceTwilio,
  saveWorkspaceTwilio,
} from '@/lib/twilio/workspace-config'

export async function GET() {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }
  const tenant = await getTenantFromRequest()
  const denied = smsEntitlementDenied(tenant)
  const slug = session.tenantSlug ?? tenant?.slug ?? 'default'
  const stored = loadWorkspaceTwilio(slug)
  return NextResponse.json({
    tenantSlug: slug,
    plan: tenant?.plan ?? 'free',
    smsAllowed: !denied,
    upgradeRequired: Boolean(denied),
    upgradeMessage: denied?.error ?? null,
    twilio: publicWorkspaceTwilio(denied ? null : stored),
  })
}

export async function PUT(request: Request) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  }
  const tenant = await getTenantFromRequest()
  const denied = smsEntitlementDenied(tenant)
  if (denied) {
    return NextResponse.json(
      {
        error: denied.error,
        plan: denied.plan,
        upgradeRequired: true,
      },
      { status: denied.status },
    )
  }
  const slug = session.tenantSlug ?? tenant?.slug ?? 'default'
  const body = (await request.json().catch(() => ({}))) as {
    enabled?: boolean
    accountSid?: string
    authToken?: string
    fromNumber?: string
    webhookBaseUrl?: string
  }

  const saved = saveWorkspaceTwilio(slug, {
    enabled: Boolean(body.enabled),
    accountSid: String(body.accountSid ?? ''),
    authToken: String(body.authToken ?? ''),
    fromNumber: String(body.fromNumber ?? ''),
    webhookBaseUrl: body.webhookBaseUrl
      ? String(body.webhookBaseUrl)
      : undefined,
    updatedBy: session.user.email,
  })

  return NextResponse.json({
    tenantSlug: slug,
    twilio: publicWorkspaceTwilio(saved),
  })
}
