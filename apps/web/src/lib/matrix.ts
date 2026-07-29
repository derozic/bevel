/**
 * Browser-side Matrix helpers (feature-gated).
 * Uses @bevel/matrix for Sliding Sync / VoIP URL builders.
 */

import {
  agentMxid,
  buildElementCallUrl,
  buildWorkspaceSlidingSync,
  channelAlias,
  createMatrixClientConfig,
  type MatrixClientConfig,
} from '@bevel/matrix'

export {
  agentMxid,
  buildElementCallUrl,
  buildWorkspaceSlidingSync,
  channelAlias,
  createMatrixClientConfig,
  type MatrixClientConfig,
}

export function matrixConfigFromEnv(): MatrixClientConfig | null {
  const homeserverUrl =
    process.env.NEXT_PUBLIC_MATRIX_HOMESERVER_URL ||
    process.env.MATRIX_HOMESERVER_URL
  const serverName =
    process.env.NEXT_PUBLIC_MATRIX_SERVER_NAME ||
    process.env.MATRIX_SERVER_NAME ||
    'matrix.bevel.is'
  if (!homeserverUrl) return null
  return createMatrixClientConfig({
    homeserverUrl,
    serverName,
    slidingSyncUrl:
      process.env.NEXT_PUBLIC_MATRIX_SLIDING_SYNC_URL ||
      process.env.MATRIX_SLIDING_SYNC_URL,
    elementCallUrl:
      process.env.NEXT_PUBLIC_MATRIX_ELEMENT_CALL_URL ||
      process.env.MATRIX_ELEMENT_CALL_URL,
  })
}

export function matrixApiStatusUrl(): string {
  const base = (
    process.env.NEXT_PUBLIC_BEVEL_API_URL ||
    process.env.BEVEL_API_URL ||
    'https://api.bevel.is'
  ).replace(/\/$/, '')
  return `${base}/api/v1/matrix/status`
}
