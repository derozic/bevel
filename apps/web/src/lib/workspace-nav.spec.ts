import { describe, expect, it } from 'vitest'
import { WORKSPACE_SPLIT_MIN } from './workspace-nav'

describe('workspace overlay nav', () => {
  it('uses the same 56.25rem split as bevel-workspace.css', () => {
    expect(WORKSPACE_SPLIT_MIN).toBe('(min-width: 56.25rem)')
  })
})
