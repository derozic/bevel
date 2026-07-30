import { NextRequest } from 'next/server'
import { handlers } from '@/auth'

/**
 * Auth.js builds provider/callback URLs from the request URL. Behind Caddy,
 * Next can see `http://127.0.0.1:41009` even when Host is bevel.2x4m.cc.
 * Rebuild the Request with the public origin so OAuth redirect_uri is correct
 * on every multi-host surface (bevel.is, bevel.2x4m.cc, *.lvh.me).
 */
function publicRequest(req: NextRequest): NextRequest {
  const xfHost = (
    req.headers.get('x-forwarded-host') ??
    req.headers.get('x-bevel-host') ??
    req.headers.get('host') ??
    ''
  )
    .split(',')[0]
    ?.trim()
    .toLowerCase()
  const hostOnly = (xfHost || '').split(':')[0] || ''
  const isLoopback =
    !hostOnly ||
    hostOnly === 'localhost' ||
    hostOnly === '127.0.0.1' ||
    hostOnly === '0.0.0.0' ||
    hostOnly === '::1'

  if (isLoopback) {
    return req
  }

  const xfProto = (
    req.headers.get('x-forwarded-proto') ??
    (req.nextUrl.protocol === 'https:' ? 'https' : 'https')
  )
    .split(',')[0]
    ?.trim()
    .toLowerCase()
  const proto = xfProto === 'http' || xfProto === 'https' ? xfProto : 'https'
  const publicOrigin = `${proto}://${hostOnly}`
  const url = new URL(req.nextUrl.pathname + req.nextUrl.search, publicOrigin)

  const headers = new Headers(req.headers)
  headers.set('x-forwarded-host', hostOnly)
  headers.set('x-forwarded-proto', proto)
  headers.set('host', hostOnly)

  // GET has no body; for POST pass through the original body stream.
  if (req.method === 'GET' || req.method === 'HEAD') {
    return new NextRequest(url, { method: req.method, headers })
  }
  return new NextRequest(url, {
    method: req.method,
    headers,
    body: req.body,
    // Required when forwarding a readable stream body in the Fetch API.
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })
}

export async function GET(req: NextRequest) {
  return handlers.GET(publicRequest(req))
}

export async function POST(req: NextRequest) {
  return handlers.POST(publicRequest(req))
}
