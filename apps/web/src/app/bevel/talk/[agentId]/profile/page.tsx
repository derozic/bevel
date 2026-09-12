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
  const workspace = tenant?.theme.productName ?? tenant?.name
  return {
    title: bevelPageTitle(
      agent ? `${agent.name} profile` : agentId,
      workspace,
    ),
    description: agent?.bio ?? BEVEL_TAGLINE,
  }
}

export default async function AgentProfilePage({
  params,
}: {
  params: Promise<{ agentId: string }>
}) {
  const session = await auth()
  if (!session?.user) {
    const { agentId } = await params
    redirect(`/login?callbackUrl=${encodeURIComponent(`/talk/${agentId}/profile`)}`)
  }
  const { agentId } = await params
  const agent = getAgentById(agentId)
  if (!agent) notFound()
  const dossier = loadAgentDossier(agent.id)
  return (
    <AgentDossier
      agent={agent}
      dossier={dossier}
      canEdit={canEditAgentFiles(session)}
      initialPath={dossier.soul?.path ?? dossier.skill?.path}
    />
  )
}
