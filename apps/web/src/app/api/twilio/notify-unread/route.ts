import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getTenantFromRequest, lookupTenantBySlug } from '@bevel/tenant-config'
import { sendSms } from '@/lib/twilio/client'
import { smsEntitlementDenied } from '@/lib/twilio/entitlement'
import {
  buildVoteUrls,
  composePresenceSms,
  createPendingAlert,
} from '@/lib/twilio/votes'
import {
  hasRecentPresence,
  inQuietHours,
  type PresenceSnapshot,
} from '@/lib/twilio/presence'
import {
  loadWorkspaceTwilio,
  toTwilioClientConfig,
} from '@/lib/twilio/workspace-config'

/**
 * POST /api/twilio/notify-unread
 *
 * Called by realtime / mobile / internal jobs when a message is unread and
 * presence may be cold. Enforces workspace Twilio + user SMS prefs + grace.
 *
 * Body:
 * {
 *   phoneE164, graceMinutes, includeVoteLinks, quietHoursEnabled?, quietStart?, quietEnd?,
 *   channelSlug, messagePreview, messageId?,
 *   presence: { desktopLastSeenAt?, mobileLastSeenAt?, messageSeenAt? },
 *   productName?, force?: boolean
 * }
 */
export async function POST(request: Request) {
  const session = await auth()
  const internalKey = request.headers.get('x-fleet-internal-key')
  const allowInternal =
    internalKey &&
    process.env.FLEET_INTERNAL_API_KEY &&
    internalKey === process.env.FLEET_INTERNAL_API_KEY

  if (!session?.user?.email && !allowInternal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    phoneE164?: string
    phoneVerified?: boolean
    smsEnabled?: boolean
    graceMinutes?: number
    includeVoteLinks?: boolean
    onlyMentionsAndDms?: boolean
    quietHoursEnabled?: boolean
    quietStart?: string
    quietEnd?: string
    channelSlug?: string
    messagePreview?: string
    messageId?: string
    isMentionOrDm?: boolean
    presence?: PresenceSnapshot
    productName?: string
    force?: boolean
    tenantSlug?: string
    userKey?: string
  }

  const tenantSlug =
    body.tenantSlug || session?.tenantSlug || 'default'
  const userKey =
    body.userKey ||
    session?.user?.email ||
    session?.user?.id ||
    'anon'

  const tenant =
    (await getTenantFromRequest()) ?? lookupTenantBySlug(tenantSlug)
  const denied = smsEntitlementDenied(tenant)
  if (denied) {
    return NextResponse.json(
      {
        skipped: true,
        reason: 'plan_required',
        plan: denied.plan,
        error: denied.error,
      },
      { status: 402 },
    )
  }

  if (!body.smsEnabled && !body.force) {
    return NextResponse.json({ skipped: true, reason: 'sms_disabled' })
  }
  if (!body.phoneVerified && !body.force) {
    return NextResponse.json({ skipped: true, reason: 'phone_unverified' })
  }
  if (!body.phoneE164?.trim()) {
    return NextResponse.json({ skipped: true, reason: 'no_phone' })
  }
  if (
    body.onlyMentionsAndDms !== false &&
    body.isMentionOrDm === false &&
    !body.force
  ) {
    return NextResponse.json({ skipped: true, reason: 'not_mention_or_dm' })
  }

  const grace = body.graceMinutes ?? 5
  if (
    !body.force &&
    hasRecentPresence(body.presence ?? {}, grace)
  ) {
    return NextResponse.json({ skipped: true, reason: 'recent_presence' })
  }

  if (
    body.quietHoursEnabled &&
    inQuietHours(
      new Date(),
      body.quietStart ?? '22:00',
      body.quietEnd ?? '07:00',
    ) &&
    !body.force
  ) {
    return NextResponse.json({ skipped: true, reason: 'quiet_hours' })
  }

  const workspace = loadWorkspaceTwilio(tenantSlug)
  const cfg = toTwilioClientConfig(workspace)
  if (!workspace?.enabled || !cfg) {
    return NextResponse.json(
      { skipped: true, reason: 'workspace_twilio_not_configured' },
      { status: 200 },
    )
  }

  const channelSlug = (body.channelSlug || 'general').toLowerCase()
  const preview = body.messagePreview || ''
  const productName = body.productName || 'BEVEL'

  let voteUrls: ReturnType<typeof buildVoteUrls> | null = null
  if (body.includeVoteLinks !== false) {
    const origin =
      workspace.webhookBaseUrl ||
      process.env.AUTH_URL ||
      process.env.NEXTAUTH_URL ||
      new URL(request.url).origin
    const alert = createPendingAlert({
      tenantSlug,
      userKey,
      phoneE164: body.phoneE164,
      channelSlug,
      messagePreview: preview,
      messageId: body.messageId,
    })
    voteUrls = buildVoteUrls(origin, alert.token)
  }

  const smsBody = composePresenceSms({
    productName,
    channelSlug,
    preview,
    voteUrls,
  })

  try {
    const result = await sendSms({
      to: body.phoneE164,
      body: smsBody,
      cfg,
      allowSimulate: process.env.NODE_ENV !== 'production',
    })
    return NextResponse.json({
      ok: true,
      sid: result.sid,
      status: result.status,
      simulated: result.simulated ?? false,
      voteUrls,
    })
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : 'SMS send failed',
      },
      { status: 502 },
    )
  }
}
