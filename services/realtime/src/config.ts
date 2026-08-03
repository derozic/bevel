import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = dirname(fileURLToPath(import.meta.url))

/**
 * Resolve agents package root for runner.js.
 * Prefer AGENTS_REPO_ROOT. In production, fall back to /opt/bevel/agents when
 * present — monorepo-relative ../../.. resolves to /opt/bevel which lacks deps.
 */
function resolveRepoRoot(): string {
  if (process.env.AGENTS_REPO_ROOT) return process.env.AGENTS_REPO_ROOT
  const productionAgents = '/opt/bevel/agents'
  if (
    process.env.NODE_ENV === 'production' &&
    existsSync(join(productionAgents, 'dist', 'runner.js'))
  ) {
    return productionAgents
  }
  // services/realtime/dist → monorepo root (dev) or agents sibling
  const monorepoRoot = join(moduleDir, '../../..')
  const siblingAgents = join(monorepoRoot, 'agents')
  if (existsSync(join(siblingAgents, 'dist', 'runner.js'))) {
    return siblingAgents
  }
  return monorepoRoot
}

const repoRoot = resolveRepoRoot()

export const config = {
  port: Number(process.env.REALTIME_PORT ?? process.env.AGENTS_REALTIME_PORT ?? 43208),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  repoRoot,
  workspaceRoot: process.env.AGENTS_WORKSPACE_ROOT ?? repoRoot,
  workRepo: process.env.BEVEL_WORK_REPO ?? 'derozic/2x4m',
  registryPath:
    process.env.AGENTS_REGISTRY_PATH ?? join(repoRoot, 'registry.json'),
  federatedRoot: process.env.AGENTS_FEDERATED_ROOT ?? '',
  recordingsDir: process.env.AGENTS_SESSIONS_DIR ?? '',
}