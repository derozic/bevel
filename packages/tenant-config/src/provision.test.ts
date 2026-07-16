/**
 * Run: pnpm exec tsx packages/tenant-config/src/provision.test.ts
 */
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import assert from 'node:assert/strict'
import {
  claimHostForSlug,
  claimHostPreview,
  isSoftClaimMode,
  isValidTenantSlug,
  provisionTenant,
  RESERVED_TENANT_SLUGS,
  tenantsRootWritableStatus,
} from './provision'

function section(name: string, fn: () => void) {
  try {
    fn()
    console.log(`ok  - ${name}`)
  } catch (err) {
    console.error(`fail - ${name}`)
    throw err
  }
}

const root = mkdtempSync(join(tmpdir(), 'bevel-tenants-'))
const prevRoot = process.env.BEVEL_TENANTS_ROOT
const prevMode = process.env.BEVEL_CLAIM_MODE
const prevNodeEnv = process.env.NODE_ENV
const prevPublic = process.env.BEVEL_PUBLIC_URL

process.env.BEVEL_TENANTS_ROOT = root
process.env.BEVEL_CLAIM_MODE = 'dns'
process.env.NODE_ENV = 'test'
delete process.env.BEVEL_PUBLIC_URL

try {
  section('validates slug shape', () => {
    assert.equal(isValidTenantSlug('acme'), true)
    assert.equal(isValidTenantSlug('a'), false)
    assert.equal(isValidTenantSlug('-bad'), false)
    assert.equal(RESERVED_TENANT_SLUGS.has('admin'), true)
  })

  section('provisions a tenant on a writable root', () => {
    const result = provisionTenant({
      name: 'Acme Robotics',
      slug: 'acme-robotics',
      emailDomain: 'acme.com',
      ownerEmail: 'owner@acme.com',
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.tenant.slug, 'acme-robotics')
    assert.equal(result.host, 'acme-robotics.bevel.lvh.me')
    assert.equal(existsSync(join(root, 'acme-robotics', 'bevel.yaml')), true)
    assert.equal(existsSync(join(root, 'acme-robotics', 'theme.json')), true)
  })

  section('rejects reserved and taken slugs', () => {
    const reserved = provisionTenant({
      name: 'Admin Co',
      slug: 'admin',
      emailDomain: 'admin.com',
      ownerEmail: 'a@admin.com',
    })
    assert.equal(reserved.ok, false)
    if (!reserved.ok) assert.equal(reserved.code, 'reserved')

    const first = provisionTenant({
      name: 'Once',
      slug: 'once-only',
      emailDomain: 'once.com',
      ownerEmail: 'o@once.com',
    })
    assert.equal(first.ok, true)

    const second = provisionTenant({
      name: 'Twice',
      slug: 'once-only',
      emailDomain: 'twice.com',
      ownerEmail: 't@twice.com',
    })
    assert.equal(second.ok, false)
    if (!second.ok) assert.equal(second.code, 'taken')
  })

  section('uses soft host when provided', () => {
    process.env.BEVEL_CLAIM_MODE = 'soft'
    const result = provisionTenant({
      name: 'Soft Org',
      slug: 'soft-org',
      emailDomain: 'soft.com',
      ownerEmail: 's@soft.com',
      softHost: 'bevel.2x4m.cc',
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.host, 'bevel.2x4m.cc')
    assert.equal(result.tenant.realtime.namespace, 'soft-org')
  })

  section('reports writable status', () => {
    const status = tenantsRootWritableStatus(root)
    assert.equal(status.writable, true)
    assert.equal(status.tenantsRoot, root)
  })

  section('builds host preview for soft mode', () => {
    process.env.BEVEL_CLAIM_MODE = 'soft'
    process.env.BEVEL_PUBLIC_URL = 'https://bevel.2x4m.cc'
    assert.equal(isSoftClaimMode(), true)
    assert.equal(claimHostForSlug('x'), 'bevel.2x4m.cc')
    assert.match(claimHostPreview('x'), /bevel\.2x4m\.cc/)
  })

  console.log('\nAll provision tests passed.')
} finally {
  if (prevRoot === undefined) delete process.env.BEVEL_TENANTS_ROOT
  else process.env.BEVEL_TENANTS_ROOT = prevRoot
  if (prevMode === undefined) delete process.env.BEVEL_CLAIM_MODE
  else process.env.BEVEL_CLAIM_MODE = prevMode
  if (prevNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = prevNodeEnv
  if (prevPublic === undefined) delete process.env.BEVEL_PUBLIC_URL
  else process.env.BEVEL_PUBLIC_URL = prevPublic
  rmSync(root, { recursive: true, force: true })
}
