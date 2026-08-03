/**
 * Suite launch dock — consumed by product nav chrome (e.g. 2x4m NavigationClean).
 *
 * GET /api/suite/launch
 * - Session-aware (Auth.js cookie on suite hosts Domain=.2x4m.cc / .bevel.is)
 * - CORS for same-site suite origins so shop.2x4m.cc can credentials-fetch this
 * - Powers unread badge + hover preview without embedding the full workspace
 */

import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { bevelApiFetch } from '@/lib/bevel-api.server'
import { bevelChannelPath } from '@/lib/bevel'

export const dynamic = 'force-dynamic'

type TimelineItem = {
  id?: string
  kind?: string
  channelSlug?: string | null
  actorLabel?: string | null
  bodyPreview?: string | null
  createdAt?: string | null
  unread?: boolean
  readAt?: string | null
}

const SUITE_ORIGIN_RE =
  /^https:\/\/([a-z0-9-]+\.)*(2x4m\.(cc|lvh\.me|systems)|bevel\.(is|lvh\.me|com))(?::\d+)?$/i

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get('origin') || ''
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
  if (origin && SUITE_ORIGIN_RE.test(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Credentials'] = 'true'
  }
  return headers
}

function requestOrigin(request: Request): string {
  try {
    const url = new URL(request.url)
    const host =
      request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
      request.headers.get('host') ||
      url.host
    const proto =
      request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim() ||
      url.protocol.replace(':', '') ||
      'https'
    return `${proto}://${host}`.replace(/\/$/, '')
  } catch {
    return 'https://bevel.2x4m.cc'
  }
}

function workspaceLabel(host: string): string {
  // bevel.2x4m.cc → 2x4m; bevel.is → BEVEL
  const h = host.toLowerCase()
  if (h === 'bevel.is' || h === 'www.bevel.is' || h === 'bevel.lvh.me') {
    return 'BEVEL'
  }
  const m = h.match(/^bevel\.([a-z0-9-]+)\./i)
  if (m?.[1]) return m[1]
  return 'workspace'
}

function itemHref(base: string, item: TimelineItem): string {
  const slug = (item.channelSlug || '').trim()
  if (slug) {
    return `${base}${bevelChannelPath(slug)}`
  }
  return `${base}/bevel/timeline`
}

function isUnread(item: TimelineItem): boolean {
  if (typeof item.unread === 'boolean') return item.unread
  return !item.readAt
}

function buildStarts(base: string) {
  return [
    { label: 'Timeline', href: `${base}/bevel/timeline` },
    { label: 'Talk', href: `${base}/bevel/talk` },
    { label: 'Home', href: `${base}/bevel` },
  ]
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(request) })
}

export async function GET(request: Request) {
  const headers = corsHeaders(request)
  const base = requestOrigin(request)
  const host = base.replace(/^https?:\/\//, '')
  const starts = buildStarts(base)

  const session = await auth()
  if (!session?.user?.email) {
    const login = `${base}/login?callbackUrl=${encodeURIComponent('/bevel')}`
    return NextResponse.json(
      {
        ok: true,
        signedIn: false,
        workspace: { host, label: workspaceLabel(host) },
        unreadCount: 0,
        primaryHref: login,
        primaryLabel: 'Sign in to BEVEL',
        latest: null,
        starts,
      },
      {
        status: 200,
        headers: {
          ...headers,
          'Cache-Control': 'private, max-age=15',
        },
      },
    )
  }

  let items: TimelineItem[] = []
  try {
    const res = await bevelApiFetch('/api/v1/timeline?limit=20')
    const data = (await res.json().catch(() => ({}))) as {
      items?: TimelineItem[]
    }
    if (res.ok && Array.isArray(data.items)) {
      items = data.items
    }
  } catch {
    items = []
  }

  const unread = items.filter(isUnread)
  const unreadCount = unread.length
  const latestSource = unread[0] ?? items[0] ?? null
  const latest = latestSource
    ? {
        id: latestSource.id ?? null,
        channelSlug: latestSource.channelSlug ?? null,
        actorLabel: latestSource.actorLabel ?? null,
        bodyPreview: (latestSource.bodyPreview || '').slice(0, 180),
        createdAt: latestSource.createdAt ?? null,
        href: itemHref(base, latestSource),
        kind: latestSource.kind ?? null,
      }
    : null

  let primaryHref = `${base}/bevel`
  let primaryLabel = 'Open BEVEL'
  if (latest?.channelSlug) {
    primaryHref = latest.href
    primaryLabel = `Open #${latest.channelSlug}`
  } else if (unreadCount > 0) {
    primaryHref = `${base}/bevel/timeline`
    primaryLabel = 'Open timeline'
  }

  return NextResponse.json(
    {
      ok: true,
      signedIn: true,
      workspace: { host, label: workspaceLabel(host) },
      unreadCount,
      primaryHref,
      primaryLabel,
      latest,
      starts,
    },
    {
      status: 200,
      headers: {
        ...headers,
        'Cache-Control': 'private, max-age=15',
      },
    },
  )
}
