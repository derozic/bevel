'use client'

import { useEffect, useState } from 'react'

/** Keep in sync with `.bevel-workspace` split in bevel-workspace.css (56.25rem). */
export const WORKSPACE_SPLIT_MIN = '(min-width: 56.25rem)'

/**
 * True when the rail is an overlay drawer (phone / iPad portrait), not a
 * persistent split column. JS must match CSS so we never mount a full-screen
 * scrim on top of a visible split rail (iPad Safari hover + daypart stacking).
 */
export function useWorkspaceOverlayNav(): boolean {
  const [overlay, setOverlay] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: 56.249rem)`)
    const sync = () => setOverlay(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return overlay
}

/**
 * iPad Pro reports (hover: hover) and often (pointer: fine) because of
 * pencil/trackpad, but fingers still generate sticky :hover. Mark the
 * document so CSS can turn hover-only overlays off.
 */
export function markBevelInputMode(): void {
  if (typeof document === 'undefined') return
  const coarse = window.matchMedia('(pointer: coarse)').matches
  const touch = navigator.maxTouchPoints > 0 || coarse
  const root = document.documentElement
  if (touch) root.dataset.bevelTouch = '1'
  else delete root.dataset.bevelTouch
}
