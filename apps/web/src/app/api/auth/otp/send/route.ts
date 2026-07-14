import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import {
  checkOtpSendRateLimit,
  issueOtp,
  phoneOtpAllowedOnTenant,
  type OtpChannel,
} from '@bevel/auth'
import {
  getTenantFromRequest,
  isPlatformEntryHost,
  resolveWorkspacesForEmail,
} from '@bevel/tenant-config'
import { hasFeature } from '@bevel/schema'
import { sendSms } from '@/lib/twilio/client'
import {
  loadWorkspaceTwilio,
  toTwilioClientConfig,
} from '@/lib/twilio/workspace-config'

/**
 * POST /api/auth/otp/send
 * { channel: "email" | "sms", destination: string }
 *
 * Email: SMTP if configured, else log in development.
 * SMS: workspace Twilio (tenant host) or platform TWILIO_* env.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    channel?: string
    destination?: string
  }
  const channel = (body.channel === 'sms' ? 'sms' : 'email') as OtpChannel
  const destination = String(body.destination ?? '').trim()
  if (!destination) {
    return NextResponse.json(
      { error: 'destination required' },
      { status: 400 },
    )
  }

  const tenant = await getTenantFromRequest()
  const headerStore = await headers()
  const host = (
    headerStore.get('x-bevel-host') ??
    headerStore.get('x-forwarded-host') ??
    headerStore.get('host') ??
    ''
  )
    .toLowerCase()
    .split(':')[0]
  const platformEntry = isPlatformEntryHost(host)

  // Soft gate for email: only send if domain could ever sign in
  if (channel === 'email') {
    const email = destination.toLowerCase()
    if (platformEntry) {
      const { tenants } = resolveWorkspacesForEmail(email)
      const allowExact = Boolean(
        // allow any in dev if no tenants mapped — still issue for claim flow
        process.env.NODE_ENV === 'development' || tenants.length > 0,
      )
      if (!allowExact && tenants.length === 0) {
        // Don't leak allowlist — pretend success
        return NextResponse.json({
          ok: true,
          channel,
          delivered: false,
          masked: maskDestination(channel, email),
        })
      }
    }
  }

  // SMS gates before issueOtp — avoid orphaned codes and closed-org admits
  if (channel === 'sms') {
    if (!tenant || !hasFeature(tenant, 'otpSms')) {
      return NextResponse.json(
        {
          error:
            'Mobile OTP is available on paid BEVEL plans (Trial, Pro, Team, Enterprise). Use email code or Google, or upgrade this workspace.',
          plan: tenant?.plan ?? 'free',
          upgradeRequired: true,
        },
        { status: 402 },
      )
    }
    // Closed membership (allowed_domains / allowed_emails): phone alone cannot
    // prove org membership. Prefer Google or email OTP on the allowlist.
    if (!phoneOtpAllowedOnTenant(tenant)) {
      return NextResponse.json(
        {
          error:
            'Mobile sign-in is not available for this workspace. Use Google or an allowed email address.',
          closedMembership: true,
        },
        { status: 403 },
      )
    }
  }

  const clientIp =
    headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headerStore.get('x-real-ip')?.trim() ||
    'unknown'

  const rate = checkOtpSendRateLimit({
    channel,
    destination,
    clientIp,
  })
  if (!rate.ok) {
    return NextResponse.json(
      {
        error:
          rate.reason === 'destination_cooldown'
            ? 'Please wait before requesting another code.'
            : 'Too many sign-in attempts from this network. Try again later.',
        reason: rate.reason,
        retryAfterSec: rate.retryAfterSec,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rate.retryAfterSec),
        },
      },
    )
  }

  let issued: { code: string; expiresAt: string; destination: string }
  try {
    issued = issueOtp(channel, destination)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invalid destination' },
      { status: 400 },
    )
  }

  const product =
    tenant?.theme.productName || tenant?.name || 'BEVEL'
  let delivered = false
  let simulated = false

  if (channel === 'email') {
    const result = await deliverEmailOtp({
      to: issued.destination,
      code: issued.code,
      product,
    })
    delivered = result.delivered
    simulated = result.simulated
  } else {
    const slug = tenant!.slug
    const workspace = loadWorkspaceTwilio(slug)
    const cfg =
      toTwilioClientConfig(workspace) ??
      ({
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        fromNumber: process.env.TWILIO_PHONE_NUMBER,
      } as const)

    try {
      const sms = await sendSms({
        to: issued.destination,
        body: `${product} code: ${issued.code} (10 min)`,
        cfg,
        allowSimulate: true,
        maxBodyChars: 160,
      })
      delivered = true
      simulated = Boolean(sms.simulated)
    } catch (e) {
      return NextResponse.json(
        {
          error: e instanceof Error ? e.message : 'SMS delivery failed',
        },
        { status: 502 },
      )
    }
  }

  return NextResponse.json({
    ok: true,
    channel,
    delivered,
    simulated,
    masked: maskDestination(channel, issued.destination),
    expiresAt: issued.expiresAt,
    // Dev convenience only
    ...(process.env.NODE_ENV === 'development' && simulated
      ? { devCode: issued.code }
      : {}),
  })
}

function maskDestination(channel: OtpChannel, dest: string): string {
  if (channel === 'email') {
    const [user, domain] = dest.split('@')
    if (!domain) return '•••'
    const u = user.length <= 2 ? `${user[0] ?? ''}•` : `${user.slice(0, 2)}•••`
    return `${u}@${domain}`
  }
  const d = dest.replace(/\D/g, '')
  if (d.length < 4) return '•••'
  return `+•••${d.slice(-4)}`
}

async function deliverEmailOtp(opts: {
  to: string
  code: string
  product: string
}): Promise<{ delivered: boolean; simulated: boolean }> {
  const apiKey = process.env.RESEND_API_KEY || process.env.SENDGRID_API_KEY
  const from =
    process.env.AUTH_OTP_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    'noreply@bevel.local'

  if (process.env.RESEND_API_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: `${opts.product} sign-in code`,
        text: `Your ${opts.product} code is ${opts.code}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Resend failed: ${err.slice(0, 200)}`)
    }
    return { delivered: true, simulated: false }
  }

  if (process.env.SENDGRID_API_KEY) {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: opts.to }] }],
        from: { email: from },
        subject: `${opts.product} sign-in code`,
        content: [
          {
            type: 'text/plain',
            value: `Your ${opts.product} code is ${opts.code}. It expires in 10 minutes.`,
          },
        ],
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(`SendGrid failed: ${err.slice(0, 200)}`)
    }
    return { delivered: true, simulated: false }
  }

  // Development: log code (never in production without a provider)
  // eslint-disable-next-line no-console
  console.log(
    `[bevel:otp:email] → ${opts.to} code=${opts.code} (no RESEND/SENDGRID — simulated)`,
  )
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Email OTP requires RESEND_API_KEY or SENDGRID_API_KEY')
  }
  return { delivered: true, simulated: true }
}
