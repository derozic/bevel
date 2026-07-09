import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { agentChatPath } from '@/lib/agent-bevel-session'
import { getAgentById } from '@/lib/agent-catalog'
import { BEVEL_TAGLINE, bevelPageTitle } from '@/lib/bevel'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agentId: string }>
}): Promise<Metadata> {
  const { agentId } = await params
  const agent = getAgentById(agentId)
  const name = agent?.name ?? agentId
  return {
    title: bevelPageTitle(name),
    description: BEVEL_TAGLINE,
  }
}

/** Legacy path — canonical direct chat is /:agent/chat */
export default async function BevelTalkRedirectPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>
  searchParams: Promise<{ agents?: string }>
}) {
  const { agentId } = await params
  const { agents: agentsParam } = await searchParams
  redirect(agentChatPath(agentId, agentsParam))
}