'use client'

import { useCallback, useEffect, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { ChannelChatShell } from '@/components/ChannelChatShell'
import { BevelRail, type FleetChannelSummary } from '@/components/BevelRail'
import type { SessionSummary } from '@/lib/realtime'

export function BevelWorkspace({
  roomMode = 'channel',
  channelSlug = 'general',
  sessionId,
  sessionTitle,
  initialAgents,
  initialChannels,
  initialSessions,
}: {
  roomMode?: 'channel' | 'session'
  channelSlug?: string
  sessionId?: string
  sessionTitle?: string
  initialAgents: string[]
  initialChannels?: FleetChannelSummary[]
  initialSessions?: SessionSummary[]
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const openSidebar = useCallback(() => setSidebarOpen(true), [])
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  useEffect(() => {
    closeSidebar()
  }, [channelSlug, sessionId, closeSidebar])

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
          activeSlug={roomMode === 'channel' ? channelSlug : undefined}
          activeSessionId={roomMode === 'session' ? sessionId : undefined}
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

      <main className="bevel-workspace-main">
        <ChannelChatShell
          roomMode={roomMode}
          channelSlug={channelSlug}
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          initialAgents={initialAgents}
          fillViewport
          showChannelToggle
          onChannelToggle={openSidebar}
        />
      </main>
    </div>
  )
}

