/**
 * Server-side helpers to call the BEVEL FastAPI control plane.
 */

import { getTenantFromRequest } from '@bevel/tenant-config'
import { auth } from '@/auth'

/** Tenant slug for the current Host. Never trust a client-supplied tenant. */
export async function hostTenantSlug(): Promise<string | null> {
  const tenant = await getTenantFromRequest()
  return tenant?.slug ?? null
}

export function withTenantQuery(
  path: string,
  tenant: string | null | undefined,
): string {
  if (!tenant) return path
  const join = path.includes('?') ? '&' : '?'
  return `${path}${join}tenant=${encodeURIComponent(tenant)}`
}

export function stampTenant<T extends Record<string, unknown>>(
  body: T,
  tenant: string | null,
): T & { tenant?: string } {
  if (!tenant) return body
  return { ...body, tenant }
}

export function bevelApiBase(): string {
  return (
    process.env.API_INTERNAL_URL ||
    process.env.BEVEL_API_URL ||
    process.env.NEXT_PUBLIC_BEVEL_API_URL ||
    'http://127.0.0.1:43203'
  ).replace(/\/$/, '')
}

export function fleetInternalHeaders(
  extra?: Record<string, string>,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  }
  const key = process.env.FLEET_INTERNAL_API_KEY
  if (key) headers['X-Fleet-Internal-Key'] = key
  return headers
}

/** Forward session identity so API can resolve the user. */
export async function sessionUserHeaders(): Promise<{
  headers: Record<string, string>
  email: string | null
  userId: string | null
}> {
  const session = await auth()
  const email = session?.user?.email ?? null
  const userId =
    (session?.user as { id?: string } | undefined)?.id ?? null
  const name = session?.user?.name ?? null
  const headers = fleetInternalHeaders()
  if (email) headers['X-Bevel-User-Email'] = email
  if (userId) headers['X-Bevel-User-Id'] = userId
  if (name) headers['X-Bevel-User-Name'] = name
  return { headers, email, userId }
}

export async function bevelApiFetch(
  path: string,
  init?: RequestInit & { auth?: boolean },
): Promise<Response> {
  const url = `${bevelApiBase()}${path.startsWith('/') ? path : `/${path}`}`
  const headers = new Headers(init?.headers)
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json')
  }
  if (init?.auth !== false) {
    const { headers: authHeaders } = await sessionUserHeaders()
    for (const [k, v] of Object.entries(authHeaders)) {
      if (!headers.has(k)) headers.set(k, v)
    }
  } else {
    const fleet = fleetInternalHeaders()
    for (const [k, v] of Object.entries(fleet)) {
      if (!headers.has(k)) headers.set(k, v)
    }
  }
  return fetch(url, { ...init, headers })
}
