import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireTenantFromRequest } from '@bevel/tenant-config'
import { auth } from '@/auth'
import {
  AgentBevelSessionView,
  agentChatPath,
} from '@/lib/agent-bevel-session'
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
  const tenant = await requireTenantFromRequest().catch(() => null)
  const workspace = tenant?.theme.productName ?? tenant?.name
  return {
    title: bevelPageTitle(name, workspace),
    description: agent?.bio ?? BEVEL_TAGLINE,
  }
}

/**
 * Direct agent thread — /bevel/talk/brain (and multi via ?agents=).
 * Canonical under /bevel so tenant layout + auth resolve cleanly.
 */
export default async function BevelTalkAgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ agentId: string }>
  searchParams: Promise<{ agents?: string; invite?: string }>
}) {
  const session = await auth()
  const { agentId } = await params
  const { agents: agentsParam } = await searchParams
  const callbackPath = agentChatPath(agentId, agentsParam)

  return (
    <AgentBevelSessionView
      session={session}
      agentId={agentId}
      agentsParam={agentsParam}
      callbackPath={callbackPath}
    />
  )
}
