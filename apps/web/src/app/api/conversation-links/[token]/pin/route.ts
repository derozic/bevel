import { NextResponse } from 'next/server'
import { bevelApiFetch } from '@/lib/bevel-api.server'
import { joinPassCookie, pinOkCookie } from '@/lib/join-pass'

export async function POST(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params
  const body = (await request.json().catch(() => null)) as { pin?: string } | null
  const pin = body?.pin?.trim() ?? ''
  if (!/^\d{4}$|^\d{6}$|^\d{8}$/.test(pin)) {
    return NextResponse.json({ error: 'Enter a 4, 6, or 8 digit code' }, { status: 400 })
  }
  const res = await bevelApiFetch(
    `/api/v1/conversation-links/${encodeURIComponent(token)}/pin`,
    { method: 'POST', auth: false, body: JSON.stringify({ pin }) },
  )
  const data = (await res.json().catch(() => ({}))) as {
    href?: string | null
    linkId?: string
    detail?: string
    needsSignIn?: boolean
    pinOk?: boolean
  }
  if (!res.ok || !data.pinOk) {
    const detail = typeof data.detail === 'string' ? data.detail : 'That code does not match'
    return NextResponse.json({ error: detail }, { status: res.status || 401 })
  }
  if (data.needsSignIn || !data.href) {
    const response = NextResponse.json({
      needsSignIn: true,
      message: 'Code accepted. Sign in below to finish.',
    })
    const cookie = pinOkCookie(token)
    response.cookies.set(cookie.name, cookie.value, cookie.options)
    return response
  }
  const response = NextResponse.json({ href: data.href })
  const cookie = joinPassCookie(data.href, data.linkId || token)
  response.cookies.set(cookie.name, cookie.value, cookie.options)
  return response
}
