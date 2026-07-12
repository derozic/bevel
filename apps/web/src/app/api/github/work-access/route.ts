import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isGitHubOAuthConfigured } from '@/lib/github'

export const runtime = 'nodejs'

/**
 * Work-mode GitHub link status for the signed-in operator.
 * FleetChat uses this for the "Link GitHub" banner.
 */
export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const githubEnabled = isGitHubOAuthConfigured()
  const linked = Boolean(session.githubLogin)
  const canPutOnWork = Boolean(session.canPutOnWork)

  return NextResponse.json({
    githubEnabled,
    linked,
    login: session.githubLogin ?? null,
    canPutOnWork,
    requireGitHubForWork: true,
    scopesHint: 'read:user user:email repo',
    productChannel: 'product',
    docs: '/docs/GITHUB.md',
  })
}
