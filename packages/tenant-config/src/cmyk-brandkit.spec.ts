import { describe, expect, it } from 'vitest'
import {
  brandMarkFromKit,
  mergeBrandKitIntoTheme,
  processColorForKey,
  processFromKit,
  resolveCmykKitId,
  stripCssUrl,
  type CmykBrandKitTheme,
} from './cmyk-brandkit'
import { compileTenant, loadDeclarativeTenant } from './loader'
import type { Tenant } from '@bevel/schema'

function stubTenant(): Tenant {
  return {
    id: 'tenant_2x4m',
    slug: '2x4m',
    name: '2x4m',
    host: 'bevel.2x4m.lvh.me',
    hosts: ['bevel.2x4m.lvh.me'],
    status: 'active',
    plan: 'pro',
    featureAccess: 'beta',
    auth: { providers: ['google'] },
    features: {},
    theme: {
      accent: '#7c3aed',
      mode: 'light',
      productName: '2x4m',
      logoUrl: '/brand/2x4m/logo.svg',
      cmykKitId: '2x4m',
    },
    realtime: { namespace: '2x4m' },
    workRepos: [],
  } as unknown as Tenant
}

describe('CMYK brand kit mapping', () => {
  it('strips quoted CSS urls', () => {
    expect(stripCssUrl('"https://cdn.example/mark.svg"')).toBe(
      'https://cdn.example/mark.svg',
    )
    expect(stripCssUrl('url("https://cdn.example/mark.svg")')).toBe(
      'https://cdn.example/mark.svg',
    )
  })

  it('picks a stable process color per slug', () => {
    const a = processColorForKey('product')
    const b = processColorForKey('product')
    const c = processColorForKey('ops')
    expect(a).toBe(b)
    expect(['#0ea5e9', '#d946ef', '#eab308', '#111827']).toContain(a)
    expect(c).toBeTruthy()
  })

  it('prefers kit id from the tenant theme', () => {
    expect(resolveCmykKitId(stubTenant())).toBe('2x4m')
    expect(resolveCmykKitId({ ...stubTenant(), theme: { accent: '#000', mode: 'dark' } })).toBe(
      '2x4m',
    )
  })

  it('merges kit tokens onto the workspace theme', () => {
    const kit: CmykBrandKitTheme = {
      name: '2x4m Platform Kit',
      tokens: { accent: '#0ea5e9', background: '#f8fafc', foreground: '#0f172a' },
      logos: { icon: 'https://cdn.example/2x4m.svg' },
      cmyk: { cyan: '#0ea5e9', magenta: '#d946ef', yellow: '#eab308', key: '#111827' },
    }
    const next = mergeBrandKitIntoTheme(stubTenant(), kit)
    expect(next.theme.accent).toBe('#0ea5e9')
    expect(next.theme.background).toBe('#f8fafc')
    expect(next.theme.brandIconUrl).toBe('https://cdn.example/2x4m.svg')
    expect(processFromKit(kit).cyan).toBe('#0ea5e9')
    expect(brandMarkFromKit(kit)).toBe('https://cdn.example/2x4m.svg')
  })

  it('compiles 2x4m yaml with a CMYK kit id', () => {
    const tenant = compileTenant(loadDeclarativeTenant('2x4m'))
    expect(tenant.theme.cmykKitId).toBe('2x4m')
    expect(tenant.theme.logoUrl).toMatch(/\/brand\/2x4m\//)
  })
})
