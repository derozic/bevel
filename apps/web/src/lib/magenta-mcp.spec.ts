import { describe, expect, it } from 'vitest'
import {
  MAGENTA_MCP_LOCAL,
  MAGENTA_MCP_PROD,
  MAGENTA_MCP_TOOLS,
  magentaInstallSnippets,
  magentaManifestUrl,
  magentaMcpUrl,
} from './magenta-mcp'

describe('magenta MCP catalog', () => {
  it('points at Magenta Streamable HTTP, not a Bevel-hosted server', () => {
    expect(magentaMcpUrl()).toMatch(/\/api\/v2\/mcp$/)
    expect(MAGENTA_MCP_PROD).toBe('https://api.magenta.ac/api/v2/mcp')
    expect(MAGENTA_MCP_LOCAL).toBe('https://api.magenta.lvh.me/api/v2/mcp')
    expect(MAGENTA_MCP_TOOLS).toContain('magenta_traffic')
    expect(MAGENTA_MCP_TOOLS).toContain('magenta_ask')
  })

  it('builds install snippets for Claude / Cursor / Hermes', () => {
    const snippets = magentaInstallSnippets(MAGENTA_MCP_PROD)
    expect(snippets.claude).toContain('claude mcp add magenta')
    expect(snippets.claude).toContain(MAGENTA_MCP_PROD)
    expect(snippets.mcpJson.mcpServers.magenta.url).toBe(MAGENTA_MCP_PROD)
    expect(magentaManifestUrl(MAGENTA_MCP_PROD)).toBe(
      'https://api.magenta.ac/.well-known/mcp.json',
    )
  })
})
