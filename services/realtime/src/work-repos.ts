import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { RealtimeAuth } from './auth-verify.js'
import { config } from './config.js'

export function parseConfiguredWorkRepos(): string[] {
  const raw =
    process.env.BEVEL_WORK_REPOS ?? process.env.BEVEL_WORK_REPO ?? config.workRepo
  const names = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  return names.length > 0 ? names : [config.workRepo]
}

function parseRepoRoots(): Record<string, string> {
  const roots: Record<string, string> = {}
  const raw = process.env.BEVEL_WORK_REPO_ROOTS ?? ''
  for (const entry of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
    const eq = entry.indexOf('=')
    if (eq <= 0) continue
    roots[entry.slice(0, eq).trim().toLowerCase()] = entry.slice(eq + 1).trim()
  }
  return roots
}

export function resolveWorkspaceForRepo(workRepo: string): string {
  const normalized = workRepo.trim().toLowerCase()
  const roots = parseRepoRoots()
  if (roots[normalized]) return roots[normalized]
  if (normalized === config.workRepo.toLowerCase()) return config.workspaceRoot

  const repoName = normalized.split('/')[1]
  if (repoName) {
    const guess = join(homedir(), 'dev', repoName)
    if (existsSync(guess)) return guess
  }

  return config.workspaceRoot
}

export function canDispatchWork(
  auth: RealtimeAuth | undefined,
  workRepo: string
): boolean {
  if (!auth) return false
  const normalized = workRepo.trim().toLowerCase()
  const configured = parseConfiguredWorkRepos().map((r) => r.toLowerCase())
  if (!configured.includes(normalized)) return false
  if (auth.role === 'admin') return true
  if (!auth.repoWrite) return false
  return (auth.workRepos ?? []).some((r) => r.toLowerCase() === normalized)
}

export function normalizeWorkRepo(explicit?: string): string {
  const candidate = explicit?.trim() || config.workRepo
  const configured = parseConfiguredWorkRepos()
  const match = configured.find((r) => r.toLowerCase() === candidate.toLowerCase())
  return match ?? config.workRepo
}