import { NextResponse } from 'next/server'
import {
  bevelApiFetch,
  hostTenantSlug,
  stampTenant,
  withTenantQuery,
} from '@/lib/bevel-api.server'

export async function GET(request: Request) {
  const tenant = await hostTenantSlug()
  const url = new URL(request.url)
  url.searchParams.delete('tenant')
  const qs = url.searchParams.toString()
  const path = withTenantQuery(`/api/v1/tags${qs ? `?${qs}` : ''}`, tenant)
  try {
    const res = await bevelApiFetch(path)
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
    const res = await bevelApiFetch('/api/v1/tags', {
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

export async function DELETE(request: Request) {
  const tenant = await hostTenantSlug()
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  try {
    const res = await bevelApiFetch('/api/v1/tags', {
      method: 'DELETE',
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
