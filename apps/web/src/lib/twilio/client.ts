/**
 * Cheapest Twilio path: Programmable Messaging REST only.
 *
 * - No SDK (zero npm weight)
 * - No Verify product (~$0.05+/check)
 * - No Messaging Service SID (extra product surface)
 * - Just: Account SID + Auth Token + From number → POST Messages.json
 *
 * Pay-as-you-go SMS segments only. Own OTP codes in BEVEL, deliver as plain SMS.
 */

export type TwilioConfig = {
  accountSid: string
  authToken: string
  /** E.164 long code / toll-free From number (cheapest for low volume). */
  fromNumber: string
}

export type SendSmsResult = {
  sid: string
  status: string
  simulated?: boolean
  /** Rough outbound segment estimate (GSM-7 ~160, UCS-2 ~70). */
  segments?: number
}

/** Normalize to E.164; defaults US (+1) for 10-digit input. */
export function normalizePhoneE164(raw: string, defaultCountry = '1'): string {
  const digits = raw.replace(/\D/g, '')
  if (!digits) throw new Error('Phone number is required')
  if (raw.trim().startsWith('+')) return `+${digits}`
  if (digits.length === 10) return `+${defaultCountry}${digits}`
  if (digits.length === 11 && digits.startsWith(defaultCountry)) return `+${digits}`
  return `+${digits}`
}

export function isTwilioConfigured(
  cfg: Partial<TwilioConfig> | null | undefined,
): cfg is TwilioConfig {
  if (!cfg) return false
  return Boolean(
    cfg.accountSid?.trim() &&
      cfg.authToken?.trim() &&
      cfg.fromNumber?.trim(),
  )
}

/** GSM-7 if possible, else UCS-2 — for cost-aware body trimming. */
export function estimateSmsSegments(body: string): number {
  // Rough: non-GSM → UCS-2
  // eslint-disable-next-line no-control-regex
  const gsm =
    /^[\x00-\x7F€£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà\n\r]*$/.test(
      body,
    )
  const limit = gsm ? 160 : 70
  const multi = gsm ? 153 : 67
  if (body.length <= limit) return 1
  return Math.ceil(body.length / multi)
}

/**
 * Prefer single-segment bodies when possible (cheaper).
 * Truncates with ellipsis if over maxChars (default 160 GSM).
 */
export function trimSmsBody(body: string, maxChars = 160): string {
  const t = body.trim()
  if (t.length <= maxChars) return t
  return `${t.slice(0, Math.max(0, maxChars - 1))}…`
}

export async function sendSms(opts: {
  to: string
  body: string
  cfg: Partial<TwilioConfig> | null
  /** When true and Twilio is missing, log and return simulated (dev). */
  allowSimulate?: boolean
  /** Cap body length to control segments (default 320 ≈ 2 GSM segments). */
  maxBodyChars?: number
}): Promise<SendSmsResult> {
  const to = normalizePhoneE164(opts.to)
  const cfg = opts.cfg
  const body = trimSmsBody(opts.body, opts.maxBodyChars ?? 320)

  if (!isTwilioConfigured(cfg)) {
    if (opts.allowSimulate !== false) {
      // eslint-disable-next-line no-console
      console.log(
        `[bevel:twilio:simulate] SMS → ${to} (~${estimateSmsSegments(body)} seg): ${body}`,
      )
      return {
        sid: `sim_${Date.now()}`,
        status: 'simulated',
        simulated: true,
        segments: estimateSmsSegments(body),
      }
    }
    throw new Error('Twilio is not configured for this workspace')
  }

  const auth = Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString(
    'base64',
  )
  // Bare metal: From + To + Body only
  const params = new URLSearchParams({
    To: to,
    From: cfg.fromNumber.trim(),
    Body: body,
  })

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(cfg.accountSid)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    },
  )

  const data = (await res.json().catch(() => ({}))) as {
    sid?: string
    status?: string
    message?: string
    error_message?: string
    num_segments?: string
  }

  if (!res.ok) {
    throw new Error(
      data.message ||
        data.error_message ||
        `Twilio Messages API failed (${res.status})`,
    )
  }

  return {
    sid: data.sid ?? `tw_${Date.now()}`,
    status: data.status ?? 'queued',
    segments: data.num_segments
      ? Number(data.num_segments)
      : estimateSmsSegments(body),
  }
}

/**
 * Validate Twilio request signature (HMAC-SHA1 of url + sorted params).
 * @see https://www.twilio.com/docs/usage/security#validating-requests
 */
export async function validateTwilioSignature(opts: {
  authToken: string
  signature: string
  url: string
  params: Record<string, string>
}): Promise<boolean> {
  const { authToken, signature, url, params } = opts
  if (!authToken || !signature) return false

  const keys = Object.keys(params).sort()
  let data = url
  for (const key of keys) {
    data += key + params[key]
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(data),
  )
  const expected = Buffer.from(sig).toString('base64')
  return expected === signature
}
