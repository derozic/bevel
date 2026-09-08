import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { publicOriginFromRequest } from '@/lib/public-origin'
import { resolveWorkspaceOpenUrl } from '@/lib/workspace-spaces.server'

export const dynamic = 'force-dynamic'

function requestHost(request: Request): string {
  return (
    request.headers.get('x-bevel-host') ??
    request.headers.get('x-forwarded-host') ??
    request.headers.get('host') ??
    ''
  )
    .split(',')[0]
    ?.trim()
    .toLowerCase()
    .split(':')[0] || ''
}

export async function GET(request: Request) {
  const origin = publicOriginFromRequest(request)
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.redirect(`${origin}/login?callbackUrl=%2Fworkspaces`)
  }

  const slug = new URL(request.url).searchParams.get('slug') || ''
  const href = await resolveWorkspaceOpenUrl({
    slug,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
    fromHost: requestHost(request),
  })
  if (!href) {
    return NextResponse.redirect(`${origin}/workspaces`)
  }
  const dest = href.startsWith('/') ? `${origin}${href}` : href
  return NextResponse.redirect(dest, { status: 302 })
}
