import { describe, expect, it } from 'vitest'
import {
  dedupeMessagesById,
  isValidSchemaMessage,
  readSchemaMessages,
  toChatMsg,
  type ChatMsg,
  type SchemaMessage,
} from './colyseus-messages'

describe('room messages', () => {
  it('accepts id-only schema rows (Colyseus can omit body on first patch)', () => {
    expect(isValidSchemaMessage({ id: 'm1' })).toBe(true)
    expect(isValidSchemaMessage({ id: '' })).toBe(false)
    expect(isValidSchemaMessage(null)).toBe(false)
  })

  it('coerces missing body/speaker so the thread cannot throw on render', () => {
    const msg = toChatMsg({ id: 'm1' } as SchemaMessage)
    expect(msg.body).toBe('')
    expect(msg.speaker).toBe('')
    expect(typeof msg.ts).toBe('number')
    expect(Number.isFinite(msg.ts)).toBe(true)
    expect(msg.reactions).toEqual([])
  })

  it('reads gestures and vote prompts from schema rows', () => {
    const msg = toChatMsg({
      id: 'm2',
      body: '[vote: Ship it?] Ready when you are.',
      speakerType: 'agent',
      reactionsJson: JSON.stringify([
        { kind: 'up', userId: 'u1', userName: 'Scott', ts: 1 },
      ]),
    } as SchemaMessage)
    expect(msg.votePrompt).toBe('Ship it?')
    expect(msg.reactions?.[0]?.kind).toBe('up')
  })

  it('reads array-like room state without crashing on holes', () => {
    const raw = {
      length: 3,
      0: { id: 'a', body: 'hi', speaker: 'Scott', speakerType: 'human', status: 'final', ts: 2 },
      1: undefined,
      2: { id: 'b', speakerType: 'agent', ts: 1 },
    }
    const list = readSchemaMessages(raw)
    expect(list.map((m) => m.id)).toEqual(['b', 'a'])
    expect(list[0]!.body).toBe('')
  })

  it('dedupes by id and keeps the later copy', () => {
    const prev: ChatMsg[] = [
      { id: 'a', speaker: 'A', speakerType: 'human', body: 'one', status: 'final', ts: 1 },
      { id: 'a', speaker: 'A', speakerType: 'human', body: 'two', status: 'final', ts: 2 },
    ]
    const next = dedupeMessagesById(prev)
    expect(next).toHaveLength(1)
    expect(next[0]!.body).toBe('two')
  })
})
