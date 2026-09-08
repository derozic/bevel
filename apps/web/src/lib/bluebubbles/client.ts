/**
 * iMessage send client.
 *
 * Preferred host is the BEVEL Silicon app (BlueBubbles v1 subset on
 * 127.0.0.1:1234). A leftover BlueBubbles.app is optional, never required.
 * See docs/IMESSAGE.md.
 *
 * API shape (BlueBubbles server v1.x, also spoken by BEVEL):
 *   POST {url}/api/v1/message/text
 *   Headers: Authorization or password query
 *   Body: { chatGuid | address, message, method?: "apple-script" }
 */

export type BlueBubblesConfig = {
  /** Base URL, e.g. http://127.0.0.1:1234 or http://100.x.y.z:1234 */
  url: string
  /** Server password from BlueBubbles → Settings → API */
  password: string
}

export type SendIMessageResult = {
  ok: boolean
  status: number
  simulated?: boolean
  error?: string
  raw?: unknown
}

export function getBlueBubblesConfigFromEnv(): Partial<BlueBubblesConfig> {
  const url = (
    process.env.BEVEL_IMESSAGE_URL ||
    process.env.BLUEBUBBLES_URL ||
    'http://127.0.0.1:1234'
  ).replace(/\/$/, '')
  const password =
    process.env.BEVEL_IMESSAGE_PASSWORD || process.env.BLUEBUBBLES_PASSWORD || ''
  return { url, password }
}

export function isBlueBubblesConfigured(
  cfg: Partial<BlueBubblesConfig> | null | undefined,
): cfg is BlueBubblesConfig {
  if (!cfg) return false
  return Boolean(cfg.url?.trim() && cfg.password?.trim())
}

/**
 * Normalize phone to E.164-ish digits for chat address.
 * BlueBubbles often wants chatGuid `iMessage;-;+1…` or bare address.
 */
export function imessageAddress(to: string): string {
  const t = to.trim()
  if (t.includes('@')) return t // email Apple ID
  const digits = t.replace(/\D/g, '')
  if (t.startsWith('+')) return `+${digits}`
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`
  return t.startsWith('+') ? t : `+${digits}`
}

/**
 * Send a plain iMessage via BlueBubbles.
 * When not configured and allowSimulate, logs and returns simulated success (dev).
 */
export async function sendIMessage(opts: {
  to: string
  body: string
  cfg?: Partial<BlueBubblesConfig> | null
  allowSimulate?: boolean
}): Promise<SendIMessageResult> {
  const cfg = opts.cfg ?? getBlueBubblesConfigFromEnv()
  const address = imessageAddress(opts.to)
  const message = opts.body.trim()

  if (!message) {
    return { ok: false, status: 400, error: 'Message body required' }
  }

  if (!isBlueBubblesConfigured(cfg)) {
    if (opts.allowSimulate ?? process.env.NODE_ENV !== 'production') {
      console.info(
        '[bluebubbles] simulated iMessage',
        { to: address, body: message.slice(0, 120) },
      )
      return {
        ok: true,
        status: 200,
        simulated: true,
        raw: { simulated: true, address, message },
      }
    }
    return {
      ok: false,
      status: 503,
      error:
        'iMessage host not configured. Enable it in the BEVEL Mac app (Native integrations → iMessage), or set BEVEL_IMESSAGE_URL + BEVEL_IMESSAGE_PASSWORD.',
    }
  }

  const base = cfg.url.replace(/\/$/, '')
  const passQ = `password=${encodeURIComponent(cfg.password)}`
  // BlueBubbles authenticates via ?password= query param (primary).
  const candidates = [
    `${base}/api/v1/message/text?${passQ}`,
    `${base}/api/v1/message?${passQ}`,
    `${base}/message/text?${passQ}`,
  ]

  // AppleScript requires a unique tempGuid per attempt.
  const methodEnv = process.env.BLUEBUBBLES_METHOD?.trim()
  const methods = methodEnv
    ? [methodEnv]
    : ['apple-script', 'private-api']

  let lastError = 'No endpoint responded'
  for (const method of methods) {
    const tempGuid = `bevel-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`
    const payload: Record<string, unknown> = {
      chatGuid: `iMessage;-;${address}`,
      address,
      message,
      method,
      tempGuid,
    }
    for (const url of candidates) {
      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.password}`,
          },
          body: JSON.stringify(payload),
          // Keep under 12s so UI / API don't hang on stuck Messages.app
          signal: AbortSignal.timeout(12_000),
        })
        const text = await res.text()
        let raw: unknown = text
        try {
          raw = text ? JSON.parse(text) : null
        } catch {
          /* keep text */
        }
        if (res.ok) {
          return { ok: true, status: res.status, raw }
        }
        lastError = `HTTP ${res.status}: ${text.slice(0, 200)}`
        const msg =
          typeof raw === 'object' && raw
            ? JSON.stringify(raw)
            : text
        // Duplicate queue from a prior attempt = effectively sent/queued
        if (/already queued/i.test(msg)) {
          return { ok: true, status: 200, raw, simulated: false }
        }
        if (res.status === 401 || res.status === 403) {
          return { ok: false, status: res.status, error: lastError, raw }
        }
        if (
          res.status === 500 &&
          /Private API is not enabled/i.test(msg)
        ) {
          break // next method
        }
        if (res.status === 404) {
          continue // next URL shape
        }
        // other errors: try next method (not every URL with same payload)
        break
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e)
      }
    }
  }

  return { ok: false, status: 502, error: lastError }
}
