/**
 * Workflow webhooks — start and end in tracks (~slug) and conversations (dm-*).
 */
import { z } from 'zod'

export const WEBHOOK_DIRECTIONS = ['inbound', 'outbound'] as const
export type WebhookDirection = (typeof WEBHOOK_DIRECTIONS)[number]

export const WEBHOOK_TARGETS = ['track', 'conversation', 'any'] as const
export type WebhookTargetKind = (typeof WEBHOOK_TARGETS)[number]

export type WebhookCatalogDirection = 'inbound' | 'outbound' | 'both'

export type WebhookEventDef = {
  id: string
  family: string
  direction: WebhookCatalogDirection
  label: string
  description: string
}

export type WebhookSubscriptionOption = {
  id: string
  label: string
  family: string
}

/** Family chips shown first in the event subscription picker. */
export const WEBHOOK_FAMILY_SUBSCRIPTIONS: readonly WebhookSubscriptionOption[] = [
  { id: '*', label: 'All events', family: '*' },
  { id: 'ftue.*', label: 'All first-time', family: 'ftue' },
  { id: 'message.*', label: 'All messages', family: 'message' },
  { id: 'track.*', label: 'All tracks', family: 'track' },
  { id: 'conversation.*', label: 'All conversations', family: 'conversation' },
  { id: 'workflow.*', label: 'All workflows', family: 'workflow' },
  { id: 'notification.*', label: 'All notifications', family: 'notification' },
  { id: 'user.*', label: 'All people', family: 'user' },
]

export const WEBHOOK_EVENT_CATALOG: readonly WebhookEventDef[] = [
  {
    id: 'ftue.started',
    family: 'ftue',
    direction: 'both',
    label: 'First-time welcome',
    description: 'Someone entered Bevel for the first time.',
  },
  {
    id: 'ftue.first_message',
    family: 'ftue',
    direction: 'outbound',
    label: 'First message',
    description: 'First human message in their personal conversation.',
  },
  {
    id: 'ftue.completed',
    family: 'ftue',
    direction: 'both',
    label: 'Onboarding finished',
    description: 'Profile, handle, or inbound welcome completed.',
  },
  {
    id: 'user.created',
    family: 'user',
    direction: 'outbound',
    label: 'New person',
    description: 'A person record was created.',
  },
  {
    id: 'message.created',
    family: 'message',
    direction: 'both',
    label: 'New messages',
    description: 'A message landed in a track or conversation.',
  },
  {
    id: 'gesture.created',
    family: 'message',
    direction: 'outbound',
    label: 'Gestures',
    description: 'Thumbs, star, heart, or vote on a message.',
  },
  {
    id: 'mention.created',
    family: 'message',
    direction: 'outbound',
    label: 'Mentions',
    description: '@handle or ^handle extracted from a message.',
  },
  {
    id: 'track.created',
    family: 'track',
    direction: 'outbound',
    label: 'Track created',
    description: 'A new track (~slug) was created.',
  },
  {
    id: 'conversation.started',
    family: 'conversation',
    direction: 'outbound',
    label: 'Conversation started',
    description: 'First turn in a direct thread.',
  },
  {
    id: 'workflow.started',
    family: 'workflow',
    direction: 'both',
    label: 'Workflow started',
    description: 'An external pipeline began and can post into a room.',
  },
  {
    id: 'workflow.completed',
    family: 'workflow',
    direction: 'both',
    label: 'Workflow finished',
    description: 'An external pipeline finished in a track or conversation.',
  },
  {
    id: 'workflow.failed',
    family: 'workflow',
    direction: 'both',
    label: 'Workflow failed',
    description: 'An external pipeline failed; posted as a system turn.',
  },
  {
    id: 'notification.dispatched',
    family: 'notification',
    direction: 'both',
    label: 'Notification ingested',
    description: 'The dispatch layer ingested an alert (push, room, or timeline).',
  },
]

export function webhookEventLabel(id: string): string {
  const family = WEBHOOK_FAMILY_SUBSCRIPTIONS.find((item) => item.id === id)
  if (family) return family.label
  const event = WEBHOOK_EVENT_CATALOG.find((item) => item.id === id)
  return event?.label ?? id
}

export function webhookSubscriptionOptions(
  direction: WebhookDirection | 'both' = 'outbound',
): WebhookSubscriptionOption[] {
  const families = WEBHOOK_FAMILY_SUBSCRIPTIONS.filter((item) => {
    if (item.id === '*') return true
    return WEBHOOK_EVENT_CATALOG.some(
      (event) =>
        event.family === item.family &&
        (direction === 'both' ||
          event.direction === 'both' ||
          event.direction === direction),
    )
  })
  const events = WEBHOOK_EVENT_CATALOG.filter(
    (event) =>
      direction === 'both' ||
      event.direction === 'both' ||
      event.direction === direction,
  ).map((event) => ({
    id: event.id,
    label: event.label,
    family: event.family,
  }))
  return [...families, ...events]
}

export const NotificationIngestSchema = z.object({
  title: z.string().min(1).max(160),
  body: z.string().min(1).max(4000),
  userId: z.string().optional(),
  email: z.string().optional(),
  handle: z.string().optional(),
  tenant: z.string().optional(),
  track: z.string().optional(),
  conversation: z.string().optional(),
  deepLink: z.string().optional(),
  href: z.string().optional(),
  agentId: z.string().optional(),
  severity: z.enum(['info', 'warning', 'critical']).default('info'),
  persist: z.boolean().default(true),
  push: z.boolean().default(true),
  timeline: z.boolean().default(true),
})

export const WEBHOOK_IN_EVENTS = WEBHOOK_EVENT_CATALOG.filter(
  (e) => e.direction === 'both' || e.direction === 'inbound',
).map((e) => e.id)

export const WEBHOOK_OUT_EVENTS = WEBHOOK_EVENT_CATALOG.filter(
  (e) => e.direction === 'both' || e.direction === 'outbound',
).map((e) => e.id)

export function webhookWantsEvent(
  subscribed: readonly string[] | undefined,
  event: string,
): boolean {
  const events = subscribed ?? []
  if (events.length === 0 || events.includes('*')) return true
  if (events.includes(event)) return true
  const family = event.split('.')[0]
  return Boolean(family && events.includes(`${family}.*`))
}

export const WebhookEndpointSchema = z.object({
  id: z.string().min(8),
  name: z.string().min(1).max(120),
  direction: z.enum(WEBHOOK_DIRECTIONS),
  targetKind: z.enum(WEBHOOK_TARGETS),
  targetId: z.string().max(64).optional().default(''),
  url: z.string().max(512).optional().default(''),
  events: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
})

export type WebhookEndpoint = z.infer<typeof WebhookEndpointSchema>

export function inboundWebhookPath(id: string): string {
  return `/api/v1/webhooks/inbound/${encodeURIComponent(id)}`
}

export function isConversationTarget(id: string): boolean {
  return id.trim().toLowerCase().startsWith('dm-')
}
