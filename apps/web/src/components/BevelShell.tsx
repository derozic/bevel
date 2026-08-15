'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import { XMarkIcon } from '@heroicons/react/24/outline'
import type {
  FeatureAccess,
  ResolvedFeatureSet,
  TenantPlan,
} from '@bevel/schema'
import { BevelRail, type FleetChannelSummary } from '@/components/BevelRail'
import type { SessionSummary } from '@/lib/realtime'
import {
  markBevelInputMode,
  useWorkspaceOverlayNav,
} from '@/lib/workspace-nav'

type BevelChatPaneContextValue = {
  openSidebar: () => void
}

const BevelChatPaneContext = createContext<BevelChatPaneContextValue | null>(null)

export function useBevelChatPane() {
  const ctx = useContext(BevelChatPaneContext)
  if (!ctx) {
    throw new Error('useBevelChatPane must be used within BevelShell')
  }
  return ctx
}

function activeRouteFromPath(pathname: string): {
  activeSlug?: string
  activeSessionId?: string
} {
  // Path routes: talk + session
  const sessionMatch = pathname.match(
    /(?:^\/session\/|^\/bevel\/session\/)([^/]+)/,
  )
  if (sessionMatch) {
    return { activeSessionId: decodeURIComponent(sessionMatch[1]!) }
  }
  const talkMatch = pathname.match(/(?:^\/talk\/|^\/bevel\/talk\/)([^/]+)/)
  if (talkMatch) {
    const agentId = decodeURIComponent(talkMatch[1]!).toLowerCase()
    return { activeSessionId: `talk:${agentId}` }
  }
  // Canonical: /~general (tilde path)
  const tildeMatch = pathname.match(/^\/(?:~|%7[eE])([a-z0-9][a-z0-9-]*)$/i)
  if (tildeMatch) {
    return { activeSlug: tildeMatch[1]!.toLowerCase() }
  }
  // Legacy caret
  const caretMatch = pathname.match(/^\/(?:\^|%5[eE])([a-z0-9][a-z0-9-]*)/i)
  if (caretMatch) {
    return { activeSlug: caretMatch[1]!.toLowerCase() }
  }
  const channelMatch = pathname.match(/^\/bevel\/([^/]+)/)
  if (channelMatch) {
    const slug = decodeURIComponent(channelMatch[1]!)
    if (slug !== 'session' && slug !== 'talk' && slug !== 'c') {
      return { activeSlug: slug }
    }
  }
  return {}
}

export function BevelShell({
  children,
  productName,
  platformHomeHref,
  platformHomeLabel,
  initialChannels,
  initialSessions,
  plan,
  featureAccess,
  featureSet,
  privateAgentsOnly = false,
}: {
  children: ReactNode
  /** Workspace brand label (rail) — e.g. "2x4m" not "2x4m Agents" */
  productName?: string
  /** Compact "← product" link (no second logo row) */
  platformHomeHref?: string
  platformHomeLabel?: string
  initialChannels?: FleetChannelSummary[]
  initialSessions?: SessionSummary[]
  plan?: TenantPlan | string
  featureAccess?: FeatureAccess | string
  featureSet?: ResolvedFeatureSet | null
  /** Apex private: agents + DMs only (no org ~channels) */
  privateAgentsOnly?: boolean
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const overlayNav = useWorkspaceOverlayNav()

  const { activeSlug, activeSessionId } = activeRouteFromPath(pathname ?? '')

  const openSidebar = useCallback(() => setSidebarOpen(true), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  useEffect(() => {
    markBevelInputMode()
  }, [])

  useEffect(() => {
    closeSidebar()
  }, [pathname, closeSidebar])

  useEffect(() => {
    if (!sidebarOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeSidebar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sidebarOpen, closeSidebar])

  return (
    <div className="bevel-workspace">
      {overlayNav && sidebarOpen ? (
        <button
          type="button"
          className="bevel-workspace-scrim"
          aria-label="Close channels"
          onPointerDown={closeSidebar}
        />
      ) : null}

      <aside
        className={`bevel-workspace-rail${overlayNav && sidebarOpen ? ' bevel-workspace-rail--open' : ''}`}
        aria-label="Channels"
      >
        <BevelRail
          productName={productName}
          platformHomeHref={platformHomeHref}
          platformHomeLabel={platformHomeLabel}
          activeSlug={activeSlug}
          activeSessionId={activeSessionId}
          initialChannels={privateAgentsOnly ? [] : initialChannels}
          initialSessions={initialSessions}
          privateAgentsOnly={privateAgentsOnly}
          plan={plan}
          featureAccess={featureAccess}
          featureSet={featureSet}
          onNavigate={closeSidebar}
          headerAction={
            <button
              type="button"
              className="bevel-rail-close-btn"
              aria-label="Close channels"
              onClick={closeSidebar}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          }
        />
      </aside>

      <main className="bevel-workspace-main bevel-workspace-main--chat">
        <BevelChatPaneContext.Provider value={{ openSidebar }}>
          {children}
        </BevelChatPaneContext.Provider>
      </main>
    </div>
  )
}