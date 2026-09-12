import { describe, expect, it } from 'vitest'
import {
  BRANDKIT_CATALOG,
  CMYK_BRANDKIT_MCP_TOOLS,
  brandkitMcpInstall,
} from './cmyk-brandkit-catalog'

describe('CMYK BrandKit catalog', () => {
  it('lists 2x4m and Comma with Figma organism jumps', () => {
    const slugs = BRANDKIT_CATALOG.map((k) => k.slug)
    expect(slugs).toEqual(['2x4m', 'comma'])
    for (const kit of BRANDKIT_CATALOG) {
      expect(kit.figmaUrl).toContain('figma.com/design/')
      expect(kit.organismsUrl).toContain('node-id=')
      expect(kit.tokensUrl).toContain('figma.tokens.json')
      expect(kit.kitchenSink).toContain('/kitchen-sink/')
    }
  })

  it('installs stdio MCP against the BrandKit API host', () => {
    const snippets = brandkitMcpInstall()
    expect(snippets.claude).toContain('@cmyk/mcp')
    expect(snippets.mcpJson.mcpServers['cmyk-brandkit'].env.CMYK_BRANDKIT_API).toMatch(
      /^https:\/\//,
    )
    expect(CMYK_BRANDKIT_MCP_TOOLS).toContain('get_brand_kit_theme')
    expect(CMYK_BRANDKIT_MCP_TOOLS).toContain('get_code_snippet')
  })
})
