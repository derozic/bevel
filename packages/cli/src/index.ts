#!/usr/bin/env tsx
import {
  formatDoctorReport,
  listTenantSlugs,
  loadDeclarativeTenant,
  resolveTenantsRoot,
  runDoctor,
} from '@bevel/tenant-config'

const [, , command, arg, ...restFlags] = process.argv

async function main() {
  switch (command) {
    case 'doctor':
      await cmdDoctor(arg)
      break
    case 'list':
      cmdList()
      break
    case 'validate':
      cmdValidate(arg)
      break
    case undefined:
    case 'help':
    case '--help':
      printHelp()
      break
    default:
      console.error(`Unknown command: ${command}`)
      printHelp()
      process.exit(1)
  }
}

async function cmdDoctor(slug: string | undefined) {
  if (!slug) {
    console.error('Usage: bevel doctor <tenant>')
    process.exit(1)
  }
  const offline = restFlags.includes('--offline')
  const report = await runDoctor(slug, { skipNetwork: offline })
  console.log(formatDoctorReport(report))
  process.exit(report.passed ? 0 : 1)
}

function cmdList() {
  const slugs = listTenantSlugs()
  if (!slugs.length) {
    console.log('No tenants found in', resolveTenantsRoot())
    return
  }
  console.log('Tenants:')
  for (const slug of slugs) console.log(`  • ${slug}`)
}

function cmdValidate(slug: string | undefined) {
  if (!slug) {
    console.error('Usage: bevel validate <tenant>')
    process.exit(1)
  }
  try {
    const t = loadDeclarativeTenant(slug)
    console.log(`✓ ${slug} — ${t.domain}`)
  } catch (err) {
    console.error(`✗ ${slug}:`, err instanceof Error ? err.message : err)
    process.exit(1)
  }
}

function printHelp() {
  console.log(`BEVEL control plane

Usage:
  bevel doctor <tenant> [--offline]   Validate tenant readiness
  bevel validate <tenant>             Parse and validate bevel.yaml
  bevel list                          List declared tenants
  bevel help                          Show this help

Tenants live in tenants/{slug}/bevel.yaml
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})