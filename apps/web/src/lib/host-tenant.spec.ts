import { describe, expect, it } from 'vitest'
import { withTenantOnPath } from './host-tenant'

describe('withTenantOnPath', () => {
  it('appends the host tenant without clobbering existing query', () => {
    expect(withTenantOnPath('/api/tags?kind=agent&id=hermes', 'demo')).toBe(
      '/api/tags?kind=agent&id=hermes&tenant=demo',
    )
    expect(withTenantOnPath('/api/tags/ops', '2x4m')).toBe(
      '/api/tags/ops?tenant=2x4m',
    )
  })

  it('does not replace a tenant already on the path', () => {
    expect(withTenantOnPath('/api/tags?tenant=demo', '2x4m')).toBe(
      '/api/tags?tenant=demo',
    )
  })
})
