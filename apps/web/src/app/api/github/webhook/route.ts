import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { postProductChannelMessage } from '@/lib/product-channel'
import type { AgentActivityKind } from '@/lib/github'

export const runtime = 'nodejs'

/**
 * GitHub webhook → ^product channel.
 * Subscribe to: issues, issue_comment, pull_request, release, workflow_run
 *
 * Secret: GITHUB_WEBHOOK_SECRET (HMAC SHA-256 of body).
 */
function verifySignature(raw: string, signature: string | null): boolean {
  const secret = process.env.GITHUB_WEBHOOK_SECRET
  if (!secret) {
    // Dev: allow unsigned when secret unset
    return process.env.NODE_ENV !== 'production'
  }
  if (!signature?.startsWith('sha256=')) return false
  const expected = createHmac('sha256', secret).update(raw).digest('hex')
  const got = signature.slice('sha256='.length)
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(got))
  } catch {
    return false
  }
}

export async function POST(request: Request) {
  const raw = await request.text()
  const sig = request.headers.get('x-hub-signature-256')
  if (!verifySignature(raw, sig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = request.headers.get('x-github-event') || 'unknown'
  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const repoObj = payload.repository as { full_name?: string } | undefined
  const repo = repoObj?.full_name || 'unknown/repo'
  const action = String(payload.action || '')

  let kind: AgentActivityKind | null = null
  let title = ''
  let body = ''
  let url = ''
  let issueNumber: number | undefined
  let agentId = 'system'

  if (event === 'issues') {
    const issue = payload.issue as {
      number?: number
      title?: string
      html_url?: string
      body?: string
      user?: { login?: string }
    }
    issueNumber = issue?.number
    url = issue?.html_url || ''
    body = (issue?.body || '').slice(0, 400)
    if (action === 'opened') {
      kind = 'issue_opened'
      title = `Issue #${issueNumber} opened: ${issue?.title || ''}`
    } else if (action === 'closed') {
      kind = 'issue_closed'
      title = `Issue #${issueNumber} resolved: ${issue?.title || ''}`
    } else if (action === 'reopened') {
      kind = 'issue_reopened'
      title = `Issue #${issueNumber} reopened: ${issue?.title || ''}`
    }
  } else if (event === 'pull_request') {
    const pr = payload.pull_request as {
      number?: number
      title?: string
      html_url?: string
      body?: string
      merged?: boolean
      user?: { login?: string }
    }
    issueNumber = pr?.number
    url = pr?.html_url || ''
    body = (pr?.body || '').slice(0, 400)
    if (action === 'opened') {
      kind = 'pr_opened'
      title = `PR #${issueNumber} opened: ${pr?.title || ''}`
    } else if (action === 'closed' && pr?.merged) {
      kind = 'pr_merged'
      title = `PR #${issueNumber} merged: ${pr?.title || ''}`
    }
  } else if (event === 'release') {
    const release = payload.release as {
      tag_name?: string
      name?: string
      html_url?: string
      body?: string
    }
    if (action === 'published') {
      kind = 'release'
      title = `Release ${release?.tag_name || ''}: ${release?.name || ''}`
      url = release?.html_url || ''
      body = (release?.body || '').slice(0, 400)
    }
  } else if (event === 'workflow_run') {
    const run = payload.workflow_run as {
      id?: number
      name?: string
      html_url?: string
      conclusion?: string
      status?: string
    }
    if (action === 'completed') {
      kind = 'ci_run'
      title = `CI ${run?.name || 'workflow'}: ${run?.conclusion || run?.status || ''}`
      url = run?.html_url || ''
    }
  }

  if (!kind) {
    return NextResponse.json({ ok: true, ignored: true, event, action })
  }

  // Tag agent from labels / body markers like "agent:johnny"
  const labelMatch = body.match(/agent[:\s]+([a-z0-9_-]+)/i)
  if (labelMatch) agentId = labelMatch[1]!.toLowerCase()

  const product = await postProductChannelMessage({
    kind,
    agentId,
    title,
    body,
    repo,
    url,
    issueNumber,
  })

  return NextResponse.json({ ok: true, event, action, kind, product })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    hint: 'POST GitHub webhooks (issues, pull_request, release, workflow_run) → ^product channel',
    events: ['issues', 'pull_request', 'release', 'workflow_run'],
    secretEnv: 'GITHUB_WEBHOOK_SECRET',
  })
}
