import { describe, expect, it } from 'vitest'
import {
  PRIVATE_SPACE_SLUG,
  currentWorkspaceSlug,
  listWorkspaceSpaces,
} from './workspace-spaces.server'

describe('workspace spaces', () => {
  it('treats platform entry hosts as Private', () => {
    expect(currentWorkspaceSlug('bevel.is')).toBe(PRIVATE_SPACE_SLUG)
    expect(currentWorkspaceSlug('bevel.lvh.me')).toBe(PRIVATE_SPACE_SLUG)
    expect(currentWorkspaceSlug('www.bevel.is')).toBe(PRIVATE_SPACE_SLUG)
  })

  it('resolves product hosts to the tenant slug', () => {
    expect(currentWorkspaceSlug('bevel.2ndbra.in')).toBe('2ndbrain')
    expect(currentWorkspaceSlug('bevel.2ndbrain.lvh.me')).toBe('2ndbrain')
  })

  it('lists Private plus candidate workspaces and marks the current one', () => {
    const spaces = listWorkspaceSpaces({
      fromHost: 'bevel.2ndbrain.lvh.me',
      candidateSlugs: ['2ndbrain', '2x4m', 'missing-slug'],
    })
    expect(spaces.map((s) => s.slug)).toEqual(['private', '2ndbrain', '2x4m'])
    expect(spaces.find((s) => s.slug === '2ndbrain')?.current).toBe(true)
    expect(spaces.find((s) => s.slug === 'private')?.current).toBe(false)
    expect(spaces.find((s) => s.slug === '2x4m')?.href).toBe(
      '/api/workspaces/open?slug=2x4m',
    )
  })
})
