import { NextResponse } from 'next/server'
import {
  bevelApiFetch,
  hostTenantSlug,
  withTenantQuery,
} from '@/lib/bevel-api.server'

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params
  const tenant = await hostTenantSlug()
  try {
    const res = await bevelApiFetch(
      withTenantQuery(`/api/v1/tags/${encodeURIComponent(slug)}`, tenant),
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
