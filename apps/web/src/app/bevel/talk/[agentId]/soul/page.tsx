import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AgentDossier } from '@/components/agents/AgentDossier'
import { getAgentById } from '@/lib/agent-catalog'
import { canEditAgentFiles } from '@/lib/agent-edit-access'
import { loadAgentDossier } from '@/lib/agent-files'
import { BEVEL_TAGLINE, bevelPageTitle } from '@/lib/bevel'
import { requireTenantFromRequest } from '@bevel/tenant-config'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agentId: string }>
}): Promise<Metadata> {
  const { agentId } = await params
  const agent = getAgentById(agentId)
  const tenant = await requireTenantFromRequest().catch(() => null)
  return {
    title: bevelPageTitle(
      agent ? `${agent.name} · SOUL.md` : agentId,
      tenant?.theme.productName ?? tenant?.name,
    ),
    description: agent?.bio ?? BEVEL_TAGLINE,
  }
}

export default async function AgentSoulPage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const session = await auth()
  const { agentId } = await params
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/talk/${agentId}/soul`)}`)
  }
  const agent = getAgentById(agentId)
  if (!agent) notFound()
  const dossier = loadAgentDossier(agent.id)
  return (
    <AgentDossier
      agent={agent}
      dossier={dossier}
      canEdit={canEditAgentFiles(session)}
      initialPath="SOUL.md"
    />
  )
}
