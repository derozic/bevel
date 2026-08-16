'use client'

import { useState } from 'react'
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
  const [failed, setFailed] = useState(false)
  const initial = (node.name.trim()[0] || '?').toUpperCase()
  if (failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-lg font-bold text-white"
        style={{
          width: size,
          height: size,
          background: node.accent,
          fontSize: size * 0.42,
        }}
      >
        {initial}
      </span>
    )
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={node.avatarUrl}
      alt=""
      width={size}
      height={size}
      className="shrink-0 rounded-lg object-cover"
      style={{
        width: size,
        height: size,
        boxShadow: `inset 0 0 0 2px ${node.accent}`,
      }}
      onError={() => setFailed(true)}
    />
  )
}
