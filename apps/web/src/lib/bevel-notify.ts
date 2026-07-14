/**
 * Cross-client notification bridge.
 * - PWA / browser: Service Worker + Notification API
 * - Flutter / macOS desktop: listen for the same message schema over realtime
 *   or POST /api/agent-programs/events (already becomes a channel message).
 */

export type BevelNotifyPayload = {
  title: string
  body: string
  icon?: string
  tag?: string
  url?: string
  agentId?: string
  programId?: string
  severity?: 'info' | 'warning' | 'critical'
}

export async function registerBevelServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
    return reg
  } catch {
    return null
  }
}

export async function ensureNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

/** Show a local notification via SW when available, else bare Notification API. */
export async function showBevelNotification(
  payload: BevelNotifyPayload,
): Promise<boolean> {
  if (typeof window === 'undefined') return false
  if (typeof Notification === 'undefined') return false
  if (Notification.permission !== 'granted') return false

  const reg = await navigator.serviceWorker?.getRegistration()
  if (reg?.active) {
    reg.active.postMessage({
      type: 'bevel:notify',
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/icon-192.png',
      tag: payload.tag || `bevel-${payload.agentId || 'agent'}`,
      url: payload.url || '/^general',
      renotify: payload.severity === 'critical' || payload.severity === 'warning',
    })
    return true
  }

  try {
    // eslint-disable-next-line no-new
    new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192.png',
      tag: payload.tag,
    })
    return true
  } catch {
    return false
  }
}

export function isAgentProgramMessage(body: string, agentId?: string): boolean {
  if (agentId === 'johnny') return true
  return /^(JOHNNY|\[program\]|program:)/i.test(body.trim())
}
