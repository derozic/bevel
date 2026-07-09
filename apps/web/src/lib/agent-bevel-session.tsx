import { notFound, redirect } from 'next/navigation'
import type { Session } from 'next-auth'
import { BevelWorkspace } from '@/components/BevelWorkspace'
import { getAgentById } from '@/lib/agent-catalog'
import {
  bevelConversationTitle,
  bevelDirectSessionId,
  bevelTalkPath,
} from '@/lib/bevel'
import { parseChatAgentsParam } from '@/lib/chat-agents'
import { fetchFleetChannels } from '@/lib/fleet-channels.server'
import { fetchSessionSummaries } from '@/lib/realtime-server'

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

  if (!session?.user?.id) {
    redirect(`/auth/signin?callbackUrl=${encodeURIComponent(callbackPath)}`)
  }

  const directSessionId = bevelDirectSessionId(session.user.id, agentIds)
  const [initialChannels, initialSessions] = await Promise.all([
    fetchFleetChannels(session),
    fetchSessionSummaries().catch(() => []),
  ])

  return (
    <div className="bevel-workspace-root">
      <BevelWorkspace
        roomMode="session"
        sessionId={directSessionId}
        sessionTitle={sessionTitle}
        initialAgents={agentIds}
        initialChannels={initialChannels}
        initialSessions={initialSessions}
      />
    </div>
  )
}

export function agentChatPath(agentId: string, agents?: string): string {
  const id = agentId.trim().toLowerCase()
  const base = `/${encodeURIComponent(id)}/chat`
  if (!agents?.trim()) return base
  return `${base}?agents=${encodeURIComponent(agents)}`
}

/** Canonical BEVEL talk URL — prefers /:agent/chat (always registered). */
export function resolveAgentTalkHref(agentId: string, agents?: string): string {
  return agentChatPath(agentId, agents)
}

export { bevelTalkPath }