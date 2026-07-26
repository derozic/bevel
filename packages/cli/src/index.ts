#!/usr/bin/env tsx
import {
  formatDoctorReport,
  listTenantSlugs,
  loadDeclarativeTenant,
  resolveTenantsRoot,
  runDoctor,
} from '@bevel/tenant-config'

const [, , command, arg, sub, ...restFlags] = process.argv

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
    case 'integrations':
      await cmdIntegrations(arg, sub)
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

async function cmdIntegrations(provider: string | undefined, action: string | undefined) {
  if (provider !== 'slack') {
    console.error('Usage: bevel integrations slack <status|connect|disconnect|test>')
    process.exit(1)
  }
  const base =
    process.env.BEVEL_PUBLIC_URL?.replace(/\/$/, '') ||
    process.env.AUTH_URL?.replace(/\/$/, '') ||
    'https://bevel.lvh.me'
  const cookie = process.env.BEVEL_SESSION_COOKIE || ''

  switch (action || 'status') {
    case 'status': {
      const res = await fetch(`${base}/api/integrations/slack/status`, {
        headers: cookie ? { Cookie: cookie } : {},
      })
      const json = await res.json()
      console.log(JSON.stringify(json, null, 2))
      if (!res.ok) process.exit(1)
      break
    }
    case 'connect': {
      console.log('Open this URL while signed in to BEVEL (browser session):')
      console.log(`  ${base}/api/integrations/slack/oauth/start`)
      console.log('')
      console.log('Or: Console → Integrations → Slack → Connect with Slack')
      console.log('Slack app lifecycle (optional): https://docs.slack.dev/tools/slack-cli')
      console.log('  brew install slackapi/tap/slack-cli && slack login')
      break
    }
    case 'disconnect': {
      const res = await fetch(`${base}/api/integrations/slack/disconnect`, {
        method: 'POST',
        headers: cookie ? { Cookie: cookie } : {},
      })
      console.log(await res.text())
      if (!res.ok) process.exit(1)
      break
    }
    case 'test': {
      const channel = restFlags[0] || ''
      const res = await fetch(`${base}/api/integrations/slack/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: JSON.stringify(channel ? { channel } : {}),
      })
      console.log(JSON.stringify(await res.json(), null, 2))
      if (!res.ok) process.exit(1)
      break
    }
    case 'mcp-config':
    case 'mcp': {
      // Prefer live API; fall back to static template (local Caddy TLS can fail)
      try {
        const res = await fetch(`${base}/api/integrations/slack/mcp`, {
          headers: cookie ? { Cookie: cookie } : {},
        })
        if (res.ok) {
          const json = (await res.json()) as {
            clientConfig?: unknown
            endpoint?: string
            oauth?: unknown
            scopes?: unknown
            requirements?: unknown
            docs?: unknown
          }
          if (json.clientConfig) {
            console.log(JSON.stringify(json.clientConfig, null, 2))
            console.error('')
            console.error('# Full metadata on stderr:')
            console.error(
              JSON.stringify(
                {
                  endpoint: json.endpoint,
                  oauth: json.oauth,
                  scopes: json.scopes,
                  requirements: json.requirements,
                  docs: json.docs,
                },
                null,
                2,
              ),
            )
            break
          }
        }
      } catch {
        /* offline template */
      }
      const apiUrl =
        process.env.BEVEL_API_URL ||
        process.env.NEXT_PUBLIC_BEVEL_API_URL ||
        'https://api.bevel.is'
      const home = process.env.HOME || ''
      console.log(
        JSON.stringify(
          {
            mcpServers: {
              bevel: {
                command: 'uv',
                args: ['run', 'bevel-mcp'],
                cwd: `${home}/dev/bevel/services/api`,
                env: { BEVEL_API_URL: apiUrl.replace(/\/$/, '') },
              },
              slack: {
                url: 'https://mcp.slack.com/mcp',
                transport: 'http',
              },
            },
          },
          null,
          2,
        ),
      )
      console.error(
        '# Offline template. Docs: docs/SLACK_MCP.md · redirect: https://bevel.is/api/integrations/slack/oauth/callback',
      )
      break
    }
    default:
      console.error(
        'Unknown action. Use status|connect|disconnect|test|mcp-config',
      )
      process.exit(1)
  }
}

function printHelp() {
  console.log(`BEVEL control plane

Usage:
  bevel doctor <tenant> [--offline]   Validate tenant readiness
  bevel validate <tenant>             Parse and validate bevel.yaml
  bevel list                          List declared tenants
  bevel integrations slack status     Slack bridge status
  bevel integrations slack connect    Print OAuth / Slack CLI steps
  bevel integrations slack test [C…]  auth.test (+ optional post)
  bevel integrations slack mcp-config Print BEVEL + Slack MCP client JSON
  bevel integrations slack disconnect
  bevel help                          Show this help

Slack strategy: docs/SLACK_INTEGRATION.md
Slack MCP:      docs/SLACK_MCP.md  (https://mcp.slack.com/mcp)
Slack CLI:      https://docs.slack.dev/tools/slack-cli
Tenants live in tenants/{slug}/bevel.yaml
`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})