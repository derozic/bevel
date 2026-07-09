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
import { BevelRail, type FleetChannelSummary } from '@/components/BevelRail'
import type { SessionSummary } from '@/lib/realtime'

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
  const sessionMatch = pathname.match(/\/bevel\/session\/([^/]+)/)
  if (sessionMatch) {
    return { activeSessionId: decodeURIComponent(sessionMatch[1]!) }
  }
  const channelMatch = pathname.match(/\/bevel\/([^/]+)/)
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
  initialChannels,
  initialSessions,
}: {
  children: ReactNode
  initialChannels?: FleetChannelSummary[]
  initialSessions?: SessionSummary[]
}) {
  const pathname = usePathname()
  const { activeSlug, activeSessionId } = activeRouteFromPath(pathname ?? '')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const openSidebar = useCallback(() => setSidebarOpen(true), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

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
      {sidebarOpen ? (
        <button
          type="button"
          className="bevel-workspace-scrim"
          aria-label="Close channels"
          onClick={closeSidebar}
        />
      ) : null}

      <aside
        className={`bevel-workspace-rail${sidebarOpen ? ' bevel-workspace-rail--open' : ''}`}
        aria-label="Channels"
      >
        <BevelRail
          activeSlug={activeSlug}
          activeSessionId={activeSessionId}
          initialChannels={initialChannels}
          initialSessions={initialSessions}
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