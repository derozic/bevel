/**
 * Load SOUL.md, SKILL.md, and nested skills for an agent.
 * Primary store: apps/web/content/agents/<id> (synced from ~/dev/agents).
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

export const AGENT_ID_RE = /^[a-z][a-z0-9-]*$/

const ROOT_DOCS = new Set([
  'SOUL.md',
  'SKILL.md',
  'DIRECTIVES.md',
  'INTEROP.md',
  'SETUP.md',
])

export type AgentDoc = {
  path: string
  title: string
  kind: 'soul' | 'skill' | 'nested' | 'doc'
  content: string
}

export type AgentDossier = {
  agentId: string
  soul: AgentDoc | null
  skill: AgentDoc | null
  files: AgentDoc[]
}

function webContentRoot(): string {
  const cwd = process.cwd()
  if (existsSync(join(cwd, 'next.config.ts'))) {
    return resolve(cwd, 'content/agents')
  }
  return resolve(cwd, 'apps/web/content/agents')
}

function agentsRepoRoot(): string | null {
  const fromEnv = process.env.AGENTS_ROOT || process.env.AGENTS_REPO_ROOT
  if (fromEnv) return resolve(fromEnv)
  const cwd = process.cwd()
  const candidates = [
    resolve(cwd, '../agents'),
    resolve(cwd, '../../agents'),
    resolve(cwd, '../../../agents'),
  ]
  for (const dir of candidates) {
    if (existsSync(join(dir, 'src/agents'))) return dir
  }
  return null
}

export function agentContentDir(agentId: string): string {
  return join(webContentRoot(), agentId.toLowerCase())
}

export function agentSourceDir(agentId: string): string | null {
  const root = agentsRepoRoot()
  if (!root) return null
  const dir = join(root, 'src/agents', agentId.toLowerCase())
  return existsSync(dir) ? dir : null
}

function titleFromMarkdown(content: string, fallback: string): string {
  const match = content.match(/^#\s+(.+)$/m)
  return match?.[1]?.trim() || fallback
}

function kindFor(relPath: string): AgentDoc['kind'] {
  if (relPath === 'SOUL.md') return 'soul'
  if (relPath === 'SKILL.md') return 'skill'
  if (relPath.startsWith('skills/') || relPath.includes('/SKILL.md')) {
    return 'nested'
  }
  return 'doc'
}

function readDoc(absPath: string, relPath: string): AgentDoc | null {
  try {
    const content = readFileSync(absPath, 'utf8')
    return {
      path: relPath,
      title: titleFromMarkdown(content, relPath),
      kind: kindFor(relPath),
      content,
    }
  } catch {
    return null
  }
}

function walkMarkdown(dir: string, prefix = ''): AgentDoc[] {
  const out: AgentDoc[] = []
  let entries: { name: string; isDirectory(): boolean; isFile(): boolean }[]
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walkMarkdown(full, rel))
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      const doc = readDoc(full, rel.replace(/\\/g, '/'))
      if (doc) out.push(doc)
    }
  }
  return out
}

function collectFromDir(dir: string): AgentDoc[] {
  const files: AgentDoc[] = []
  for (const name of ROOT_DOCS) {
    const doc = readDoc(join(dir, name), name)
    if (doc) files.push(doc)
  }
  files.push(...walkMarkdown(join(dir, 'skills'), 'skills'))
  files.push(...walkMarkdown(join(dir, 'hermes-skills'), 'hermes-skills'))
  const seen = new Set<string>()
  return files.filter((f) => {
    if (seen.has(f.path)) return false
    seen.add(f.path)
    return true
  })
}

export function loadAgentDossier(agentId: string): AgentDossier {
  const id = agentId.toLowerCase()
  if (!AGENT_ID_RE.test(id)) {
    return { agentId: id, soul: null, skill: null, files: [] }
  }

  const contentDir = agentContentDir(id)
  const sourceDir = agentSourceDir(id)
  const fromContent = existsSync(contentDir) ? collectFromDir(contentDir) : []
  const fromSource =
    fromContent.length === 0 && sourceDir ? collectFromDir(sourceDir) : []
  const files = (fromContent.length ? fromContent : fromSource).sort((a, b) => {
    const rank = (p: string) =>
      p === 'SOUL.md' ? 0 : p === 'SKILL.md' ? 1 : 2
    const d = rank(a.path) - rank(b.path)
    return d !== 0 ? d : a.path.localeCompare(b.path)
  })

  return {
    agentId: id,
    soul: files.find((f) => f.path === 'SOUL.md') ?? null,
    skill: files.find((f) => f.path === 'SKILL.md') ?? null,
    files,
  }
}

export function sanitizeAgentDocPath(raw: string): string | null {
  const path = raw.trim().replace(/^\/+/, '').replace(/\\/g, '/')
  if (!path || path.includes('..') || path.startsWith('/')) return null
  if (ROOT_DOCS.has(path)) return path
  if (!path.endsWith('.md')) return null
  if (
    path.startsWith('skills/') ||
    path.startsWith('hermes-skills/') ||
    path.startsWith('global/skills/')
  ) {
    if (!/^[a-z0-9][a-z0-9/_-]*\.md$/i.test(path)) return null
    return path
  }
  return null
}

export function readAgentDoc(
  agentId: string,
  relPath: string,
): AgentDoc | null {
  const id = agentId.toLowerCase()
  const safe = sanitizeAgentDocPath(relPath)
  if (!AGENT_ID_RE.test(id) || !safe) return null
  const contentFile = join(agentContentDir(id), safe)
  if (existsSync(contentFile)) return readDoc(contentFile, safe)
  const source = agentSourceDir(id)
  if (source) {
    const srcFile = join(source, safe)
    if (existsSync(srcFile)) return readDoc(srcFile, safe)
  }
  return null
}

export function writeAgentDoc(
  agentId: string,
  relPath: string,
  content: string,
): { path: string; wrote: string[] } {
  const id = agentId.toLowerCase()
  const safe = sanitizeAgentDocPath(relPath)
  if (!AGENT_ID_RE.test(id) || !safe) {
    throw new Error('Invalid agent document path')
  }
  if (content.length > 400_000) {
    throw new Error('Document too large')
  }

  const wrote: string[] = []
  const dests = [join(agentContentDir(id), safe)]
  const source = agentSourceDir(id)
  if (source) dests.push(join(source, safe))

  for (const dest of dests) {
    const root = dests[0] === dest ? agentContentDir(id) : source!
    const resolved = resolve(dest)
    const rootResolved = resolve(root)
    const rel = relative(rootResolved, resolved)
    if (rel.startsWith('..') || rel.includes(`..${sep}`)) {
      throw new Error('Path escapes agent directory')
    }
    mkdirSync(dirname(resolved), { recursive: true })
    writeFileSync(resolved, content, 'utf8')
    wrote.push(resolved)
  }

  return { path: safe, wrote }
}
