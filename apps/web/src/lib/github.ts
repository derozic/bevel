/**
 * GitHub work-mode helpers — OAuth-linked access, work repos, issue/activity URLs.
 */

export type GitHubWorkRepo = {
  fullName: string
  default?: boolean
  canWrite: boolean
}

export function isGitHubOAuthConfigured(): boolean {
  const id = process.env.AUTH_GITHUB_ID || process.env.GITHUB_CLIENT_ID
  const secret = process.env.AUTH_GITHUB_SECRET || process.env.GITHUB_CLIENT_SECRET
  return Boolean(id && secret)
}

/** Tenant work repos from env / session claim list. */
export function parseWorkRepos(
  fromSession?: string[] | null,
  fallback = 'derozic/2x4m',
): string[] {
  if (fromSession?.length) return fromSession
  const raw = process.env.BEVEL_WORK_REPOS || process.env.BEVEL_WORK_REPO || fallback
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function githubRepoUrl(fullName: string): string {
  return `https://github.com/${fullName}`
}

export function githubIssueUrl(fullName: string, number: number): string {
  return `https://github.com/${fullName}/issues/${number}`
}

export function githubCompareUrl(fullName: string, base: string, head: string): string {
  return `https://github.com/${fullName}/compare/${base}...${head}`
}

export function githubActionsUrl(fullName: string, runId?: number): string {
  if (runId) return `https://github.com/${fullName}/actions/runs/${runId}`
  return `https://github.com/${fullName}/actions`
}

export function githubReleaseUrl(fullName: string, tag: string): string {
  return `https://github.com/${fullName}/releases/tag/${encodeURIComponent(tag)}`
}

/** Product accountability channel for GH issues + agent moves. */
export const PRODUCT_CHANNEL_SLUG = 'product'

export type AgentActivityKind =
  | 'work_dispatch'
  | 'issue_opened'
  | 'issue_closed'
  | 'issue_reopened'
  | 'pr_opened'
  | 'pr_merged'
  | 'release'
  | 'ci_run'
  | 'program'
  | 'compliance'

export function formatAgentActivityMessage(input: {
  kind: AgentActivityKind
  agentId?: string
  agentName?: string
  title: string
  body?: string
  repo?: string
  url?: string
  issueNumber?: number
}): string {
  const who = (input.agentName || input.agentId || 'agent').toUpperCase()
  const lines = [
    `[github:${input.kind}] ${who} — ${input.title}`,
    input.body?.trim() || '',
    input.repo ? `repo: ${input.repo}` : '',
    input.issueNumber != null ? `issue: #${input.issueNumber}` : '',
    input.url ? `→ ${input.url}` : '',
  ].filter(Boolean)
  return lines.join('\n')
}

/**
 * Check collaborator write permission on a repo using a user access token.
 * Falls back to true when token is present and GH is unreachable in dev.
 */
export async function githubHasWriteAccess(
  token: string,
  fullName: string,
  login?: string,
): Promise<boolean> {
  const [owner, repo] = fullName.split('/')
  if (!owner || !repo) return false

  try {
    if (login) {
      const permRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/collaborators/${encodeURIComponent(login)}/permission`,
        {
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'bevel-work-mode',
          },
          cache: 'no-store',
        },
      )
      if (permRes.ok) {
        const data = (await permRes.json()) as { permission?: string }
        const p = (data.permission || '').toLowerCase()
        return p === 'admin' || p === 'maintain' || p === 'write'
      }
      // 403/404 often means no access
      if (permRes.status === 403 || permRes.status === 404) return false
    }

    // Fallback: can we read the repo with this token?
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'bevel-work-mode',
      },
      cache: 'no-store',
    })
    if (!repoRes.ok) return false
    const repoData = (await repoRes.json()) as {
      permissions?: { push?: boolean; admin?: boolean }
    }
    return Boolean(repoData.permissions?.push || repoData.permissions?.admin)
  } catch {
    // Dev: network blip — trust linked token with repo scope
    return process.env.NODE_ENV !== 'production'
  }
}

export async function githubCreateIssue(
  token: string,
  fullName: string,
  input: { title: string; body?: string; labels?: string[] },
): Promise<{ number: number; html_url: string; title: string } | null> {
  const [owner, repo] = fullName.split('/')
  if (!owner || !repo) return null
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'bevel-work-mode',
      },
      body: JSON.stringify({
        title: input.title,
        body: input.body,
        labels: input.labels,
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as {
      number: number
      html_url: string
      title: string
    }
    return data
  } catch {
    return null
  }
}
