/**
 * CMYK BrandKit + Figma design systems — catalogued by BEVEL Extensions.
 * Tokens and kitchen sink live in cmyk-mono; Figma files are the DS surface.
 */

export const CMYK_BRANDKIT_MCP_TOOLS = [
  'list_brand_kits',
  'get_brand_kit_theme',
  'get_design_tokens',
  'get_code_snippet',
] as const

export type BrandKitCatalogEntry = {
  slug: string
  name: string
  host: string
  kitId: number
  kitchenSink: string
  tokensUrl: string
  figmaUrl: string
  organismsUrl: string
}

export const BRANDKIT_CATALOG: BrandKitCatalogEntry[] = [
  {
    slug: '2x4m',
    name: '2x4m BrandKit',
    host: 'https://cmyk.2x4m.lvh.me',
    kitId: 1,
    kitchenSink: 'https://cmyk.2x4m.lvh.me/brandkits/1/kitchen-sink/',
    tokensUrl:
      'https://cmyk.2x4m.lvh.me/brandkits/1/assets/figma.tokens.json?download=1',
    figmaUrl: 'https://www.figma.com/design/X6cNuE9nDHuac4md2GT1n0/2x4m-BrandKit',
    organismsUrl:
      'https://www.figma.com/design/X6cNuE9nDHuac4md2GT1n0/2x4m-BrandKit?node-id=4-29',
  },
  {
    slug: 'comma',
    name: 'Comma BrandKit',
    host: 'https://cmyk.comma.lvh.me',
    kitId: 1,
    kitchenSink: 'https://cmyk.comma.lvh.me/brandkits/1/kitchen-sink/',
    tokensUrl:
      'https://cmyk.comma.lvh.me/brandkits/1/assets/figma.tokens.json?download=1',
    figmaUrl: 'https://www.figma.com/design/FC6kCHe3VyDq7xCHxbFY3T/Comma-BrandKit',
    organismsUrl:
      'https://www.figma.com/design/FC6kCHe3VyDq7xCHxbFY3T/Comma-BrandKit?node-id=2-79',
  },
]

export function brandkitMcpInstall(): {
  claude: string
  mcpJson: {
    mcpServers: {
      'cmyk-brandkit': { command: string; args: string[]; env: Record<string, string> }
    }
  }
} {
  const api = BRANDKIT_CATALOG[0]?.host ?? 'https://cmyk.2x4m.lvh.me'
  return {
    claude:
      `CMYK_BRANDKIT_API=${api} pnpm --filter @cmyk/mcp start`,
    mcpJson: {
      mcpServers: {
        'cmyk-brandkit': {
          command: 'pnpm',
          args: ['--filter', '@cmyk/mcp', 'start'],
          env: { CMYK_BRANDKIT_API: api },
        },
      },
    },
  }
}

export type BrandKitProbe = BrandKitCatalogEntry & {
  live: boolean
  figmaReady: boolean
  error?: string
}

async function fetchFigmaJson(
  url: string,
  timeoutMs: number,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  if (process.env.NODE_ENV === 'production') {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: ctrl.signal,
      })
      const body = await res.json().catch(() => null)
      return { ok: res.ok, status: res.status, body }
    } finally {
      clearTimeout(timer)
    }
  }

  const https = await import('node:https')
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { rejectUnauthorized: false, headers: { Accept: 'application/json' } },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c as Buffer))
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8')
          let parsed: unknown = text
          try {
            parsed = JSON.parse(text)
          } catch {
            /* keep string */
          }
          const status = res.statusCode || 0
          resolve({ ok: status >= 200 && status < 300, status, body: parsed })
        })
      },
    )
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'))
    })
    req.on('error', reject)
  })
}

export async function probeBrandKit(
  entry: BrandKitCatalogEntry,
  timeoutMs = 4000,
): Promise<BrandKitProbe> {
  const figmaApi = `${entry.host}/brandkits/api/brand-kits/${entry.kitId}/figma/`
  try {
    const res = await fetchFigmaJson(figmaApi, timeoutMs)
    if (!res.ok) {
      return { ...entry, live: false, figmaReady: false, error: `HTTP ${res.status}` }
    }
    const body = res.body as {
      figma?: { ready?: boolean; url?: string; jumps?: { id: string; url?: string }[] }
    }
    const organisms = body?.figma?.jumps?.find((j) => j.id === 'organisms')
    return {
      ...entry,
      live: true,
      figmaReady: Boolean(body?.figma?.ready && body?.figma?.url),
      figmaUrl: body?.figma?.url || entry.figmaUrl,
      organismsUrl: organisms?.url || entry.organismsUrl,
    }
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'timeout'
          : err.message
        : 'unreachable'
    return { ...entry, live: false, figmaReady: false, error: message }
  }
}

export async function probeBrandKitCatalog(
  timeoutMs = 4000,
): Promise<{ live: boolean; kits: BrandKitProbe[] }> {
  const kits = await Promise.all(
    BRANDKIT_CATALOG.map((entry) => probeBrandKit(entry, timeoutMs)),
  )
  return { live: kits.some((k) => k.live), kits }
}
