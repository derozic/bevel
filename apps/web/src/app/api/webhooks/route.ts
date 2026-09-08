import { NextResponse } from 'next/server'
import {
  bevelApiFetch,
  hostTenantSlug,
  stampTenant,
  withTenantQuery,
} from '@/lib/bevel-api.server'

export async function GET() {
  const tenant = await hostTenantSlug()
  try {
    const res = await bevelApiFetch(withTenantQuery('/api/v1/webhooks', tenant))
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'failed' },
      { status: 502 },
    )
  }
}

export async function POST(request: Request) {
  const tenant = await hostTenantSlug()
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  try {
    const res = await bevelApiFetch('/api/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify(stampTenant(body, tenant)),
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'failed' },
      { status: 502 },
    )
  }
}
