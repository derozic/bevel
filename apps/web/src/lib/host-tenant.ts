/** Browser helper: tenant slug stamped on <html> by the root layout. */

export function hostTenantSlug(): string | null {
  if (typeof document === 'undefined') return null
  return document.documentElement.getAttribute('data-tenant-slug')
}

export function withTenantOnPath(path: string, slug: string | null): string {
  if (!slug) return path
  const hashIndex = path.indexOf('#')
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : ''
  const withoutHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path
  const join = withoutHash.includes('?') ? '&' : '?'
  if (new URLSearchParams(withoutHash.split('?')[1] || '').has('tenant')) {
    return path
  }
  return `${withoutHash}${join}tenant=${encodeURIComponent(slug)}${hash}`
}

export function withHostTenant(path: string): string {
  return withTenantOnPath(path, hostTenantSlug())
}
