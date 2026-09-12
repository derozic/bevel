import { NextResponse } from 'next/server'
import {
  CMYK_BRANDKIT_MCP_TOOLS,
  brandkitMcpInstall,
  probeBrandKitCatalog,
} from '@/lib/cmyk-brandkit-catalog'

export const runtime = 'nodejs'

export async function GET() {
  const probed = await probeBrandKitCatalog()
  const install = brandkitMcpInstall()

  return NextResponse.json({
    id: 'cmyk-brandkit',
    name: 'CMYK BrandKit',
    category: 'Design',
    live: probed.live,
    connected: probed.live,
    kits: probed.kits,
    mcp: {
      tools: [...CMYK_BRANDKIT_MCP_TOOLS],
      transport: 'stdio',
      package: '@cmyk/mcp',
    },
    install: {
      claude: install.claude,
      mcpJson: install.mcpJson,
    },
    stance:
      'First-party brand systems. Kitchen sink + Tokens Studio JSON are grab-able. Figma files are the design-system surface; organism frames deep-link from the kit.',
  })
}
