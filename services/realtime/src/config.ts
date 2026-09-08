import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = dirname(fileURLToPath(import.meta.url))

// Fleet code lives in ~/dev/agents (runner + per-agent SOUL.md).
// BEVEL copies registry/avatars via pnpm sync:agents; runtime still loads
// the agents package from AGENTS_REPO_ROOT.
//
// A leftover `/opt/bevel/dist/runner.js` (stale agents build dumped into the
// Bevel checkout) is not a valid root — require that `src/agents` exists too.
export function isAgentsRepoRoot(dir: string): boolean {
  if (!dir) return false
  return (
    existsSync(join(dir, 'dist', 'runner.js')) && existsSync(join(dir, 'src', 'agents'))
  )
}

export function resolveAgentsRepoRoot(opts?: {
  envRoot?: string | null
  candidates?: string[]
}): string {
  const envRoot = (
    opts && 'envRoot' in opts ? opts.envRoot : process.env.AGENTS_REPO_ROOT
  )
    ?.trim()
  const candidates = [
    envRoot,
    envRoot ? join(envRoot, 'agents') : '',
    ...(opts?.candidates ?? [
      // sibling of bevel: ~/dev/agents
      join(moduleDir, '../../../../agents'),
      // when running from compiled dist/ under services/realtime
      join(moduleDir, '../../../../../agents'),
      // monorepo-style fallback (legacy) — only accepted if src/agents exists
      join(moduleDir, '../../..'),
    ]),
  ].filter((c): c is string => Boolean(c))

  for (const c of candidates) {
    if (isAgentsRepoRoot(c)) return c
  }
  return envRoot || candidates[0] || join(moduleDir, '../../../../agents')
}

const repoRoot = resolveAgentsRepoRoot()

function resolveRegistryPath(): string {
  if (process.env.AGENTS_REGISTRY_PATH) return process.env.AGENTS_REGISTRY_PATH
  const candidates = [
    join(repoRoot, 'registry.json'),
    // BEVEL-synced catalog (always refresh with pnpm sync:agents)
    join(moduleDir, '../../../registry.json'),
    join(moduleDir, '../../../../registry.json'),
  ]
  return candidates.find((path) => existsSync(path)) ?? candidates[0]
}

export const config = {
  port: Number(process.env.REALTIME_PORT ?? process.env.AGENTS_REALTIME_PORT ?? 43208),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  repoRoot,
  workspaceRoot: process.env.AGENTS_WORKSPACE_ROOT ?? repoRoot,
  workRepo: process.env.BEVEL_WORK_REPO ?? 'derozic/2x4m',
  registryPath: resolveRegistryPath(),
  federatedRoot: process.env.AGENTS_FEDERATED_ROOT ?? '',
  recordingsDir: process.env.AGENTS_SESSIONS_DIR ?? '',
}
