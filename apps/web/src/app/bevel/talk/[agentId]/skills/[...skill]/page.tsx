import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { auth } from '@/auth'
import { AgentDossier } from '@/components/agents/AgentDossier'
import { getAgentById } from '@/lib/agent-catalog'
import { canEditAgentFiles } from '@/lib/agent-edit-access'
import { loadAgentDossier, sanitizeAgentDocPath } from '@/lib/agent-files'
import { BEVEL_TAGLINE, bevelPageTitle } from '@/lib/bevel'
import { requireTenantFromRequest } from '@bevel/tenant-config'

function skillDocPath(parts: string[]): string | null {
  const joined = parts.join('/')
  return (
    sanitizeAgentDocPath(`skills/${joined}.md`) ||
    sanitizeAgentDocPath(`${joined}.md`) ||
    sanitizeAgentDocPath(`skills/${joined}`)
  )
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ agentId: string; skill: string[] }>
}): Promise<Metadata> {
  const { agentId, skill } = await params
  const agent = getAgentById(agentId)
  const tenant = await requireTenantFromRequest().catch(() => null)
  const leaf = skill[skill.length - 1] ?? 'skill'
  return {
    title: bevelPageTitle(
      agent ? `${agent.name} · ${leaf}` : agentId,
      tenant?.theme.productName ?? tenant?.name,
    ),
    description: agent?.bio ?? BEVEL_TAGLINE,
  }
}

export default async function AgentNestedSkillPage({
  params,
}: {
  params: Promise<{ agentId: string; skill: string[] }>
}) {
  const session = await auth()
  const { agentId, skill } = await params
  const callback = `/talk/${agentId}/skills/${skill.join('/')}`
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callback)}`)
  }
  const agent = getAgentById(agentId)
  if (!agent) notFound()
  const dossier = loadAgentDossier(agent.id)
  const wanted = skillDocPath(skill)
  const match =
    dossier.files.find((f) => f.path === wanted) ||
    dossier.files.find((f) => f.path.replace(/\.md$/i, '') === skill.join('/')) ||
    dossier.files.find(
      (f) => f.path.replace(/^skills\//, '').replace(/\.md$/i, '') === skill.join('/'),
    )
  if (!match) notFound()
  return (
    <AgentDossier
      agent={agent}
      dossier={dossier}
      canEdit={canEditAgentFiles(session)}
      initialPath={match.path}
    />
  )
}
