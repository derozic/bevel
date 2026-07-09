import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const moduleDir = dirname(fileURLToPath(import.meta.url))

const repoRoot = process.env.AGENTS_REPO_ROOT ?? join(moduleDir, '../../..')

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