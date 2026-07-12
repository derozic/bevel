import { redirect } from 'next/navigation'
import { bevelTalkPath } from '@/lib/bevel'

/**
 * Short alias: /brain/chat → /bevel/talk/brain
 * Real session UI lives under /bevel so Auth + tenant chrome resolve cleanly.
 */
export default async function AgentChatAliasPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>
  searchParams: Promise<{ agents?: string; invite?: string }>
}) {
  const { agentId } = await params
  const { agents, invite } = await searchParams
  let href = bevelTalkPath(agentId, agents)
  if (invite?.trim()) {
    const sep = href.includes('?') ? '&' : '?'
    href = `${href}${sep}invite=${encodeURIComponent(invite)}`
  }
  redirect(href)
}
