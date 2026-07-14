import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import type { AgentActivityKind } from '@/lib/github'
import { postProductChannelMessage } from '@/lib/product-channel'

export const runtime = 'nodejs'

/**
 * Log an agent key move into ^product (and optionally general).
 * Used by work-mode dispatches, JOHNNY programs, CI, and GitHub Actions.
 *
 * Auth: session OR X-Fleet-Internal-Key OR loopback in development.
 */
function authorized(request: Request, hasSession: boolean): boolean {
  if (hasSession) return true
  const key = process.env.FLEET_INTERNAL_API_KEY
  const header = request.headers.get('x-fleet-internal-key')
  if (key && header === key) return true
  if (process.env.NODE_ENV !== 'production') {
    const xf = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
    if (!xf || xf === '127.0.0.1' || xf === '::1') return true
  }
  if (!key) {
    const xf = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
    if (!xf || xf === '127.0.0.1') return true
  }
  return false
}

export async function POST(request: Request) {
  const session = await auth()
  if (!authorized(request, Boolean(session?.user))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    kind?: AgentActivityKind
    agentId?: string
    agentName?: string
    title?: string
    body?: string
    repo?: string
    url?: string
    issueNumber?: number
    alsoGeneral?: boolean
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const title = (body.title || '').trim()
  if (!title) {
    return NextResponse.json({ error: 'title required' }, { status: 400 })
  }

  const kind = body.kind || 'work_dispatch'
  const product = await postProductChannelMessage({
    kind,
    agentId: body.agentId,
    agentName: body.agentName,
    title,
    body: body.body,
    repo: body.repo,
    url: body.url,
    issueNumber: body.issueNumber,
  })

  let general = null
  if (body.alsoGeneral) {
    general = await postProductChannelMessage({
      kind,
      agentId: body.agentId,
      agentName: body.agentName,
      title,
      body: body.body,
      repo: body.repo,
      url: body.url,
      issueNumber: body.issueNumber,
      channelSlug: 'general',
    })
  }

  return NextResponse.json({
    ok: true,
    product,
    general,
    accountability: {
      channel: 'product',
      path: '/^product',
      etiquette: 'See GITHUB.md — every agent move links to GitHub when possible.',
    },
  })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST agent key moves → ^product channel with GitHub links',
    example: {
      kind: 'work_dispatch',
      agentId: 'forge',
      title: 'Implemented channel search polish',
      body: 'Opened PR and linked tests',
      repo: 'derozic/2x4m',
      url: 'https://github.com/derozic/2x4m/pull/42',
    },
  })
}
