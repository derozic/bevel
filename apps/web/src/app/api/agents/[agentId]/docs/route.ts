import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAgentById } from '@/lib/agent-catalog'
import { canEditAgentFiles } from '@/lib/agent-edit-access'
import {
  AGENT_ID_RE,
  loadAgentDossier,
  readAgentDoc,
  writeAgentDoc,
} from '@/lib/agent-files'

export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { agentId } = await params
  const id = agentId.toLowerCase()
  if (!AGENT_ID_RE.test(id) || !getAgentById(id)) {
    return NextResponse.json({ error: 'Unknown agent' }, { status: 404 })
  }
  const url = new URL(request.url)
  const path = url.searchParams.get('path')
  if (path) {
    const doc = readAgentDoc(id, path)
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({
      doc,
      canEdit: canEditAgentFiles(session),
    })
  }
  return NextResponse.json({
    dossier: loadAgentDossier(id),
    canEdit: canEditAgentFiles(session),
  })
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!canEditAgentFiles(session)) {
    return NextResponse.json(
      { error: 'You do not have credentials to edit agent files.' },
      { status: 403 },
    )
  }
  const { agentId } = await params
  const id = agentId.toLowerCase()
  if (!AGENT_ID_RE.test(id) || !getAgentById(id)) {
    return NextResponse.json({ error: 'Unknown agent' }, { status: 404 })
  }
  const body = (await request.json().catch(() => null)) as {
    path?: string
    content?: string
  } | null
  if (!body?.path || typeof body.content !== 'string') {
    return NextResponse.json({ error: 'path and content required' }, { status: 400 })
  }
  try {
    const result = writeAgentDoc(id, body.path, body.content)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Write failed' },
      { status: 400 },
    )
  }
}
