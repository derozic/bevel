/**
 * Explicit person → workspace memberships (tenants/memberships.yaml).
 *
 * Clean model:
 *   Person (email) always has Private on apex.
 *   Memberships list product workspaces only.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { resolveTenantsRoot } from './loader'

export type MembershipRole = 'member' | 'admin' | 'owner'

export type WorkspaceMembership = {
  workspace: string
  role: MembershipRole
}

type MembershipsFile = {
  version?: number
  people?: Record<
    string,
    Array<{ workspace: string; role?: string } | string>
  >
}

let cache: Map<string, WorkspaceMembership[]> | null = null
let cacheRoot: string | null = null

function membershipsPath(root = resolveTenantsRoot()): string {
  return join(root, 'memberships.yaml')
}

function loadMap(root = resolveTenantsRoot()): Map<string, WorkspaceMembership[]> {
  if (cache && cacheRoot === root && process.env.NODE_ENV === 'production') {
    return cache
  }
  if (process.env.NODE_ENV !== 'production') {
    cache = null
  }

  const map = new Map<string, WorkspaceMembership[]>()
  const path = membershipsPath(root)
  if (!existsSync(path)) {
    cache = map
    cacheRoot = root
    return map
  }

  try {
    const raw = parseYaml(readFileSync(path, 'utf8')) as MembershipsFile
    const people = raw.people ?? {}
    for (const [email, rows] of Object.entries(people)) {
      const key = email.toLowerCase().trim()
      if (!key || !Array.isArray(rows)) continue
      const list: WorkspaceMembership[] = []
      for (const row of rows) {
        if (typeof row === 'string') {
          list.push({ workspace: row.trim().toLowerCase(), role: 'member' })
          continue
        }
        const slug = (row.workspace || '').trim().toLowerCase()
        if (!slug) continue
        const roleRaw = (row.role || 'member').toLowerCase()
        const role: MembershipRole =
          roleRaw === 'admin' || roleRaw === 'owner' ? roleRaw : 'member'
        list.push({ workspace: slug, role })
      }
      if (list.length) map.set(key, list)
    }
  } catch (err) {
    console.warn('[tenant-config] memberships.yaml parse failed:', err)
  }

  cache = map
  cacheRoot = root
  return map
}

export function refreshMemberships(): void {
  cache = null
  cacheRoot = null
}

export function listMembershipsForEmail(
  email: string,
): WorkspaceMembership[] {
  const key = email.toLowerCase().trim()
  return [...(loadMap().get(key) ?? [])]
}

/** Workspace slugs from the roster for this email (ordered). */
export function membershipSlugsForEmail(email: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of listMembershipsForEmail(email)) {
    if (seen.has(m.workspace)) continue
    seen.add(m.workspace)
    out.push(m.workspace)
  }
  return out
}

/** True if any person is rostered on this workspace slug. */
export function workspaceHasRoster(workspaceSlug: string): boolean {
  const slug = workspaceSlug.toLowerCase().trim()
  for (const rows of loadMap().values()) {
    if (rows.some((r) => r.workspace === slug)) return true
  }
  return false
}

export function emailIsMemberOfWorkspace(
  email: string,
  workspaceSlug: string,
): boolean {
  const slug = workspaceSlug.toLowerCase().trim()
  return listMembershipsForEmail(email).some((m) => m.workspace === slug)
}
