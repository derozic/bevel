#!/usr/bin/env node
/**
 * Sync the canonical fleet from ~/dev/agents into this repo.
 *
 * Source of truth: $AGENTS_ROOT/registry.json + public/avatars
 * Writes:
 *   registry.json                         (realtime + API)
 *   apps/web/src/lib/fleet-registry.json  (web catalog import)
 *   apps/web/public/avatars/*             (portraits; never deletes extras)
 *
 * Usage:
 *   pnpm sync:agents
 *   AGENTS_ROOT=/path/to/agents node scripts/sync-agents.mjs
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(scriptDir, '..')
const agentsRoot = process.env.AGENTS_ROOT ?? join(repoRoot, '../agents')
const registrySrc = join(agentsRoot, 'registry.json')
const avatarsSrc = join(agentsRoot, 'public/avatars')
const avatarsDest = join(repoRoot, 'apps/web/public/avatars')
const registryDest = join(repoRoot, 'registry.json')
const webRegistryDest = join(repoRoot, 'apps/web/src/lib/fleet-registry.json')

if (!existsSync(registrySrc)) {
  console.error(`Registry not found: ${registrySrc}`)
  console.error('Set AGENTS_ROOT to the canonical agents repo.')
  process.exit(1)
}

const registry = JSON.parse(readFileSync(registrySrc, 'utf8'))
const agents = Array.isArray(registry.agents) ? registry.agents : []
if (agents.length === 0) {
  console.error('Registry has no agents.')
  process.exit(1)
}

writeFileSync(registryDest, `${JSON.stringify(registry, null, 2)}\n`)
mkdirSync(dirname(webRegistryDest), { recursive: true })
writeFileSync(webRegistryDest, `${JSON.stringify(registry, null, 2)}\n`)

mkdirSync(avatarsDest, { recursive: true })

const copied = []
const generated = []

function placeholderSvg(id, accent) {
  const fill = /^#[0-9a-fA-F]{3,8}$/.test(accent || '') ? accent : '#64748b'
  const letter = (id || '?').slice(0, 1).toUpperCase()
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <rect width="120" height="120" rx="28" fill="${fill}"/>
  <text x="60" y="76" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="52" font-weight="700" fill="#ffffff">${letter}</text>
</svg>
`
}

for (const agent of agents) {
  const id = String(agent.id || '').toLowerCase()
  if (!id) continue

  const destSvg = join(avatarsDest, `${id}.svg`)
  const destJpg = join(avatarsDest, `${id}.jpg`)
  const srcSvg = join(avatarsSrc, `${id}.svg`)
  const srcJpg = join(avatarsSrc, `${id}.jpg`)

  if (existsSync(srcSvg)) {
    copyFileSync(srcSvg, destSvg)
    copied.push(`${id}.svg`)
  }
  if (existsSync(srcJpg)) {
    copyFileSync(srcJpg, destJpg)
    copied.push(`${id}.jpg`)
  }

  if (!existsSync(destSvg)) {
    writeFileSync(destSvg, placeholderSvg(id, agent.accent))
    generated.push(`${id}.svg`)
  }
}

const ids = agents.map((a) => a.id).join(', ')
console.log(`Synced ${agents.length} agents from ${registrySrc}`)
console.log(`  version ${registry.version ?? '?'}  lastUpdated ${registry.lastUpdated ?? '?'}`)
console.log(`  ids: ${ids}`)
console.log(`  copied ${copied.length} avatars, generated ${generated.length} placeholders`)
if (generated.length) console.log(`  placeholders: ${generated.join(', ')}`)
console.log(`  wrote ${registryDest}`)
console.log(`  wrote ${webRegistryDest}`)
