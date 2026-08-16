import { NextResponse } from 'next/server'
import { cmykBrandKitHost } from '@bevel/tenant-config'

export const dynamic = 'force-dynamic'

/** Proxies CMYK BrandKit list when an org API key is configured. */
export async function GET() {
  const host = cmykBrandKitHost()
  const key = process.env.CMYK_BRANDKIT_API_KEY?.trim()
  if (!key) {
    return NextResponse.json(
      {
        error: 'missing_api_key',
        hint: 'Set CMYK_BRANDKIT_API_KEY (scope brandkits:read) to list kits.',
        host,
      },
      { status: 401 },
    )
  }
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 4000)
  try {
    const res = await fetch(`${host}/brandkits/api/brand-kits/`, {
      headers: { Accept: 'application/json', 'X-API-Key': key },
      signal: ctrl.signal,
    })
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    return NextResponse.json({ error: 'cmyk_unreachable', host }, { status: 502 })
  } finally {
    clearTimeout(timer)
  }
}
