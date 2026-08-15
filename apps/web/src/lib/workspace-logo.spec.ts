import { describe, expect, it } from 'vitest'
import { resolveWorkspaceLogoUrl } from './workspace-logo'

describe('resolveWorkspaceLogoUrl', () => {
  it('does not invent a logo for the synthetic platform tenant', () => {
    expect(
      resolveWorkspaceLogoUrl({ tenantSlug: 'platform' }),
    ).toBeUndefined()
    expect(resolveWorkspaceLogoUrl({ tenantSlug: 'PLATFORM' })).toBeUndefined()
  })

  it('uses explicit urls and daypart slots', () => {
    expect(
      resolveWorkspaceLogoUrl({
        tenantSlug: 'platform',
        logoUrl: '/brand/bevel-mark.svg',
      }),
    ).toBe('/brand/bevel-mark.svg')
    expect(
      resolveWorkspaceLogoUrl({
        daypart: 'night',
        logoUrlsByDaypart: { night: '/brand/2x4m/logo-night.svg' },
        tenantSlug: '2x4m',
      }),
    ).toBe('/brand/2x4m/logo-night.svg')
  })

  it('keeps on-disk convention for real product slugs', () => {
    expect(resolveWorkspaceLogoUrl({ tenantSlug: '2x4m' })).toBe(
      '/brand/2x4m/logo.svg',
    )
  })
})
