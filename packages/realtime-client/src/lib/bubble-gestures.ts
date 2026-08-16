import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'
import type { GestureKind } from '@bevel/schema'

export const SWIPE_PX = 40
export const LONG_PRESS_MS = 280
export const DOUBLE_TAP_MS = 320

export function isPlayfulTouch(): boolean {
  if (typeof window === 'undefined') return false
  if (document.documentElement.hasAttribute('data-bevel-native')) return true
  if (/BevelNative/i.test(navigator.userAgent)) return true
  return window.matchMedia('(hover: none), (pointer: coarse)').matches
}

export function resolveSwipeKind(dx: number, dy: number): GestureKind | null {
  if (Math.abs(dx) < SWIPE_PX) return null
  if (Math.abs(dy) > Math.abs(dx) * 0.75) return null
  return dx > 0 ? 'up' : 'down'
}

export function notifyNativeGesture(kind: string): void {
  if (typeof window === 'undefined') return
  try {
    const bridge = (
      window as unknown as {
        BevelHaptics?: { postMessage: (m: string) => void }
      }
    ).BevelHaptics
    bridge?.postMessage(kind)
  } catch {
    /* desktop / no bridge */
  }
  window.dispatchEvent(new CustomEvent('bevel:gesture', { detail: { kind } }))
}

type Handlers = {
  onPointerDown: (e: ReactPointerEvent) => void
  onPointerMove: (e: ReactPointerEvent) => void
  onPointerUp: (e: ReactPointerEvent) => void
  onPointerCancel: () => void
  onContextMenu: (e: { preventDefault: () => void }) => void
}

export function useBubbleGestures(opts: {
  enabled: boolean
  onGesture: (kind: GestureKind) => void
  onOpenDock: () => void
  /** Tap (not swipe) also opens the thumb tray — easier than a long-press. */
  openDockOnTap?: boolean
}): Handlers {
  const start = useRef<{ x: number; y: number; t: number } | null>(null)
  const lastTap = useRef(0)
  const longTimer = useRef<number | null>(null)
  const swiped = useRef(false)
  const opened = useRef(false)
  const optsRef = useRef(opts)
  optsRef.current = opts

  useEffect(
    () => () => {
      if (longTimer.current) window.clearTimeout(longTimer.current)
    },
    [],
  )

  const clearTimer = () => {
    if (longTimer.current) {
      window.clearTimeout(longTimer.current)
      longTimer.current = null
    }
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!optsRef.current.enabled) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    swiped.current = false
    opened.current = false
    start.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    clearTimer()
    longTimer.current = window.setTimeout(() => {
      opened.current = true
      notifyNativeGesture('dock')
      optsRef.current.onOpenDock()
    }, LONG_PRESS_MS)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const s = start.current
    if (!s) return
    const dx = e.clientX - s.x
    const dy = e.clientY - s.y
    if (Math.abs(dx) > 12 || Math.abs(dy) > 12) clearTimer()
    if (Math.abs(dy) > 16 && Math.abs(dy) > Math.abs(dx)) {
      start.current = null
      return
    }
    if (resolveSwipeKind(dx, dy) && !swiped.current) {
      swiped.current = true
    }
  }

  const finish = (e: ReactPointerEvent | null) => {
    const s = start.current
    clearTimer()
    start.current = null
    if (!s || !optsRef.current.enabled) return
    if (opened.current) return
    if (e) {
      const kind = resolveSwipeKind(e.clientX - s.x, e.clientY - s.y)
      if (kind) {
        notifyNativeGesture(kind)
        optsRef.current.onGesture(kind)
        return
      }
    }
    const now = Date.now()
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0
      notifyNativeGesture('heart')
      optsRef.current.onGesture('heart')
      return
    }
    lastTap.current = now
    if (optsRef.current.openDockOnTap) {
      notifyNativeGesture('dock')
      optsRef.current.onOpenDock()
    }
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: finish,
    onPointerCancel: () => {
      clearTimer()
      start.current = null
    },
    onContextMenu: (e) => {
      if (!optsRef.current.enabled) return
      e.preventDefault()
    },
  }
}
