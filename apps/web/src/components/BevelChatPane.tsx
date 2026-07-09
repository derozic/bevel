'use client'

import { ChannelChatShell } from '@/components/ChannelChatShell'
import { useBevelChatPane } from '@/components/BevelShell'

export function BevelChatPane({
  roomMode = 'channel',
  channelSlug = 'general',
  sessionId,
  sessionTitle,
  initialAgents,
}: {
  roomMode?: 'channel' | 'session'
  channelSlug?: string
  sessionId?: string
  sessionTitle?: string
  initialAgents: string[]
}) {
  const { openSidebar } = useBevelChatPane()

  return (
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
  )
}