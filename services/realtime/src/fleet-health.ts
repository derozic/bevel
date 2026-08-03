/**
 * Fleet runtime diagnostics for /health and deploy smoke.
 * Surfaces whether agent-dispatch can load the runner and call OpenRouter.
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { config } from './config.js'

const require = createRequire(import.meta.url)

export type FleetHealth = {
  repoRoot: string
  registryPath: string
  federatedRoot: string
  runnerPath: string
  runner: 'ok' | 'missing' | 'load_error'
  runnerError?: string
  openrouter: 'configured' | 'absent'
  agents: string[]
  agentsError?: string
}

function sanitizeDiagMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err)
  return raw
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/sk-[a-zA-Z0-9_-]+/g, '[redacted-key]')
    .replace(/Authorization:\s*[^\n]+/gi, 'Authorization: [redacted]')
    .slice(0, 240)
}

export function probeFleetHealth(): FleetHealth {
  const runnerPath = join(config.repoRoot, 'dist', 'runner.js')
  const openrouter: FleetHealth['openrouter'] = process.env.OPENROUTER_API_KEY
    ? 'configured'
    : 'absent'

  const base: FleetHealth = {
    repoRoot: config.repoRoot,
    registryPath: config.registryPath,
    federatedRoot: config.federatedRoot || '',
    runnerPath,
    runner: existsSync(runnerPath) ? 'ok' : 'missing',
    openrouter,
    agents: [],
  }

  if (base.runner === 'missing') {
    return base
  }

  try {
    const mod = require(runnerPath) as {
      runAgentChat?: unknown
      listAgents?: () => string[]
    }
    if (typeof mod.runAgentChat !== 'function') {
      base.runner = 'load_error'
      base.runnerError = 'runner.js loaded but runAgentChat export missing'
      return base
    }
    // Prefer registry listAgents when exported; otherwise require registry module
    if (typeof mod.listAgents === 'function') {
      base.agents = mod.listAgents().map(String)
    } else {
      try {
        const reg = require(join(config.repoRoot, 'dist', 'registry.js')) as {
          listAgents?: () => string[]
          AGENT_REGISTRY?: Record<string, unknown>
        }
        if (typeof reg.listAgents === 'function') {
          base.agents = reg.listAgents().map(String)
        } else if (reg.AGENT_REGISTRY && typeof reg.AGENT_REGISTRY === 'object') {
          base.agents = Object.keys(reg.AGENT_REGISTRY)
        }
      } catch (e) {
        base.agentsError = sanitizeDiagMessage(e)
      }
    }
  } catch (e) {
    base.runner = 'load_error'
    base.runnerError = sanitizeDiagMessage(e)
  }

  return base
}

export function fleetHealthStatus(h: FleetHealth): 'ok' | 'degraded' {
  if (h.runner !== 'ok') return 'degraded'
  if (h.openrouter === 'absent') return 'degraded'
  return 'ok'
}
