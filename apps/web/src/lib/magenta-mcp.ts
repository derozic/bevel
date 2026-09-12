/**
 * Magenta Streamable HTTP MCP — catalogued by BEVEL Extensions.
 * Server lives in ~/dev/magenta-mono; Bevel is a client.
 * @see docs/MAGENTA_MCP.md
 */

export const MAGENTA_MCP_PROD = 'https://api.magenta.ac/api/v2/mcp'
export const MAGENTA_MCP_LOCAL = 'https://api.magenta.lvh.me/api/v2/mcp'
export const MAGENTA_MCP_MANIFEST_PROD =
  'https://api.magenta.ac/.well-known/mcp.json'
export const MAGENTA_SITE_ID = 'bevel'

export const MAGENTA_MCP_TOOLS = [
  'magenta_traffic',
  'magenta_reliability',
  'magenta_sites',
  'magenta_health',
  'magenta_ask',
] as const

export function magentaMcpUrl(): string {
  const fromEnv = (
    process.env.MAGENTA_MCP_URL ||
    process.env.NEXT_PUBLIC_MAGENTA_MCP_URL ||
    ''
  ).trim()
  if (fromEnv) return fromEnv.replace(/\/$/, '')
  if (process.env.NODE_ENV !== 'production') return MAGENTA_MCP_LOCAL
  return MAGENTA_MCP_PROD
}

export function magentaManifestUrl(mcpUrl = magentaMcpUrl()): string {
  try {
    const u = new URL(mcpUrl)
    return `${u.origin}/.well-known/mcp.json`
  } catch {
    return MAGENTA_MCP_MANIFEST_PROD
  }
}

export function magentaInstallSnippets(mcpUrl = magentaMcpUrl()): {
  claude: string
  mcpJson: { mcpServers: { magenta: { url: string; transport: 'http' } } }
} {
  const url = mcpUrl.replace(/\/$/, '')
  return {
    claude: `claude mcp add magenta --transport http ${url}`,
    mcpJson: {
      mcpServers: {
        magenta: { url, transport: 'http' },
      },
    },
  }
}

export type MagentaDiscovery = {
  status?: string
  name?: string
  url?: string
  tools?: string[]
  protocolVersion?: string
  transport?: string
  install?: { claude?: string }
}

export async function fetchMagentaDiscovery(
  mcpUrl = magentaMcpUrl(),
  timeoutMs = 4000,
): Promise<{ live: boolean; discovery: MagentaDiscovery | null; error?: string }> {
  const url = mcpUrl.replace(/\/$/, '')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(`${url}/`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: ctrl.signal,
    })
    if (!res.ok) {
      return { live: false, discovery: null, error: `HTTP ${res.status}` }
    }
    const discovery = (await res.json()) as MagentaDiscovery
    return { live: true, discovery }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'timeout'
          : err.message
        : 'unreachable'
    return { live: false, discovery: null, error: message }
  } finally {
    clearTimeout(timer)
  }
}
