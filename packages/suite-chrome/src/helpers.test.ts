import { badgeLabel, relativeTime } from './helpers'

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg)
}

assert(badgeLabel(0) === null, 'zero hidden')
assert(badgeLabel(5) === '5', 'digit')
assert(badgeLabel(10) === '9+', 'cap')
assert(relativeTime(null) === '', 'empty')
assert(relativeTime(new Date(Date.now() - 10_000).toISOString()) === 'just now', 'recent')
assert(relativeTime(new Date(Date.now() - 120_000).toISOString()) === '2m ago', 'minutes')

console.log('helpers.test.ts: ok')
