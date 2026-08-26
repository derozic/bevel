import { NextResponse } from 'next/server'
import {
  bevelApiFetch,
  hostTenantSlug,
  stampTenant,
  withTenantQuery,
} from '@/lib/bevel-api.server'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const tenant = await hostTenantSlug()
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  try {
    const res = await bevelApiFetch(`/api/v1/webhooks/${encodeURIComponent(id)}`, {
      method: 'PATCH',
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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  const tenant = await hostTenantSlug()
  try {
    const res = await bevelApiFetch(
      withTenantQuery(`/api/v1/webhooks/${encodeURIComponent(id)}`, tenant),
      { method: 'DELETE' },
    )
    const data = await res.json().catch(() => ({}))
    return NextResponse.json(data, { status: res.status })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'failed' },
      { status: 502 },
    )
  }
}
