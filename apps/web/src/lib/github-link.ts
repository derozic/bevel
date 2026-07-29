'use client'

import { signIn } from 'next-auth/react'

/** Default post-link surface — work mode / accountability channel. */
export const GITHUB_LINK_CALLBACK = '/~product?github=linked'

/**
 * Start GitHub OAuth for work-mode account linking.
 * Always returns to `~product` so operators land on the work channel after link.
 */
export async function linkGitHubForWork(options?: {
  /** Extra query (e.g. source channel) appended after github=linked. */
  from?: string
}): Promise<void> {
  const params = new URLSearchParams()
  params.set('github', 'linked')
  if (options?.from?.trim()) params.set('from', options.from.trim())
  // Always return to the product work channel after OAuth.
  const callbackUrl = `/~product?${params.toString()}`

  // Prefer Auth.js client (CSRF + session). Provider must be configured
  // (AUTH_GITHUB_ID + AUTH_GITHUB_SECRET) or this redirects to Configuration error.
  await signIn('github', { callbackUrl })
}

export async function isGitHubProviderAvailable(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/providers', { credentials: 'same-origin' })
    if (!res.ok) return false
    const data = (await res.json()) as Record<string, unknown>
    return Boolean(data.github)
  } catch {
    return false
  }
}
