import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { githubCreateIssue, parseWorkRepos } from '@/lib/github'
import { getGitHubAccessToken } from '@/lib/github-session'
import { postProductChannelMessage } from '@/lib/product-channel'

export const runtime = 'nodejs'

/**
 * Create a GitHub issue from BEVEL (work mode / agents) and log to ^product.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!session.githubLogin) {
    return NextResponse.json(
      { error: 'Link GitHub for work mode write access' },
      { status: 403 },
    )
  }

  let body: {
    title?: string
    body?: string
    repo?: string
    labels?: string[]
    agentId?: string
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

  const repos = parseWorkRepos(
    undefined,
    process.env.BEVEL_WORK_REPO || 'derozic/2x4m',
  )
  const repo =
    body.repo && repos.some((r) => r.toLowerCase() === body.repo!.toLowerCase())
      ? body.repo
      : repos[0]!

  const { accessToken } = await getGitHubAccessToken(request)
  if (!accessToken) {
    return NextResponse.json(
      {
        error: 'GitHub token missing — re-link GitHub from Integrations',
        relink: true,
      },
      { status: 403 },
    )
  }

  const issue = await githubCreateIssue(accessToken, repo, {
    title,
    body: [
      body.body || '',
      '',
      '---',
      `_Opened from BEVEL work mode by @${session.githubLogin}_`,
      body.agentId ? `_Agent: ${body.agentId}_` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    labels: body.labels,
  })

  if (!issue) {
    return NextResponse.json(
      { error: 'GitHub issue create failed — check repo access' },
      { status: 502 },
    )
  }

  const product = await postProductChannelMessage({
    kind: 'issue_opened',
    agentId: body.agentId || 'system',
    title: `Opened #${issue.number}: ${issue.title}`,
    body: body.body?.slice(0, 400),
    repo,
    url: issue.html_url,
    issueNumber: issue.number,
  })

  return NextResponse.json({
    ok: true,
    issue: {
      number: issue.number,
      title: issue.title,
      url: issue.html_url,
      repo,
    },
    product,
  })
}
