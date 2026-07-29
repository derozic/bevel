'use client'

import { useEffect, useState } from 'react'
import { hasFeature, type FeatureTenantLike } from '@bevel/schema'
import { matrixApiStatusUrl } from '@/lib/matrix'

type Status = {
  enabled?: boolean
  configured?: boolean
  serverName?: string
  slidingSync?: boolean
  elementCall?: boolean
  phases?: Record<string, boolean>
}

/**
 * Preferences / console card — shows Matrix fabric readiness when
 * hasFeature(tenant, 'matrix').
 */
export function MatrixStatusCard({
  tenant,
}: {
  tenant: FeatureTenantLike | null
}) {
  const [status, setStatus] = useState<Status | null>(null)
  const [error, setError] = useState<string | null>(null)
  const on = hasFeature(tenant, 'matrix')

  useEffect(() => {
    if (!on) return
    let cancelled = false
    void fetch(matrixApiStatusUrl(), { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json() as Promise<Status>
      })
      .then((data) => {
        if (!cancelled) setStatus(data)
      })
      .catch((e) => {
        if (!cancelled)
          setError(e instanceof Error ? e.message : 'Failed to load Matrix status')
      })
    return () => {
      cancelled = true
    }
  }, [on])

  if (!on) return null

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">Matrix fabric</h3>
      <p className="mt-1 text-xs text-gray-600">
        Open messaging substrate (Sliding Sync, federation, Element Call) dual-written
        with BEVEL channels.
      </p>
      {error ? (
        <p className="mt-3 text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {status ? (
        <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-700">
          <div>
            <dt className="font-medium text-gray-500">Enabled</dt>
            <dd>{status.enabled ? 'yes' : 'no'}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">HS configured</dt>
            <dd>{status.configured ? 'yes' : 'no'}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Server</dt>
            <dd className="truncate">{status.serverName || '—'}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Sliding Sync</dt>
            <dd>{status.slidingSync ? 'ready' : 'pending'}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">VoIP</dt>
            <dd>
              {hasFeature(tenant, 'matrixVoip')
                ? status.elementCall
                  ? 'ready'
                  : 'flag on, call URL pending'
                : 'off'}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Federation</dt>
            <dd>{hasFeature(tenant, 'matrixFederation') ? 'allowed' : 'off'}</dd>
          </div>
        </dl>
      ) : !error ? (
        <p className="mt-3 text-xs text-gray-500">Loading…</p>
      ) : null}
    </section>
  )
}
