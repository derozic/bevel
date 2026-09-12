'use client'

import { FleetAvatar } from '@/components/avatars/FleetAvatar'
import type { OrgNode } from '@/lib/org-graph'

export function StatusDot({ status }: { status: OrgNode['status'] }) {
  const color =
    status === 'available'
      ? 'bg-success'
      : status === 'busy'
        ? 'bg-warning'
        : 'bg-muted'
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${color}`}
      title={status}
    />
  )
}

export function AgentAvatar({
  node,
  size = 32,
}: {
  node: OrgNode
  size?: number
}) {
  return (
    <FleetAvatar
      agentId={node.id}
      name={node.name}
      accent={node.accent}
      size={size}
      src={node.avatarUrl}
    />
  )
}
