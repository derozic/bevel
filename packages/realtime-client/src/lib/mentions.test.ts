/**
 * Mention retention suite — pure logic + CSS layout invariants.
 *
 * Run: pnpm exec tsx packages/realtime-client/src/lib/mentions.test.ts
 *
 * "Retention" means:
 * 1. Resolved @mentions are stable under re-parse (ids survive edits around them)
 * 2. applyMention is idempotent at the draft range (no double-insert)
 * 3. Chip geometry CSS must not use transform/padding/height changes on
 *    [data-mentioned] (layout thrash regression)
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  applyMention,
  filterMentionCandidates,
  mentionDraftAt,
  mentionedAgentIds,
  parseResolvedMentions,
} from './mentions'
import type { FleetAgent } from '../types'

const catalog: FleetAgent[] = [
  { id: 'johnny', name: 'JOHNNY', category: 'ops' },
  { id: 'loom', name: 'Loom', category: 'design' },
  { id: 'hermes', name: 'Hermes', category: 'comms' },
]

function section(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok  - ${name}`)
  } catch (err) {
    console.error(`fail - ${name}`)
    throw err
  }
}

section('parseResolvedMentions finds catalog ids and names', () => {
  const text = 'Hey @johnny and @Loom — ping @unknown'
  const hits = parseResolvedMentions(text, catalog)
  assert.equal(hits.length, 2)
  assert.equal(hits[0]!.id, 'johnny')
  assert.equal(hits[1]!.id, 'loom')
  assert.equal(text.slice(hits[0]!.start, hits[0]!.end), '@johnny')
  assert.equal(text.slice(hits[1]!.start, hits[1]!.end), '@Loom')
})

section('mentionedAgentIds is de-duped and stable', () => {
  const text = '@johnny said hi to @johnny and @hermes'
  const ids = mentionedAgentIds(text, catalog)
  assert.deepEqual(ids, ['johnny', 'hermes'])
})

section('mentionDraftAt tracks incomplete @token under caret', () => {
  const text = 'ping @jo'
  const draft = mentionDraftAt(text, text.length)
  assert.ok(draft)
  assert.equal(draft!.query, 'jo')
  assert.equal(draft!.start, 5)
  assert.equal(draft!.end, text.length)
})

section('mentionDraftAt ignores email-like mid-token @', () => {
  const text = 'user@domain'
  assert.equal(mentionDraftAt(text, text.length), null)
})

section('applyMention replaces draft range without duplicating', () => {
  const text = 'ask @jo'
  const draft = mentionDraftAt(text, text.length)!
  const once = applyMention(text, draft, 'johnny')
  assert.equal(once.text, 'ask @johnny ')
  // Re-applying a fresh draft on the completed text should not create @@johnny
  const draft2 = mentionDraftAt(once.text, once.caret)
  assert.equal(draft2, null)
  const ids = mentionedAgentIds(once.text, catalog)
  assert.deepEqual(ids, ['johnny'])
})

section('filterMentionCandidates matches id name and category', () => {
  const byId = filterMentionCandidates(catalog, 'her')
  assert.equal(byId.length, 1)
  assert.equal(byId[0]!.id, 'hermes')
  const byCat = filterMentionCandidates(catalog, 'design')
  assert.equal(byCat[0]!.id, 'loom')
  const empty = filterMentionCandidates(catalog, '')
  assert.ok(empty.length <= 8)
})

section('mention set is retained when surrounding text is edited', () => {
  let text = 'cc @johnny @loom'
  const before = mentionedAgentIds(text, catalog)
  text = `please ${text} — thanks`
  const after = mentionedAgentIds(text, catalog)
  assert.deepEqual(before, ['johnny', 'loom'])
  assert.deepEqual(after, ['johnny', 'loom'])
})

section('CSS: mentioned chip must not alter geometry (retention)', () => {
  const here = dirname(fileURLToPath(import.meta.url))
  const cssPath = join(here, '../styles/fleet-chat.css')
  const css = readFileSync(cssPath, 'utf8')

  // Extract the [data-mentioned='true'] rule block for chips
  const re =
    /\.fleet-chat\s+\.fleet-chat-chip\[data-mentioned='true'\]\s*\{([^}]+)\}/g
  const blocks = [...css.matchAll(re)].map((m) => m[1]!)
  assert.ok(blocks.length >= 1, 'expected data-mentioned chip rule')

  const forbidden = [
    /transform\s*:/,
    /scale\s*\(/,
    /translate(?!d)/,
    /padding(?:-left|-right|-top|-bottom)?\s*:/,
    /height\s*:/,
    /width\s*:/,
    /font-size\s*:/,
    /line-height\s*:/,
    /margin(?:-left|-right|-top|-bottom)?\s*:/,
  ]
  for (const block of blocks) {
    for (const bad of forbidden) {
      assert.equal(
        bad.test(block),
        false,
        `mentioned chip must not set ${bad} (layout thrash): ${block.trim()}`,
      )
    }
  }

  // Base chip must lock height so glow cannot reflow the strip
  assert.match(
    css,
    /\.fleet-chat\s+\.fleet-chat-chip\s*\{[^}]*height:\s*1\.65rem/,
    'base chip must declare fixed height',
  )
  assert.match(
    css,
    /min-height:\s*2\.5rem[\s\S]*height:\s*2\.5rem/,
    'chip strip must lock height so mention glow never shifts the thread',
  )
})

console.log('\nAll mention retention checks passed.')
