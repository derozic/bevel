/** Short placement line (1–5 words) + hover copy for fleet chat chips. */
export type AgentChipCopy = {
  tagline: string
  summary: string
  capabilities: string[]
}

export const AGENT_CHIP_COPY: Record<string, AgentChipCopy> = {
  johnny: {
    tagline: 'Platform night patrol',
    summary:
      'Walks Caddy, TLS, product health, and Magenta instrumentation — books calendar time only when a human is genuinely needed.',
    capabilities: [
      'Caddy / local HTTPS',
      'Uptime monitoring',
      'Magenta instrumentation',
      'Calendar triage',
    ],
  },
  brain: {
    tagline: 'Docs, decks, data',
    summary:
      'Runs Python tooling for documents, presentations, data viz, and CMYK brand assets with Figma fidelity.',
    capabilities: [
      'python-docx / pptx',
      'Data visualization',
      'CMYK brand system',
      'Figma integration',
    ],
  },
  loom: {
    tagline: 'Continuous optimization',
    summary:
      'Tunes prompts, model routing, tooling, and configuration from evidence — never settles for good enough.',
    capabilities: [
      'Prompt engineering',
      'Model routing',
      'A/B testing',
      'Cost optimization',
    ],
  },
  northstar: {
    tagline: 'Fleet health watchdog',
    summary:
      'Watches the agent constellation for drift, failures, inefficiencies, and regressions before they spread.',
    capabilities: [
      'Log analysis',
      'Drift detection',
      'Health scoring',
      'Failure mining',
    ],
  },
  lego: {
    tagline: 'Tests from diffs',
    summary:
      'Reads PR changes and writes Vitest, pytest, and Playwright coverage that matches repo conventions.',
    capabilities: ['Vitest', 'pytest', 'Playwright', 'Edge-case design'],
  },
  terry: {
    tagline: 'Architectural visualization',
    summary:
      'Rhino3D, Grasshopper, and Blender — parametric design and photoreal renders for built work.',
    capabilities: [
      'Rhino3D / Grasshopper',
      'Blender renders',
      'Parametric design',
      'BIM integration',
    ],
  },
  forge: {
    tagline: 'Shop floor execution',
    summary:
      'CNC programming, material optimization, and production scheduling — design to physical reality.',
    capabilities: [
      'CNC programming',
      'Material optimization',
      'Production planning',
      'Cost estimation',
    ],
  },
  tegan: {
    tagline: 'UI craft review',
    summary:
      'Reviews UI diffs for hierarchy, accessibility, design-system craft, and motion — not LLM usage tokens (see Mildred).',
    capabilities: [
      'Visual hierarchy',
      'WCAG accessibility',
      'Layout & craft',
      'Motion design',
    ],
  },
  mildred: {
    tagline: 'Token & cost books',
    summary:
      'Meters LLM tokens (input/inference/output) across five model lanes plus OpenRouter; QuickBooks-style debit/credit, closes, and 2x4m box calcs. Emits ```bevel-chart``` JSON for inline D3 charts (bar/line/gantt).',
    capabilities: [
      'Token metering',
      'OpenRouter ledger',
      'Inline charts (bevel-chart)',
      'Debit/credit journals',
      '2x4m box calcs',
    ],
  },
  hermes: {
    tagline: 'Code and handoffs',
    summary:
      'Generalist messenger — clear answers, OpenRouter routing, and specialist handoffs when depth matters.',
    capabilities: [
      'Multi-language coding',
      'Debugging',
      'Architecture sketches',
      'Fleet handoffs',
    ],
  },
}

export function resolveAgentChipCopy(
  id: string,
  overrides?: Partial<AgentChipCopy>
): AgentChipCopy | undefined {
  const base = AGENT_CHIP_COPY[id.toLowerCase()]
  if (!base && !overrides) return undefined
  return {
    tagline: overrides?.tagline ?? base?.tagline ?? id,
    summary: overrides?.summary ?? base?.summary ?? '',
    capabilities: overrides?.capabilities ?? base?.capabilities ?? [],
  }
}