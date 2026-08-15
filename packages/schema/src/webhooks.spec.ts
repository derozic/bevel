import { describe, expect, it } from 'vitest'
import {
  inboundWebhookPath,
  isConversationTarget,
  NotificationIngestSchema,
  webhookWantsEvent,
  WebhookEndpointSchema,
} from './webhooks'

describe('workflow webhooks', () => {
  it('routes inbound hooks to a standing API path', () => {
    expect(inboundWebhookPath('wh_abc')).toBe('/api/v1/webhooks/inbound/wh_abc')
  })

  it('treats dm-* slugs as conversations and ~rooms as tracks', () => {
    expect(isConversationTarget('dm-usr-hermes')).toBe(true)
    expect(isConversationTarget('ops')).toBe(false)
  })

  it('accepts a notification dispatch payload', () => {
    const n = NotificationIngestSchema.parse({
      title: 'Hermes',
      body: 'Your review is ready',
      handle: 'scott',
      conversation: 'dm-usr-hermes',
    })
    expect(n.push).toBe(true)
    expect(n.persist).toBe(true)
    expect(n.severity).toBe('info')
  })

  it('lets ftue.* subscribe to first-time user events', () => {
    expect(webhookWantsEvent(['ftue.*'], 'ftue.started')).toBe(true)
    expect(webhookWantsEvent(['ftue.*'], 'message.created')).toBe(false)
    expect(webhookWantsEvent([], 'user.created')).toBe(true)
  })

  it('accepts a track-bound outbound hook', () => {
    const hook = WebhookEndpointSchema.parse({
      id: 'wh_test01',
      name: 'n8n deploy',
      direction: 'outbound',
      targetKind: 'track',
      targetId: 'ops',
      url: 'https://hooks.example/bevel',
      events: ['message.created'],
    })
    expect(hook.targetKind).toBe('track')
  })
})
