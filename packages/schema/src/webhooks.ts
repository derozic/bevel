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
  description: string
}

export const WEBHOOK_EVENT_CATALOG: readonly WebhookEventDef[] = [
  {
    id: 'ftue.started',
    family: 'ftue',
    direction: 'both',
    description: 'First-time user entered Bevel (signup, claim, or inbound welcome).',
  },
  {
    id: 'ftue.first_message',
    family: 'ftue',
    direction: 'outbound',
    description: 'First human message in their personal conversation.',
  },
  {
    id: 'ftue.completed',
    family: 'ftue',
    direction: 'both',
    description: 'Onboarding finished (profile, handle, or inbound complete).',
  },
  {
    id: 'user.created',
    family: 'user',
    direction: 'outbound',
    description: 'Identity row created in Postgres.',
  },
  {
    id: 'message.created',
    family: 'message',
    direction: 'both',
    description: 'A final message landed in a track or conversation.',
  },
  {
    id: 'gesture.created',
    family: 'message',
    direction: 'outbound',
    description: 'Thumbs, star, heart, or vote on a message.',
  },
  {
    id: 'mention.created',
    family: 'message',
    direction: 'outbound',
    description: '@handle or ^handle extracted from a message.',
  },
  {
    id: 'track.created',
    family: 'track',
    direction: 'outbound',
    description: 'A new track (~slug) was created.',
  },
  {
    id: 'conversation.started',
    family: 'conversation',
    direction: 'outbound',
    description: 'First turn in a direct thread (dm-*).',
  },
  {
    id: 'workflow.started',
    family: 'workflow',
    direction: 'both',
    description: 'External pipeline began; can post into a room.',
  },
  {
    id: 'workflow.completed',
    family: 'workflow',
    direction: 'both',
    description: 'External pipeline finished in a track or conversation.',
  },
  {
    id: 'workflow.failed',
    family: 'workflow',
    direction: 'both',
    description: 'External pipeline failed; posted as a system turn.',
  },
  {
    id: 'notification.dispatched',
    family: 'notification',
    direction: 'both',
    description: 'Notification dispatch layer ingested an alert (push + optional room/timeline).',
  },
]

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
