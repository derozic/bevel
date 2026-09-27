import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { bevelApiFetch } from '@/lib/bevel-api.server'
import { sessionActorId } from '@/lib/session-user'

const BRAIN_HOST = 'https://bevel.2ndbra.in'

export async function POST(request: Request) {
  const session = await auth()
  if (!sessionActorId(session)) {
    return NextResponse.json({ error: 'Sign in to save into 2ndbrain' }, { status: 401 })
  }
  const body = (await request.json().catch(() => null)) as {
    url?: string
    title?: string
    description?: string
  } | null
  let url: URL
  try {
    url = new URL(body?.url || '')
  } catch {
    return NextResponse.json({ error: 'Need a link' }, { status: 400 })
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return NextResponse.json({ error: 'Need a link' }, { status: 400 })
  }
  const title = (body?.title || url.hostname).slice(0, 160)
  const summary = (body?.description || '').slice(0, 400)
  const res = await bevelApiFetch('/api/v1/ingest/nuggets', {
    method: 'POST',
    body: JSON.stringify({
      tenant: '2ndbrain',
      track: 'clips',
      persist: true,
      timeline: true,
      email: session?.user?.email || '',
      nugget: {
        v: 1,
        scale: 'organism',
        source: 'bevel',
        title,
        summary,
        href: url.toString(),
        atoms: [
          { kind: 'link', label: 'open', value: url.hostname.replace(/^www\./, ''), href: url.toString() },
          { kind: 'chip', label: 'from', value: 'Bevel', tone: 'accent' },
        ],
      },
    }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { detail?: string }
    return NextResponse.json(
      { error: typeof data.detail === 'string' ? data.detail : '2ndbrain did not take the clip' },
      { status: res.status || 502 },
    )
  }
  return NextResponse.json({ ok: true, href: `${BRAIN_HOST}/~clips` })
}
