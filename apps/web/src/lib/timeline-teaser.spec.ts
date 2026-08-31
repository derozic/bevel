import { describe, expect, it } from 'vitest'
import {
  formatTimelineTeaser,
  latestConversationPreview,
  pickTimelineTeaser,
  timelineImportance,
} from './timeline-teaser'

describe('timeline teaser', () => {
  it('prefers an unread escalation over a newer ordinary mention', () => {
    const latest = {
      id: 'new',
      kind: 'mention',
      actorLabel: 'Hermes',
      bodyPreview: 'hey',
      createdAt: '2026-08-20T12:00:00.000Z',
      unread: false,
    }
    const urgent = {
      id: 'hot',
      kind: 'escalation',
      actorLabel: 'Scott',
      bodyPreview: 'need a look',
      channelSlug: 'ops',
      createdAt: '2026-08-20T10:00:00.000Z',
      unread: true,
      escalated: true,
    }
    expect(timelineImportance(urgent)).toBeGreaterThan(timelineImportance(latest))
    expect(pickTimelineTeaser([latest, urgent])?.id).toBe('hot')
    expect(formatTimelineTeaser(urgent)).toBe('^ Scott ~ops · need a look')
  })

  it('uses the newest conversation line when the feed is empty', () => {
    expect(
      latestConversationPreview([
        { title: 'Hermes', preview: 'older', updatedAt: 10 },
        { title: 'JOHNNY', preview: 'caddy healed', updatedAt: 50 },
      ]),
    ).toBe('JOHNNY · caddy healed')
  })

  it('does not use HTTP transport errors as the feed teaser', () => {
    expect(
      latestConversationPreview([
        {
          title: 'Fleet session',
          preview: 'Request failed with status code 403',
          updatedAt: 90,
        },
        { title: 'Hermes', preview: 'morning', updatedAt: 20 },
      ]),
    ).toBe('Hermes · morning')
  })

  it('falls back to the most recent item when nothing is urgent', () => {
    const older = {
      id: 'a',
      kind: 'mention',
      actorLabel: 'A',
      bodyPreview: 'old',
      createdAt: '2026-08-20T09:00:00.000Z',
    }
    const newer = {
      id: 'b',
      kind: 'mention',
      actorLabel: 'B',
      bodyPreview: 'new',
      createdAt: '2026-08-20T11:00:00.000Z',
    }
    expect(pickTimelineTeaser([older, newer])?.id).toBe('b')
  })
})
