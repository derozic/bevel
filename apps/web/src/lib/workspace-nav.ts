'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

/** Keep in sync with `.bevel-workspace` split in bevel-workspace.css (56.25rem). */
export const WORKSPACE_SPLIT_MIN = '(min-width: 56.25rem)'

const SOFT_WORKSPACE_PREFIX = /^\/(talk|session|timeline|tags)(\/|$)/
const TILDE_CHANNEL = /^\/~[a-z0-9][a-z0-9-]*$/i

/**
 * Map internal /bevel/* talk+session URLs to the public paths next.config rewrites.
 * Hitting /bevel/talk/* goes through middleware 308 and full-reloads the shell.
 */
export function canonicalizeWorkspacePath(pathname: string): string {
  const path = pathname.split('?')[0]?.split('#')[0] || ''
  const talk = path.match(/^\/bevel\/talk(?:\/(.*))?$/)
  if (talk) return talk[1] ? `/talk/${talk[1]}` : '/talk'
  const session = path.match(/^\/bevel\/session\/(.+)$/)
  if (session) return `/session/${session[1]}`
  if (path === '/bevel/me') return '/me'
  if (path === '/bevel/timeline' || path.startsWith('/bevel/timeline/')) {
    return path.replace(/^\/bevel/, '')
  }
  return path
}

/**
 * Workspace paths that must stay inside the App Router. A plain <a href>
 * (including the portaled agent-chip Message button) does a full document
 * load — native WebView paints its loading overlay, the rail remounts.
 */
export function isSoftWorkspacePath(pathname: string): boolean {
  const path = canonicalizeWorkspacePath(pathname)
  if (path === '/me' || path === '/talk' || path === '/timeline' || path === '/tags') {
    return true
  }
  if (SOFT_WORKSPACE_PREFIX.test(path)) return true
  return TILDE_CHANNEL.test(path)
}

export function resolveSoftWorkspaceHref(
  anchor: Pick<
    HTMLAnchorElement,
    'getAttribute' | 'hasAttribute' | 'target'
  >,
  origin: string,
): string | null {
  const raw = anchor.getAttribute('href')
  if (!raw) return null
  if (anchor.target && anchor.target !== '_self') return null
  if (anchor.hasAttribute('download')) return null
  const rel = anchor.getAttribute('rel') ?? ''
  if (rel.split(/\s+/).includes('external')) return null
  let url: URL
  try {
    url = new URL(raw, origin)
  } catch {
    return null
  }
  if (url.origin !== origin) return null
  if (!isSoftWorkspacePath(url.pathname)) return null
  const path = canonicalizeWorkspacePath(url.pathname)
  return `${path}${url.search}${url.hash}`
}

function isModifiedClick(event: MouseEvent): boolean {
  return (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
}

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

/**
 * Intercept same-origin workspace <a> clicks (bubble phase, after Next.js Link)
 * so portaled Message / Talk links do not full-reload the shell.
 */
export function useSoftWorkspaceLinks(): void {
  const router = useRouter()

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || isModifiedClick(event)) return
      const target = event.target
      if (!(target instanceof Element)) return
      const anchor = target.closest('a')
      if (!(anchor instanceof HTMLAnchorElement)) return
      const href = resolveSoftWorkspaceHref(anchor, window.location.origin)
      if (!href) return
      event.preventDefault()
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
      if (href === current) return
      router.push(href)
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [router])
}
