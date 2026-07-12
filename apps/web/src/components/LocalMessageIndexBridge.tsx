'use client'

import { useEffect } from 'react'
import { localMessageIndex } from '@/lib/local-message-index'

type RoomMessagesDetail = {
  roomKey: string
  channelSlug: string
  isChannel: boolean
  sessionId: string
  messages: Array<{
    id: string
    speaker: string
    body: string
    ts: number
    speakerType?: string
  }>
}

/**
 * Listens for FleetChat message batches and feeds the in-tab search index.
 * Mount once under the workspace shell.
 */
export function LocalMessageIndexBridge() {
  useEffect(() => {
    const onRoom = (ev: Event) => {
      const detail = (ev as CustomEvent<RoomMessagesDetail>).detail
      if (!detail?.messages?.length) return
      const sessionId = detail.sessionId || detail.channelSlug
      localMessageIndex.clearRoom(sessionId)
      localMessageIndex.upsertMany(
        detail.messages
          .filter((m) => m.speakerType !== 'system' || Boolean(m.body?.trim()))
          .map((m) => ({
            key: `${sessionId}::${m.id}`,
            messageId: m.id,
            sessionId,
            kind: detail.isChannel ? ('channel' as const) : ('session' as const),
            channelSlug: detail.isChannel ? detail.channelSlug : undefined,
            speaker: m.speaker,
            body: m.body,
            ts: m.ts || Date.now(),
          })),
      )
    }
    window.addEventListener('bevel:room-messages', onRoom as EventListener)
    return () =>
      window.removeEventListener('bevel:room-messages', onRoom as EventListener)
  }, [])
  return null
}
