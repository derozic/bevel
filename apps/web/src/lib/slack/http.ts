/**
 * Shared Slack HTTP helpers: timeouts, safe errors, no secret leakage.
 */

export const SLACK_HTTP_TIMEOUT_MS = 12_000

export class SlackHttpError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'SlackHttpError'
  }
}

/** Fetch Slack APIs with a hard timeout (reliability under network stalls). */
export async function slackFetch(
  url: string,
  init: RequestInit = {},
  timeoutMs = SLACK_HTTP_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      ...init,
      signal: init.signal ?? controller.signal,
    })
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new SlackHttpError('Slack API request timed out', 504, 'timeout')
    }
    throw e
  } finally {
    clearTimeout(timer)
  }
}

export async function slackApiJson<T extends { ok?: boolean; error?: string }>(
  url: string,
  init: RequestInit = {},
  timeoutMs = SLACK_HTTP_TIMEOUT_MS,
): Promise<T> {
  const res = await slackFetch(url, init, timeoutMs)
  let data: T
  try {
    data = (await res.json()) as T
  } catch {
    throw new SlackHttpError(
      `Slack API returned non-JSON (${res.status})`,
      res.status,
      'bad_json',
    )
  }
  return data
}

/** Timing-safe string compare for signatures (Web Crypto when available). */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return out === 0
}
