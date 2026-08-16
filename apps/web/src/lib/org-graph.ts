/**
 * Working agent org graph.
 *
 * Hierarchy = reporting tree (founder → Hermes → directors → ICs).
 * Diamond = fan-out / fan-in workflow: one owner splits work to
 * parallel reports, then joins results back.
 */
import fleetRegistry from './fleet-registry.json'
import { getAgentById, type Agent } from './agent-catalog'

export type OrgTier = 'founder' | 'co-founder' | 'director' | 'ic'

export type OrgNode = {
  id: string
  name: string
  role: string
  tier: OrgTier
  parentId: string | null
  childIds: string[]
  avatarUrl: string
  accent: string
  status: 'available' | 'busy' | 'offline'
  category: string
  soul: string
  bio: string
  deployments: number
  rating: number
}

export type DiamondWorkflow = {
  id: string
  name: string
  sourceId: string
  parallelIds: string[]
  sinkId: string
  description: string
}

type RegistryShape = {
  company?: { founder?: { id: string; name: string; title: string } }
  hierarchy?: {
    orgChart?: Record<string, { reportsTo?: string; directReports?: string[] }>
  }
  agents?: Array<{
    id: string
    name: string
    role?: string
    tier?: string
    reportsTo?: string
    directReports?: string[]
    status?: string
    accent?: string
    category?: string
    soul?: string
    description?: string
    avatar?: string
    deployments?: number
    rating?: number
  }>
}

const registry = fleetRegistry as RegistryShape

function asTier(raw: string | undefined): OrgTier {
  if (raw === 'founder' || raw === 'co-founder' || raw === 'director') return raw
  return 'ic'
}

function asStatus(raw: string | undefined): OrgNode['status'] {
  if (raw === 'busy' || raw === 'offline') return raw
  return 'available'
}

export function getFounderNode(): OrgNode {
  const f = registry.company?.founder
  return {
    id: f?.id || 'scott',
    name: f?.name || 'Founder',
    role: f?.title || 'Founder & CEO',
    tier: 'founder',
    parentId: null,
    childIds: ['hermes'],
    avatarUrl: '/avatars/hermes.svg',
    accent: '#1a1410',
    status: 'available',
    category: 'Leadership',
    soul: '',
    bio: 'Human founder. Agents report through Hermes.',
    deployments: 0,
    rating: 0,
  }
}

export function getOrgNodes(): OrgNode[] {
  const founder = getFounderNode()
  const chart = registry.hierarchy?.orgChart ?? {}
  const nodes: OrgNode[] = [founder]

  for (const raw of registry.agents ?? []) {
    const catalog = getAgentById(raw.id)
    const chartNode = chart[raw.id]
    const parentId = raw.reportsTo ?? chartNode?.reportsTo ?? founder.id
    nodes.push({
      id: raw.id,
      name: raw.name,
      role: raw.role || catalog?.role || raw.name,
      tier: asTier(raw.tier),
      parentId,
      childIds: [],
      avatarUrl: catalog?.avatarUrl || `/avatars/${raw.id}.svg`,
      accent: raw.accent || catalog?.accent || '#6366f1',
      status: asStatus(raw.status),
      category: raw.category || catalog?.category || 'Fleet',
      soul: raw.soul || catalog?.soulMd || '',
      bio: raw.description || catalog?.bio || '',
      deployments: Number(raw.deployments) || 0,
      rating: Number(raw.rating) || 0,
    })
  }

  // Prefer inverted reportsTo so a stale directReports list cannot hide peers.
  const childrenByParent = new Map<string, string[]>()
  for (const node of nodes) {
    if (!node.parentId) continue
    const list = childrenByParent.get(node.parentId) ?? []
    list.push(node.id)
    childrenByParent.set(node.parentId, list)
  }
  for (const node of nodes) {
    const declared = childrenByParent.get(node.id)
    if (declared && declared.length > 0) {
      node.childIds = declared
    }
  }
  const founderKids = childrenByParent.get(founder.id)
  if (founderKids && founderKids.length > 0) {
    founder.childIds = founderKids
  }
  return nodes
}

export function getOrgNode(id: string): OrgNode | undefined {
  return getOrgNodes().find((n) => n.id === id)
}

export function getChildren(id: string, nodes = getOrgNodes()): OrgNode[] {
  const node = nodes.find((n) => n.id === id)
  if (!node) return []
  return node.childIds
    .map((cid) => nodes.find((n) => n.id === cid))
    .filter((n): n is OrgNode => Boolean(n))
}

/** Every manager with 2+ reports is a live diamond: fan-out then join. */
export function getDiamondWorkflows(nodes = getOrgNodes()): DiamondWorkflow[] {
  return nodes
    .filter((n) => n.childIds.length >= 2)
    .map((n) => {
      const kids = getChildren(n.id, nodes)
      const label =
        n.tier === 'co-founder'
          ? 'Director fan-out'
          : n.tier === 'director'
            ? `${n.name} pod`
            : `${n.name} reports`
      return {
        id: `diamond-${n.id}`,
        name: label,
        sourceId: n.id,
        parallelIds: n.childIds,
        sinkId: n.id,
        description: `${n.name} splits work across ${kids.length} parallel agents, then joins results.`,
      }
    })
}

export function orgStats(nodes = getOrgNodes()) {
  const byTier = {
    founder: nodes.filter((n) => n.tier === 'founder').length,
    'co-founder': nodes.filter((n) => n.tier === 'co-founder').length,
    director: nodes.filter((n) => n.tier === 'director').length,
    ic: nodes.filter((n) => n.tier === 'ic').length,
  }
  const fleet = nodes.filter((n) => n.tier !== 'founder')
  return {
    fleet: fleet.length,
    agents: fleet.length,
    diamonds: getDiamondWorkflows(nodes).length,
    byTier,
    available: fleet.filter((n) => n.status === 'available').length,
    busy: fleet.filter((n) => n.status === 'busy').length,
    offline: fleet.filter((n) => n.status === 'offline').length,
    deployments: fleet.reduce((sum, n) => sum + (n.deployments || 0), 0),
  }
}

export type OrgPod = {
  directorId: string
  directorName: string
  size: number
}

export function orgDynamics(nodes = getOrgNodes()) {
  const stats = orgStats(nodes)
  const directors = nodes.filter((n) => n.tier === 'director')
  const pods: OrgPod[] = directors
    .map((d) => ({
      directorId: d.id,
      directorName: d.name,
      size: getChildren(d.id, nodes).filter((c) => c.tier === 'ic').length,
    }))
    .filter((p) => p.size > 0)
    .sort((a, b) => b.size - a.size)
  const staffed = pods.length
  const uncovered = directors.length - staffed
  const icCount = stats.byTier.ic
  const span = staffed ? icCount / staffed : 0
  const coverage = directors.length ? staffed / directors.length : 0
  const categories = new Map<string, number>()
  for (const node of nodes.filter((n) => n.tier !== 'founder')) {
    const key = node.category || 'Fleet'
    categories.set(key, (categories.get(key) ?? 0) + 1)
  }
  const topCategories = [...categories.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))
  return {
    stats,
    pods,
    staffed,
    uncovered,
    span,
    coverage,
    topCategories,
  }
}

export function agentTalkHref(id: string): string {
  if (id === 'scott') return '/bevel/talk/hermes'
  return `/bevel/talk/${id}`
}

export type { Agent }
