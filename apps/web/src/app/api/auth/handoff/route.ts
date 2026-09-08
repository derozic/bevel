import { NextRequest, NextResponse } from 'next/server'
import { signIn } from '@/auth'
import { publicOriginFromRequest } from '@/lib/public-origin'

/**
 * Redeem a one-time cross-host handoff code and establish a host-local session.
 *
 * Flow: platform /welcome → issue code → redirect here on org host → credentials
 * provider `handoff` redeems via FastAPI → Auth.js sets session cookie.
 */
export async function GET(request: NextRequest) {
  const origin = publicOriginFromRequest(request)
  const code = request.nextUrl.searchParams.get('code')?.trim()
  const callbackUrl =
    request.nextUrl.searchParams.get('callbackUrl') ||
    request.nextUrl.searchParams.get('callback') ||
    '/~general'

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=HandoffMissing', origin))
  }

  // Relative callback only — never open-redirect off-host.
  const safeCallback =
    callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
      ? callbackUrl
      : '/~general'

  try {
    // Auth.js will redirect on success; on failure throws / returns error page.
    await signIn('handoff', {
      code,
      redirectTo: safeCallback,
    })
  } catch (err) {
    // NEXT_REDIRECT is expected from Auth.js success path
    const dig = err as { digest?: string }
    if (typeof dig?.digest === 'string' && dig.digest.startsWith('NEXT_REDIRECT')) {
      throw err
    }
    console.error('[auth/handoff] redeem failed', err)
    return NextResponse.redirect(new URL('/login?error=HandoffFailed', origin))
  }

  return NextResponse.redirect(new URL(safeCallback, origin))
}
