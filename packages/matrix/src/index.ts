/**
 * @bevel/matrix — Matrix 2.0 client surface for BEVEL.
 *
 * Phase 2: Sliding Sync types, VoIP config, room alias helpers.
 * Full matrix-js-sdk wiring lands when MATRIX_HOMESERVER_URL is live.
 */

export type MatrixClientConfig = {
  homeserverUrl: string
  serverName: string
  /** Sliding Sync proxy (Matrix 2.0) — optional until HS supports native SS */
  slidingSyncUrl?: string
  /** Element Call / MatrixRTC base URL */
  elementCallUrl?: string
  accessToken?: string
  userId?: string
  deviceId?: string
}

export type MatrixRoomRef = {
  roomId: string
  alias?: string
  channelSlug: string
  tenantSlug: string
}

export type SlidingSyncList = {
  name: string
  ranges: Array<[number, number]>
  required_state?: Array<[string, string]>
  timeline_limit?: number
  filters?: { is_dm?: boolean; spaces?: string[] }
}

export type SlidingSyncRequest = {
  lists: Record<string, SlidingSyncList>
  room_subscriptions?: Record<string, { timeline_limit?: number }>
  extensions?: Record<string, unknown>
}

/** Build Sliding Sync request for workspace channels (Matrix 2.0). */
export function buildWorkspaceSlidingSync(opts: {
  spaceId?: string
  timelineLimit?: number
}): SlidingSyncRequest {
  return {
    lists: {
      channels: {
        name: 'channels',
        ranges: [[0, 20]],
        timeline_limit: opts.timelineLimit ?? 20,
        required_state: [
          ['m.room.name', ''],
          ['m.room.topic', ''],
          ['m.room.avatar', ''],
        ],
        filters: opts.spaceId ? { spaces: [opts.spaceId] } : undefined,
      },
    },
  }
}

export function channelAlias(
  tenantSlug: string,
  channelSlug: string,
  serverName: string,
): string {
  const local = `${tenantSlug}_${channelSlug}`
    .toLowerCase()
    .replace(/[^a-z0-9._=-]+/g, '_')
  return `#${local}:${serverName}`
}

export function agentMxid(
  tenantSlug: string,
  agentId: string,
  serverName: string,
): string {
  const local = `agent_${tenantSlug}_${agentId}`
    .toLowerCase()
    .replace(/[^a-z0-9._=-]+/g, '_')
  return `@${local}:${serverName}`
}

export type MatrixVoipSessionConfig = {
  roomId: string
  elementCallUrl: string
  widgetId?: string
}

/**
 * Build Element Call / MatrixRTC join URL for a room.
 * Used when hasFeature(tenant, 'matrixVoip').
 */
export function buildElementCallUrl(cfg: MatrixVoipSessionConfig): string {
  const base = cfg.elementCallUrl.replace(/\/$/, '')
  const params = new URLSearchParams({
    roomId: cfg.roomId,
  })
  if (cfg.widgetId) params.set('widgetId', cfg.widgetId)
  return `${base}/room#?${params.toString()}`
}

export type MatrixBridgeKind = 'slack' | 'imessage' | 'sms' | 'bevel'

export type MatrixBridgeDescriptor = {
  kind: MatrixBridgeKind
  /** Appservice id registered on the HS */
  appserviceId: string
  /** Whether dual-write is active */
  enabled: boolean
}

/** Phase 3 bridge registry — wire real AS tokens in ops. */
export const DEFAULT_BRIDGE_REGISTRY: MatrixBridgeDescriptor[] = [
  { kind: 'bevel', appserviceId: 'bevel', enabled: true },
  { kind: 'slack', appserviceId: 'bevel-slack', enabled: false },
  { kind: 'imessage', appserviceId: 'bevel-imessage', enabled: false },
  { kind: 'sms', appserviceId: 'bevel-sms', enabled: false },
]

export function createMatrixClientConfig(
  partial: Partial<MatrixClientConfig> &
    Pick<MatrixClientConfig, 'homeserverUrl' | 'serverName'>,
): MatrixClientConfig {
  return {
    homeserverUrl: partial.homeserverUrl.replace(/\/$/, ''),
    serverName: partial.serverName,
    slidingSyncUrl: partial.slidingSyncUrl,
    elementCallUrl: partial.elementCallUrl,
    accessToken: partial.accessToken,
    userId: partial.userId,
    deviceId: partial.deviceId,
  }
}

/**
 * Placeholder connect — throws until matrix-js-sdk is installed and HS is live.
 * Keeps call sites stable for Phase 2 UI.
 */
export async function connectMatrixClient(
  _config: MatrixClientConfig,
): Promise<never> {
  throw new Error(
    '@bevel/matrix: connectMatrixClient requires MATRIX_HOMESERVER_URL + access token and matrix-js-sdk (Phase 2 runtime)',
  )
}
