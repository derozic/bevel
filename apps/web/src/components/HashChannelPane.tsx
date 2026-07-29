'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { BevelChatPane } from '@/components/BevelChatPane'
import {
  BEVEL_DEFAULT_CHANNEL,
  normalizeBevelChannelSlug,
} from '@/lib/bevel'
import { resolveChatAgents } from '@/lib/chat-agents'

/**
 * Workspace channel selected via URL hash: `/#general`, `/?msg=…#product`.
 * Hash is never sent to the server — this client bridge is required.
 */
export function HashChannelPane() {
  const searchParams = useSearchParams()
  const [slug, setSlug] = useState(BEVEL_DEFAULT_CHANNEL)

  useEffect(() => {
    const apply = () => {
      const raw = window.location.hash.replace(/^#/, '')
      const next = normalizeBevelChannelSlug(raw || BEVEL_DEFAULT_CHANNEL)
      setSlug(next)
      // Ensure bare `/` becomes `/#general` without a navigation flash.
      if (!window.location.hash) {
        const url = `${window.location.pathname}${window.location.search}#${next}`
        window.history.replaceState(null, '', url)
      }
    }
    apply()
    window.addEventListener('hashchange', apply)
    return () => window.removeEventListener('hashchange', apply)
  }, [])

  const agentsParam = searchParams.get('agents') ?? undefined
  const msg = searchParams.get('msg') ?? undefined
  const q = searchParams.get('q') ?? undefined
  const initialAgents = resolveChatAgents(agentsParam)

  return (
    <BevelChatPane
      channelSlug={slug}
      initialAgents={initialAgents}
      focusMessageId={msg}
      highlightQuery={q}
    />
  )
}
