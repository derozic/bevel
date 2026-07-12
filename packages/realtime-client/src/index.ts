/**
 * Live bidirectional transport (WebSocket) — chat, presence, shared sessions.
 * Isolated behind services/realtime; not coupled to Vercel/Cloudflare host WS beta.
 * For one-way updates use @bevel/async-stream (SSE). For A/V use @bevel/feature-webrtc.
 */
export {
  FleetProvider,
  useFleet,
  useFleetOptional,
  type FleetContextValue,
  type FleetRoomMode,
  type FleetWorkRepo,
} from './FleetProvider'
export { AgentChip, type AgentChipProps } from './components/AgentChip'
export { FleetChat, type FleetChatProps } from './components/FleetChat'
export {
  formatFleetError,
  formatRoomErrorEvent,
  sanitizeErrorText,
} from './lib/format-error'
export { BevelPoweredBy } from './components/BevelPoweredBy'
export {
  BEVEL_WORD,
  BEVEL_TM,
  BEVEL_NAME,
  BEVEL_POWERED_BY_LABEL,
  BEVEL_TRADEMARK_NOTICE,
  BEVEL_PRODUCT,
  CHANNEL_TAG_PREFIX,
  channelTag,
  type BevelProduct,
} from './product/bevel'
export {
  BEVEL_COPY,
  isSeatReservationExpired,
  resolveBevelConnectionIssue,
  type BevelConnectionIssue,
} from './product/bevel-copy'
export {
  AGENT_CHIP_COPY,
  resolveAgentChipCopy,
  type AgentChipCopy,
} from './product/agent-chip-copy'
export { HumanAvatar } from './components/HumanAvatar'
export type { FleetAgent } from './types'
export {
  applyMention,
  filterMentionCandidates,
  mentionDraftAt,
  mentionedAgentIds,
  parseResolvedMentions,
} from './lib/mentions'
export { resolveRealtimeUrl } from './lib/realtime-client'
export { formatSpeaker, SYSTEM_SPEAKER } from './lib/system-voice'
export {
  toChatMsg,
  isValidSchemaMessage,
  readSchemaMessages,
  dedupeMessagesById,
  readHumanParticipants,
  dedupeHumanParticipantsByUser,
  type ChatMsg,
  type HumanParticipant,
} from './lib/colyseus-messages'
export { cn } from './lib/utils'