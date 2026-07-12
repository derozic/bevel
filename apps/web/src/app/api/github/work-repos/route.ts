import { type NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  githubHasWriteAccess,
  isGitHubOAuthConfigured,
  parseWorkRepos,
  type GitHubWorkRepo,
} from '@/lib/github'
import { getGitHubAccessToken } from '@/lib/github-session'

export const runtime = 'nodejs'

/**
 * Work repos the operator may put agents on.
 * Write flags come from linked GitHub token permissions when available.
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const names = parseWorkRepos(
    undefined,
    process.env.BEVEL_WORK_REPO || 'derozic/2x4m',
  )
  const defaultRepo = names[0] || 'derozic/2x4m'
  const githubEnabled = isGitHubOAuthConfigured()
  const linked = Boolean(session.githubLogin)
  const { accessToken } = await getGitHubAccessToken(request)

  const repos: GitHubWorkRepo[] = []
  for (let i = 0; i < names.length; i++) {
    const fullName = names[i]!
    let canWrite = false
    if (linked && session.canPutOnWork) {
      if (accessToken) {
        canWrite = await githubHasWriteAccess(
          accessToken,
          fullName,
          session.githubLogin,
        )
      } else {
        // Linked but token not in JWT yet — re-link, optimistic in local dev
        canWrite = process.env.NODE_ENV !== 'production'
      }
    }
    repos.push({
      fullName,
      default: i === 0,
      canWrite,
    })
  }

  const anyWrite = repos.some((r) => r.canWrite)

  return NextResponse.json({
    repos,
    defaultRepo,
    canPutOnWork: anyWrite || Boolean(session.canPutOnWork && linked),
    githubEnabled,
    linked,
    login: session.githubLogin ?? null,
  })
}
