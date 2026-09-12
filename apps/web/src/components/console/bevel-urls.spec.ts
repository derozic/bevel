import { describe, expect, it } from 'vitest'
import { bevelUrls } from './bevel-urls'

describe('console leave-console href', () => {
  it('sends apex and local hosts to Private', () => {
    expect(bevelUrls.workspaceChat('bevel.lvh.me')).toBe('/me')
    expect(bevelUrls.workspaceChat('bevel.is')).toBe('/me')
    expect(bevelUrls.workspaceChat('localhost')).toBe('/me')
    expect(bevelUrls.workspaceChat('')).toBe('/me')
  })

  it('sends org workspace hosts to ~general', () => {
    expect(bevelUrls.workspaceChat('bevel.2x4m.cc')).toBe('/~general')
    expect(bevelUrls.workspaceChat('2x4m.bevel.lvh.me')).toBe('/~general')
  })
})
