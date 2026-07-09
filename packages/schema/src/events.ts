import { z } from 'zod'

export const BevelEventBaseSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().min(1),
  namespace: z.string().min(1),
  occurredAt: z.string().datetime(),
  source: z.enum(['web', 'admin', 'realtime', 'domains', 'webhook']),
})

export const ChannelCreatedEventSchema = BevelEventBaseSchema.extend({
  type: z.literal('channel.created'),
  payload: z.object({
    channelId: z.string(),
    slug: z.string(),
    name: z.string(),
    createdBy: z.string(),
  }),
})

export const DomainVerifiedEventSchema = BevelEventBaseSchema.extend({
  type: z.literal('domain.verified'),
  payload: z.object({
    host: z.string(),
    tenantId: z.string(),
  }),
})

export const BevelEventSchema = z.discriminatedUnion('type', [
  ChannelCreatedEventSchema,
  DomainVerifiedEventSchema,
])

export type BevelEvent = z.infer<typeof BevelEventSchema>