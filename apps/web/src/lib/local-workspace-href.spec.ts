import { describe, expect, it } from 'vitest'
import { rewriteLocalWorkspaceHref } from './local-workspace-href'

describe('rewriteLocalWorkspaceHref', () => {
  it('rewrites a 2x4m production handoff to the local workspace', () => {
    const href =
      'https://bevel.2x4m.cc/api/auth/handoff?code=abc&callbackUrl=%2F~general'
    expect(rewriteLocalWorkspaceHref(href, 'bevel.lvh.me')).toBe(
      'https://bevel.2x4m.lvh.me/~general',
    )
  })

  it('rewrites localhost:41009 after a failed production handoff', () => {
    expect(
      rewriteLocalWorkspaceHref(
        'https://localhost:41009/login?error=HandoffFailed',
        'bevel.lvh.me',
      ),
    ).toBe('https://bevel.lvh.me/~general')
  })

  it('rewrites Decli production to preview', () => {
    expect(
      rewriteLocalWorkspaceHref('https://bevel.decli.dev/~general', 'bevel.lvh.me'),
    ).toBe('https://bevel.decli.lvh.me/~general')
  })

  it('leaves production pages alone', () => {
    const href = 'https://bevel.2x4m.cc/~general'
    expect(rewriteLocalWorkspaceHref(href, 'bevel.is')).toBe(href)
  })
})
