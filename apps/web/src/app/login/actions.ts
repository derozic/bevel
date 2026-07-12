/**
 * Server-action OAuth helpers are intentionally unused.
 *
 * Next.js server actions on this login surface produced
 * `TypeError: Failed to fetch` (fetchServerAction) under HMR / multi-host
 * HTTPS. Sign-in goes through Auth.js form POST in GoogleSignInButton.tsx.
 *
 * Keep this file as a stub so any stale imports fail clearly at build time
 * rather than silently reintroducing broken actions.
 */

export async function signInWithGoogle(): Promise<never> {
  throw new Error(
    'signInWithGoogle server action is disabled — use GoogleSignInButton form POST.',
  )
}

export async function signInWithGitHub(): Promise<never> {
  throw new Error(
    'signInWithGitHub server action is disabled — use GitHubSignInButton form POST.',
  )
}
