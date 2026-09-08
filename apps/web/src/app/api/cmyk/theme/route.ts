import { NextResponse } from 'next/server'
import { getTenantFromRequest } from '@bevel/tenant-config'
import {
  fetchCmykBrandKitTheme,
  processFromKit,
  resolveCmykKitId,
} from '@bevel/tenant-config'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const tenant = await getTenantFromRequest()
  const kit =
    url.searchParams.get('kit') ||
    url.searchParams.get('kit_id') ||
    resolveCmykKitId(tenant)
  if (!kit) {
    return NextResponse.json({ error: 'missing_kit' }, { status: 400 })
  }
  const host = url.searchParams.get('host') || tenant?.theme.cmykHost
  const theme = await fetchCmykBrandKitTheme({ kitId: kit, host })
  if (!theme) {
    return NextResponse.json(
      { error: 'kit_unavailable', kit, host: host || null },
      { status: 502 },
    )
  }
  return NextResponse.json({
    kit,
    process: processFromKit(theme),
    theme,
  })
}
