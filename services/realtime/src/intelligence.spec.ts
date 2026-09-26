import assert from 'node:assert/strict'
import { turnTouches } from '@bevel/schema'
import {
  intelligenceKeysForTurn,
  markIdle,
  markWorking,
  resetIntelligence,
  subscribeIntelligence,
  workingSnapshot,
} from './intelligence.js'

resetIntelligence()

const seen: string[] = []
const stop = subscribeIntelligence((event) => {
  seen.push(`${event.phase}:${event.keys.join(',')}`)
})

const keys = intelligenceKeysForTurn({
  sessionId: 'dm-1',
  agentIds: ['Claude', 'claude'],
})
assert.deepEqual(keys, ['session:dm-1', 'talk:claude'])

markWorking(keys)
markWorking(['talk:claude'])
assert.deepEqual(workingSnapshot().sort(), ['session:dm-1', 'talk:claude'])
assert.equal(turnTouches(new Set(workingSnapshot()), { agentId: 'claude' }), true)
assert.equal(turnTouches(new Set(workingSnapshot()), { channelSlug: 'general' }), false)

markIdle(['talk:claude'])
assert.equal(workingSnapshot().includes('talk:claude'), true, 'refcount holds the shared agent')
markIdle(keys)
assert.deepEqual(workingSnapshot(), [])
assert.deepEqual(seen, [
  'working:session:dm-1,talk:claude',
  'idle:session:dm-1,talk:claude',
])

stop()
resetIntelligence()
console.log('intelligence.test.ts: ok')
