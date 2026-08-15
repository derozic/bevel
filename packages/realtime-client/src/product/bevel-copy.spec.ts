import { describe, expect, it } from 'vitest'
import { BEVEL_COPY } from './bevel-copy'

describe('chat copy', () => {
  it('empty multi-agent rooms do not interpolate undefined', () => {
    expect(BEVEL_COPY.emptySessionMulti([])).toBe(BEVEL_COPY.emptySession)
    expect(BEVEL_COPY.emptySessionMulti(['Hermes'])).toContain('Hermes')
    expect(BEVEL_COPY.emptySessionMulti(['Hermes', 'JOHNNY'])).toContain('JOHNNY')
    expect(BEVEL_COPY.emptySessionMulti(['A', 'B', 'C'])).toContain('+2')
  })
})
