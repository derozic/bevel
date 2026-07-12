/**
 * Normalize Colyseus / fetch / unknown failures into a non-garbage string.
 * Never returns "undefined", "error undefined", or empty placeholders.
 */
export function formatFleetError(err: unknown): string {
  if (err == null) return ''

  if (typeof err === 'string') {
    return sanitizeErrorText(err)
  }

  if (err instanceof Error) {
    // MatchMakeError / ServerError carry .code
    const code =
      'code' in err && (err as { code?: unknown }).code != null
        ? String((err as { code?: unknown }).code)
        : ''
    const msg = sanitizeErrorText(err.message)
    if (msg) return msg
    if (code && code !== 'undefined' && code !== 'NaN') {
      return `Connection error ${code}`
    }
    return ''
  }

  if (typeof err === 'object') {
    const o = err as Record<string, unknown>
    const msg = sanitizeErrorText(
      typeof o.message === 'string'
        ? o.message
        : typeof o.error === 'string'
          ? o.error
          : typeof o.reason === 'string'
            ? o.reason
            : '',
    )
    if (msg) return msg
  }

  return ''
}

/** Drop Colyseus/browser placeholders that render as "error undefined". */
export function sanitizeErrorText(raw: string | null | undefined): string {
  if (raw == null) return ''
  const t = String(raw).trim()
  if (!t) return ''
  if (t === 'undefined' || t === 'null' || t === 'NaN') return ''
  if (/^error\s+undefined$/i.test(t)) return ''
  if (/^undefined$/i.test(t)) return ''
  // "error  " with nothing useful after
  if (/^error\s*$/i.test(t)) return ''
  return t
}

export function formatRoomErrorEvent(
  code: unknown,
  message: unknown,
): string {
  const msg = sanitizeErrorText(
    typeof message === 'string' ? message : message != null ? String(message) : '',
  )
  if (msg) return msg

  if (typeof code === 'number' && Number.isFinite(code) && code > 0) {
    // Common WS close codes
    if (code === 1000) return 'Connection closed'
    if (code === 1001) return 'Connection going away'
    if (code === 1006) return 'Connection lost (abnormal close)'
    if (code === 1011) return 'Server error while joining room'
    if (code === 4000) return 'Seat reservation expired — retrying…'
    if (code === 401 || code === 4001) return 'Sign in required'
    return `Room error ${code}`
  }

  if (typeof code === 'string') {
    const c = sanitizeErrorText(code)
    if (c) return `Room error ${c}`
  }

  return 'Connection dropped'
}
