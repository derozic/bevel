import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { config } from './config.js'

export type CatalogAgent = {
  id: string
  name: string
  accent?: string
  status?: string
  implementation?: string
  federated?: boolean
  source?: { repo?: string; path?: string }
}

function readRegistry(filePath: string): CatalogAgent[] {
  if (!existsSync(filePath)) return []
  try {
    const parsed = JSON.parse(readFileSync(filePath, 'utf8')) as { agents?: CatalogAgent[] }
    return parsed.agents ?? []
  } catch {
    return []
  }
}

export function loadMergedRegistry(): CatalogAgent[] {
  const byId = new Map<string, CatalogAgent>()

  for (const agent of readRegistry(config.registryPath)) {
    byId.set(agent.id, { ...agent, federated: false })
  }

  const localPath = join(config.workspaceRoot, '.agents-registry.json')
  for (const agent of readRegistry(localPath)) {
    if (!byId.has(agent.id)) {
      byId.set(agent.id, { ...agent, federated: true })
    }
  }

  return [...byId.values()]
}