import { notFound, redirect } from 'next/navigation'
import type { Session } from 'next-auth'
import { BevelChatPane } from '@/components/BevelChatPane'
import { getAgentById } from '@/lib/agent-catalog'
import {
  bevelConversationTitle,
  bevelDirectSessionId,
  bevelTalkPath,
} from '@/lib/bevel'
import { parseChatAgentsParam } from '@/lib/chat-agents'
import { sessionActorId } from '@/lib/session-user'

/**
 * Direct agent session body — rendered inside /bevel layout (BevelShell).
 * Uses BevelChatPane so we do not double-nest workspace rails.
 */
export async function AgentBevelSessionView({
  session,
  agentId,
  agentsParam,
  callbackPath,
}: {
  session: Session | null
  agentId: string
  agentsParam?: string
  callbackPath: string
}) {
  const primaryId = agentId.trim().toLowerCase()
  const primary = getAgentById(primaryId)
  if (!primary) {
    notFound()
  }

  const rosterParam = parseChatAgentsParam(agentsParam)
  const agentIds = rosterParam?.includes(primaryId)
    ? rosterParam
    : rosterParam
      ? [primaryId, ...rosterParam.filter((id) => id !== primaryId)]
      : [primaryId]

  const agentNames = agentIds.map((id) => getAgentById(id)?.name ?? id)
  const sessionTitle = bevelConversationTitle(agentNames)

  const actorId = sessionActorId(session)
  // Email-only sessions must not redirect to /login — login sees email and
  // sends them right back here (full-page flicker).
  if (!actorId) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`)
  }

  const directSessionId = bevelDirectSessionId(actorId, agentIds)

  return (
    <BevelChatPane
      roomMode="session"
      sessionId={directSessionId}
      sessionTitle={sessionTitle}
      initialAgents={agentIds}
    />
  )
}

export function agentChatPath(agentId: string, agents?: string): string {
  return bevelTalkPath(agentId, agents)
}

/** Canonical BEVEL talk URL — /talk/:agent. */
export function resolveAgentTalkHref(agentId: string, agents?: string): string {
  return bevelTalkPath(agentId, agents)
}

export { bevelTalkPath }
