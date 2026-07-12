'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { BEVEL_COPY, bevelChannelHref, bevelTalkPath } from '@/lib/bevel'
import { parseChatAgentsParam } from '@/lib/chat-agents'

/**
 * Resolves workspace entry + #channel hash → canonical `/^slug` on first paint.
 */
export function BevelEntry() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const agents = searchParams.get('agents') ?? undefined

  useEffect(() => {
    const parsed = parseChatAgentsParam(agents)
    if (parsed && parsed.length >= 1) {
      router.replace(bevelTalkPath(parsed[0]!, agents ?? undefined))
      return
    }

    const hashSlug = window.location.hash.replace(/^#/, '').trim()
    const slug = hashSlug || 'general'
    router.replace(bevelChannelHref(slug, agents))
  }, [router, agents])

  return <p className="px-6 text-sm text-ink-500">{BEVEL_COPY.openingChannel}</p>
}