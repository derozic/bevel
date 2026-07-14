import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireTenantFromRequest } from '@bevel/tenant-config'
import { auth } from '@/auth'
import { BevelChatPane } from '@/components/BevelChatPane'
import { getAgentById } from '@/lib/agent-catalog'
import {
  BEVEL_TAGLINE,
  bevelPageTitle,
  bevelSessionPath,
} from '@/lib/bevel'
import { fetchSessionSummaries } from '@/lib/realtime-server'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const tenant = await requireTenantFromRequest().catch(() => null)
  const workspace = tenant?.theme.productName ?? tenant?.name
  return {
    title: bevelPageTitle(id.slice(0, 12), workspace),
    description: BEVEL_TAGLINE,
  }
}

export default async function BevelResumeSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ msg?: string; q?: string }>
}) {
  const session = await auth()
  const { id: sessionId } = await params
  const { msg, q } = await searchParams

  if (!session?.user) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(bevelSessionPath(sessionId))}`
    )
  }

  const summaries = await fetchSessionSummaries().catch(() => [])
  const summary = summaries.find((s) => s.sessionId === sessionId)
  const initialAgents =
    summary?.agentIds?.length ? summary.agentIds : ['hermes']
  const sessionTitle = summary?.title

  return (
    <BevelChatPane
      roomMode="session"
      sessionId={sessionId}
      sessionTitle={sessionTitle}
      initialAgents={initialAgents.map((id) => {
        const agent = getAgentById(id)
        return agent?.id ?? id
      })}
      focusMessageId={msg}
      highlightQuery={q}
    />
  )
}