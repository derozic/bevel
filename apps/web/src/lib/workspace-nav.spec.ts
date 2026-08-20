import { describe, expect, it } from 'vitest'
import {
  WORKSPACE_SPLIT_MIN,
  isSoftWorkspacePath,
  resolveSoftWorkspaceHref,
} from './workspace-nav'

describe('workspace overlay nav', () => {
  it('uses the same 56.25rem split as bevel-workspace.css', () => {
    expect(WORKSPACE_SPLIT_MIN).toBe('(min-width: 56.25rem)')
  })
})

describe('soft workspace links', () => {
  it('treats talk, session, private, and tilde channels as in-app', () => {
    expect(isSoftWorkspacePath('/talk/hermes')).toBe(true)
    expect(isSoftWorkspacePath('/talk/hermes?agents=johnny')).toBe(true)
    expect(isSoftWorkspacePath('/session/dm-usr-hermes')).toBe(true)
    expect(isSoftWorkspacePath('/me')).toBe(true)
    expect(isSoftWorkspacePath('/~general')).toBe(true)
    expect(isSoftWorkspacePath('/timeline')).toBe(true)
    expect(isSoftWorkspacePath('/tags/product')).toBe(true)
    expect(isSoftWorkspacePath('/bevel/talk/hermes')).toBe(true)
  })

  it('leaves console, auth, and downloads as full navigations', () => {
    expect(isSoftWorkspacePath('/console/fleet')).toBe(false)
    expect(isSoftWorkspacePath('/login')).toBe(false)
    expect(isSoftWorkspacePath('/api/auth/session')).toBe(false)
  })

  it('resolves relative talk hrefs and skips modified / external anchors', () => {
    const origin = 'https://bevel.2x4m.lvh.me'
    expect(
      resolveSoftWorkspaceHref(
        { getAttribute: (n) => (n === 'href' ? '/talk/hermes' : null), hasAttribute: () => false, target: '' },
        origin,
      ),
    ).toBe('/talk/hermes')
    expect(
      resolveSoftWorkspaceHref(
        {
          getAttribute: (n) => (n === 'href' ? '/talk/hermes' : null),
          hasAttribute: () => false,
          target: '_blank',
        },
        origin,
      ),
    ).toBeNull()
    expect(
      resolveSoftWorkspaceHref(
        {
          getAttribute: (n) =>
            n === 'href' ? 'https://example.com/talk/hermes' : null,
          hasAttribute: () => false,
          target: '',
        },
        origin,
      ),
    ).toBeNull()
    expect(
      resolveSoftWorkspaceHref(
        {
          getAttribute: (n) => (n === 'href' ? '/bevel/talk/hermes' : null),
          hasAttribute: () => false,
          target: '',
        },
        origin,
      ),
    ).toBe('/talk/hermes')
  })
})
