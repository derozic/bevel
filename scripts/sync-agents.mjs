#!/usr/bin/env node
/**
 * Sync the canonical fleet from ~/dev/agents into this repo.
 *
 * Source of truth: $AGENTS_ROOT/registry.json plus each agent's SOUL.md, SKILL.md, skills/
 * Writes:
 *   registry.json                         (realtime + API)
 *   apps/web/src/lib/fleet-registry.json  (web catalog import)
 *   apps/web/content/agents/<id>/*        (SOUL.md, SKILL.md, nested skills)
 *   apps/web/public/avatars/*             (only if dest is missing / letter placeholder)
 *
 * Usage:
 *   pnpm sync:agents
 *   AGENTS_ROOT=/path/to/agents node scripts/sync-agents.mjs
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(scriptDir, '..')
const agentsRoot = process.env.AGENTS_ROOT ?? join(repoRoot, '../agents')
const registrySrc = join(agentsRoot, 'registry.json')
const avatarsSrc = join(agentsRoot, 'public/avatars')
const avatarsDest = join(repoRoot, 'apps/web/public/avatars')
const contentDest = join(repoRoot, 'apps/web/content/agents')
const registryDest = join(repoRoot, 'registry.json')
const webRegistryDest = join(repoRoot, 'apps/web/src/lib/fleet-registry.json')
const agentsSrcRoot = join(agentsRoot, 'src/agents')

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
mkdirSync(contentDest, { recursive: true })

const copied = []
const generated = []
const docsCopied = []

function placeholderSvg(id, accent) {
  const fill = /^#[0-9a-fA-F]{3,8}$/.test(accent || '') ? accent : '#64748b'
  const letter = (id || '?').slice(0, 1).toUpperCase()
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <rect width="120" height="120" rx="28" fill="${fill}"/>
  <text x="60" y="76" text-anchor="middle" font-family="ui-sans-serif, system-ui, sans-serif" font-size="52" font-weight="700" fill="#ffffff">${letter}</text>
</svg>
`
}

function isLetterPlaceholder(svg) {
  return /<text[\s>]/.test(svg)
}

function copyMarkdownTree(fromDir, toDir, prefix = '') {
  if (!existsSync(fromDir)) return
  let entries
  try {
    entries = readdirSync(fromDir, { withFileTypes: true })
  } catch {
    return
  }
  mkdirSync(toDir, { recursive: true })
  for (const entry of entries) {
    const src = join(fromDir, entry.name)
    const dest = join(toDir, entry.name)
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      copyMarkdownTree(src, dest, rel)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      copyFileSync(src, dest)
      docsCopied.push(rel)
    }
  }
}

for (const agent of agents) {
  const id = String(agent.id || '').toLowerCase()
  if (!id) continue

  const destSvg = join(avatarsDest, `${id}.svg`)
  const destJpg = join(avatarsDest, `${id}.jpg`)
  const srcSvg = join(avatarsSrc, `${id}.svg`)
  const srcJpg = join(avatarsSrc, `${id}.jpg`)

  const destSvgText = existsSync(destSvg) ? readFileSync(destSvg, 'utf8') : ''
  const destHasDaypartGlyph = destSvgText.includes('--agent-plate')
  if (existsSync(srcSvg) && !destHasDaypartGlyph) {
    const src = readFileSync(srcSvg, 'utf8')
    if (!isLetterPlaceholder(src) || !destSvgText) {
      copyFileSync(srcSvg, destSvg)
      copied.push(`${id}.svg`)
    }
  }
  if (existsSync(srcJpg)) {
    copyFileSync(srcJpg, destJpg)
    copied.push(`${id}.jpg`)
  }

  if (!existsSync(destSvg)) {
    writeFileSync(destSvg, placeholderSvg(id, agent.accent))
    generated.push(`${id}.svg`)
  }

  const srcAgentDir = join(agentsSrcRoot, id)
  const destAgentDir = join(contentDest, id)
  if (existsSync(srcAgentDir)) {
    for (const name of ['SOUL.md', 'SKILL.md', 'DIRECTIVES.md', 'INTEROP.md', 'SETUP.md']) {
      const src = join(srcAgentDir, name)
      if (!existsSync(src)) continue
      mkdirSync(destAgentDir, { recursive: true })
      copyFileSync(src, join(destAgentDir, name))
      docsCopied.push(`${id}/${name}`)
    }
    copyMarkdownTree(join(srcAgentDir, 'skills'), join(destAgentDir, 'skills'), `${id}/skills`)
    copyMarkdownTree(
      join(srcAgentDir, 'hermes-skills'),
      join(destAgentDir, 'hermes-skills'),
      `${id}/hermes-skills`,
    )
  }
}

const ids = agents.map((a) => a.id).join(', ')
console.log(`Synced ${agents.length} agents from ${registrySrc}`)
console.log(`  version ${registry.version ?? '?'}  lastUpdated ${registry.lastUpdated ?? '?'}`)
console.log(`  ids: ${ids}`)
console.log(`  copied ${copied.length} avatars, generated ${generated.length} placeholders`)
if (generated.length) console.log(`  placeholders: ${generated.join(', ')}`)
console.log(`  copied ${docsCopied.length} agent docs → ${contentDest}`)
console.log(`  wrote ${registryDest}`)
console.log(`  wrote ${webRegistryDest}`)
