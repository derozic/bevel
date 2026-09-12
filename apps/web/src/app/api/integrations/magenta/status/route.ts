import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import {
  MAGENTA_MCP_LOCAL,
  MAGENTA_MCP_PROD,
  MAGENTA_MCP_TOOLS,
  MAGENTA_SITE_ID,
  fetchMagentaDiscovery,
  magentaInstallSnippets,
  magentaManifestUrl,
  magentaMcpUrl,
} from '@/lib/magenta-mcp'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = magentaMcpUrl()
  const probed = await fetchMagentaDiscovery(url)
  const snippets = magentaInstallSnippets(url)
  const tools =
    probed.discovery?.tools?.length
      ? probed.discovery.tools
      : [...MAGENTA_MCP_TOOLS]

  return NextResponse.json({
    id: 'magenta',
    name: 'Magenta',
    category: 'Analytics',
    live: probed.live,
    connected: probed.live,
    error: probed.error ?? null,
    siteId: MAGENTA_SITE_ID,
    mcp: {
      endpoint: url,
      prod: MAGENTA_MCP_PROD,
      local: MAGENTA_MCP_LOCAL,
      manifest: magentaManifestUrl(url),
      transport: probed.discovery?.transport || 'streamable-http',
      protocol: probed.discovery?.protocolVersion || '2025-03-26',
      tools,
    },
    install: snippets,
    docs: 'docs/MAGENTA_MCP.md',
    stance:
      'First-party analytics MCP. Public tools need no auth. magenta_ask needs a Magenta staff session. uptime_check probes are not visitors.',
  })
}
