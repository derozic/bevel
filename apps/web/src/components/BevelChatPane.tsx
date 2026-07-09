'use client'

import { ChannelChatShell } from '@/components/ChannelChatShell'
import { useBevelChatPane } from '@/components/BevelShell'

export function BevelChatPane({
  roomMode = 'channel',
  channelSlug = 'general',
  sessionId,
  sessionTitle,
  initialAgents,
  focusMessageId,
  highlightQuery,
}: {
  roomMode?: 'channel' | 'session'
  channelSlug?: string
  sessionId?: string
  sessionTitle?: string
  initialAgents: string[]
  focusMessageId?: string
  highlightQuery?: string
}) {
  const { openSidebar } = useBevelChatPane()

  return (
    <ChannelChatShell
      roomMode={roomMode}
      channelSlug={channelSlug}
      sessionId={sessionId}
      sessionTitle={sessionTitle}
      initialAgents={initialAgents}
      focusMessageId={focusMessageId}
      highlightQuery={highlightQuery}
      fillViewport
      showChannelToggle
      onChannelToggle={openSidebar}
    />
  )
}