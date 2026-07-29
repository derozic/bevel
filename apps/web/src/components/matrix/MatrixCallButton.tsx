'use client'

import { hasFeature, type FeatureTenantLike } from '@bevel/schema'
import { buildElementCallUrl, matrixConfigFromEnv } from '@/lib/matrix'

/**
 * Starts MatrixRTC / Element Call when matrixVoip is on and room id is known.
 */
export function MatrixCallButton({
  tenant,
  roomId,
  label = 'Start call',
}: {
  tenant: FeatureTenantLike | null
  roomId?: string | null
  label?: string
}) {
  if (!hasFeature(tenant, 'matrixVoip')) return null
  const cfg = matrixConfigFromEnv()
  const callBase = cfg?.elementCallUrl
  if (!roomId || !callBase) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex h-9 items-center rounded-full border border-gray-300 px-3 text-xs font-semibold text-gray-400"
        title="Matrix VoIP needs room mapping + ELEMENT_CALL_URL"
      >
        {label}
      </button>
    )
  }
  const href = buildElementCallUrl({
    roomId,
    elementCallUrl: callBase,
  })
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex h-9 items-center rounded-full border-2 border-gray-900 bg-gray-900 px-3 text-xs font-semibold text-white hover:bg-white hover:text-gray-900"
    >
      {label}
    </a>
  )
}
