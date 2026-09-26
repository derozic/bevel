import { NextResponse, type NextRequest } from 'next/server'
import { signIn } from '@/auth'
import {
  AppleAuthError,
  appleAuthorizeUrl,
  decodeAppleState,
  emailFromAppleClaims,
  encodeAppleState,
  exchangeAppleCode,
  mintAppleSessionTicket,
  normalizeAppleReturnTo,
  parseAppleUserName,
  verifyAppleIdentityToken,
} from '@bevel/auth'
import { issueAuthHandoffCode } from '@/lib/auth-handoff'
import { publicOriginFromRequest } from '@/lib/public-origin'

function loginError(origin: string, message: string, code = 'Apple') {
  const url = new URL('/login', origin)
  url.searchParams.set('error', code)
  url.searchParams.set('message', message)
  return NextResponse.redirect(url)
}

async function startApple(request: NextRequest) {
  const origin = publicOriginFromRequest(request)
  const returnTo = normalizeAppleReturnTo(
    request.nextUrl.searchParams.get('return_to'),
    origin,
  )
  try {
    const state = await encodeAppleState({ returnTo, origin })
    const url = await appleAuthorizeUrl(state, origin)
    return NextResponse.redirect(url)
  } catch (err) {
    const message =
      err instanceof AppleAuthError
        ? err.message
        : 'Apple sign-in is not configured on this server yet. Use Google.'
    return loginError(origin, message)
  }
}

async function finishApple(opts: {
  request: NextRequest
  code: string
  idToken: string
  state: string
  userBlob: string
  error: string
}) {
  const origin = publicOriginFromRequest(opts.request)
  if (opts.error) {
    if (
      opts.error === 'user_cancelled_authorize' ||
      opts.error === 'access_denied'
    ) {
      return loginError(origin, 'Apple sign-in was cancelled.', 'AppleCancelled')
    }
    return loginError(origin, 'Apple sign-in did not complete.')
  }

  const decoded = await decodeAppleState(opts.state)
  const returnTo = decoded?.returnTo || '/welcome'
  const callbackOrigin = decoded?.origin || origin

  try {
    let idToken = opts.idToken
    if (!idToken && opts.code) {
      const tokens = await exchangeAppleCode(opts.code, callbackOrigin)
      idToken = String(tokens.id_token || '')
    }
    if (!idToken) {
      return loginError(origin, 'Apple did not return an identity token.')
    }
    const claims = await verifyAppleIdentityToken(idToken)
    const appleId = String(claims.sub || '').trim()
    if (!appleId) {
      return loginError(origin, 'Apple did not return a user id.')
    }
    const email = emailFromAppleClaims({
      sub: claims.sub,
      email: claims.email,
    })
    const name = parseAppleUserName(opts.userBlob)
    const ticket = await mintAppleSessionTicket({
      email,
      name,
      appleId,
    })
    await signIn('apple', {
      ticket,
      redirectTo: returnTo.startsWith('/') ? returnTo : '/welcome',
    })
  } catch (err) {
    const dig = err as { digest?: string }
    if (typeof dig?.digest === 'string' && dig.digest.startsWith('NEXT_REDIRECT')) {
      throw err
    }
    const message =
      err instanceof AppleAuthError
        ? err.message
        : 'Apple sign-in failed. Please try again.'
    return loginError(origin, message)
  }

  return NextResponse.redirect(
    new URL(returnTo.startsWith('/') ? returnTo : '/welcome', origin),
  )
}

type Body = {
  identity_token?: string
  identityToken?: string
  full_name?: string
  email?: string
  tenantSlug?: string
  callbackPath?: string
}

async function mobileApple(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Body
  const identityToken = (body.identity_token || body.identityToken || '').trim()
  if (identityToken.length < 20) {
    return NextResponse.json(
      { error: 'identity_token required' },
      { status: 400 },
    )
  }
  try {
    const claims = await verifyAppleIdentityToken(identityToken)
    if (body.email && !claims.email) {
      claims.email = body.email
    }
    const appleId = String(claims.sub || '').trim()
    const email = emailFromAppleClaims({
      sub: claims.sub,
      email: claims.email,
    })
    const name = (body.full_name || '').trim() || email.split('@')[0]
    const path = body.callbackPath?.startsWith('/')
      ? body.callbackPath
      : '/~general'
    const tenantSlug = (body.tenantSlug || '2x4m').trim() || '2x4m'
    const handoff = await issueAuthHandoffCode({
      email,
      name,
      tenantSlug,
      callbackPath: path,
    })
    return NextResponse.json({
      ok: true,
      code: handoff?.code,
      expiresAt: handoff?.expiresAt,
      email,
      name,
      appleId,
      tenantSlug,
      callbackPath: path,
    })
  } catch (err) {
    const message =
      err instanceof AppleAuthError
        ? err.message
        : 'Apple sign-in did not complete.'
    const status = err instanceof AppleAuthError ? err.statusCode : 401
    return NextResponse.json({ error: message }, { status })
  }
}

function slugOf(request: NextRequest): string {
  const parts = request.nextUrl.pathname.replace(/^\/auth\/apple\/?/, '')
  return parts.split('/').filter(Boolean)[0] || ''
}

export async function GET(request: NextRequest) {
  const slug = slugOf(request)
  if (slug === 'callback') {
    const q = request.nextUrl.searchParams
    return finishApple({
      request,
      code: q.get('code') || '',
      idToken: q.get('id_token') || '',
      state: q.get('state') || '',
      userBlob: q.get('user') || '',
      error: q.get('error') || '',
    })
  }
  if (slug) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return startApple(request)
}

export async function POST(request: NextRequest) {
  const slug = slugOf(request)
  if (slug === 'mobile') {
    return mobileApple(request)
  }
  if (slug === 'callback' || slug === '') {
    const form = await request.formData()
    return finishApple({
      request,
      code: String(form.get('code') || ''),
      idToken: String(form.get('id_token') || ''),
      state: String(form.get('state') || ''),
      userBlob: String(form.get('user') || ''),
      error: String(form.get('error') || ''),
    })
  }
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
