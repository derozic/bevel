import { describe, expect, it } from 'vitest'
import { BEVEL_COPY, resolveBevelConnectionIssue } from './bevel-copy'

describe('chat copy', () => {
  it('empty multi-agent rooms do not interpolate undefined', () => {
    expect(BEVEL_COPY.emptySessionMulti([])).toBe(BEVEL_COPY.emptySession)
    expect(BEVEL_COPY.emptySessionMulti(['Hermes'])).toContain('Hermes')
    expect(BEVEL_COPY.emptySessionMulti(['Hermes', 'JOHNNY'])).toContain('JOHNNY')
    expect(BEVEL_COPY.emptySessionMulti(['A', 'B', 'C'])).toContain('+2')
  })

  it('seat reservation copy is a title plus a same-row hint', () => {
    const issue = resolveBevelConnectionIssue('seat reservation expired', {
      isChannel: true,
      realtimeUrl: 'https://realtime.bevel.lvh.me',
    })
    expect(issue.title).toBe(BEVEL_COPY.errors.seatReservationFailed)
    expect(issue.hint).toBe(BEVEL_COPY.errors.seatReservationHint)
    expect(`${issue.title} ${issue.hint}`).not.toMatch(/\n/)
  })

  it('does not leak hosts, ports, or "realtime tab" into reachability copy', () => {
    const issue = resolveBevelConnectionIssue('Failed to fetch', {
      isChannel: true,
      realtimeUrl: 'https://realtime.bevel.is',
    })
    expect(issue.title).toBe(BEVEL_COPY.errors.connectionFailed)
    expect(issue.hint).toBe(BEVEL_COPY.errors.connectionHint)
    expect(`${issue.title} ${issue.hint}`).not.toMatch(/realtime\.bevel|43208|tab/i)
  })

  it('treats wss-on-http matchmake as a join failure, not a raw scheme error', () => {
    const issue = resolveBevelConnectionIssue(
      'URL scheme "wss" is not supported',
      { isChannel: true, realtimeUrl: 'https://realtime.bevel.is' },
    )
    expect(issue.title).toBe(BEVEL_COPY.errors.connectionFailed)
    expect(issue.hint).not.toMatch(/wss|realtime\.bevel/i)
  })
})
