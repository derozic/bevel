/** Magenta / analytics hook for console events (no-op if Magenta unavailable). */
export function trackWebEvent(name: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  try {
    const w = window as unknown as {
      _magenta?: { track?: (n: string, p?: Record<string, unknown>) => void }
    }
    w._magenta?.track?.(name, props)
  } catch {
    // ignore
  }
}
