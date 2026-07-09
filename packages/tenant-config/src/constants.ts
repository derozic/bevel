/** Shared header names — safe for Edge middleware (no Node builtins). */

export const TENANT_HEADER = 'x-bevel-tenant'
export const TENANT_HOST_HEADER = 'x-bevel-host'

/**
 * Platform entry hosts — Slack-like "find your workspace" surface.
 * Users sign in here with Google Workspace; email domain routes them to
 * their organization's BEVEL (host + realtime namespace + history).
 */
export const PLATFORM_ENTRY_HOSTS = new Set([
  'bevel.lvh.me',
  'demo.bevel.lvh.me',
  'bevel.com',
  'www.bevel.com',
  'app.bevel.com',
])

/** Hosts that are not customer tenants (admin, marketing apex, local tools). */
export const PLATFORM_HOSTS = new Set([
  'bevel.com',
  'www.bevel.com',
  'admin.bevel.com',
  'admin.bevel.lvh.me',
  'docs.bevel.lvh.me',
  'realtime.bevel.lvh.me',
  'localhost',
  '127.0.0.1',
])

export function isPlatformEntryHost(host: string): boolean {
  return PLATFORM_ENTRY_HOSTS.has(host.toLowerCase().split(':')[0])
}
