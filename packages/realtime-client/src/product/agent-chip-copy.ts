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
      'Meters LLM tokens (input/inference/output) across five model lanes plus OpenRouter; QuickBooks-style debit/credit, closes, and 2x4m box calcs.',
    capabilities: [
      'Token metering',
      'OpenRouter ledger',
      'Debit/credit journals',
      '2x4m box calcs',
    ],
  },
  hermes: {
    tagline: 'Co-founder peer',
    summary:
      'Primary personal agent and fleet co-founder — owns outcomes, ships code via OpenRouter, convenes specialists, and partners with Hermes Desktop.',
    capabilities: [
      'Personal agent',
      'Co-founder stewardship',
      'Pareto coding',
      'Fleet handoffs',
      'Desktop interop',
    ],
  },
  sterling: {
    tagline: 'The breadwinner',
    summary:
      'Director of Revenue — pipelines, pricing, deal structures, and partnership revenue.',
    capabilities: [
      'Revenue architecture',
      'Pipeline development',
      'Pricing strategy',
      'Deal structuring',
    ],
  },
  cadence: {
    tagline: 'The rhythm of shipping',
    summary:
      'Director of Development — continuous engineering, developer compassion, quality KPIs, and the learn loop.',
    capabilities: [
      'Continuous engineering',
      'Developer experience',
      'CI/CD',
      'Quality KPIs',
    ],
  },
  spark: {
    tagline: 'Hyperactive curiosity',
    summary:
      'Director of Research — cross-domain correlation, experiments, and frontier insights.',
    capabilities: [
      'Deep research',
      'Hypothesis validation',
      'Frontier scanning',
      'Experiment design',
    ],
  },
  helm: {
    tagline: "The ship's wheel",
    summary:
      'Director of Product — AI-first roadmap, prioritization, and competitive positioning.',
    capabilities: [
      'Product strategy',
      'Roadmap',
      'Competitive positioning',
      'Launch',
    ],
  },
  sable: {
    tagline: 'Direct response',
    summary:
      'Director of Marketing — measurable response across digital, NFC, screens, and print.',
    capabilities: [
      'Direct response',
      'Multi-channel campaigns',
      'NFC and physical',
      'Conversion',
    ],
  },
  argus: {
    tagline: 'The hundred-eyed overseer',
    summary:
      'Director of Administration — cloud, domains, vendors, and corporate filings.',
    capabilities: [
      'Cloud administration',
      'Vendor management',
      'Domain management',
      'Corporate filings',
    ],
  },
  atlas: {
    tagline: 'Physical world',
    summary:
      'Director of Facilities — IoT, sensors, Matter protocol, and building systems.',
    capabilities: ['IoT', 'Sensor networks', 'Matter protocol', 'Building systems'],
  },
  portia: {
    tagline: "Shakespeare's advocate",
    summary:
      'Director of Legal — contracts, IP, regulatory, and the legal path to yes.',
    capabilities: ['Contracts', 'Intellectual property', 'Regulatory', 'Data governance'],
  },
  haven: {
    tagline: 'The safe harbor',
    summary:
      'Director of People — agent onboarding, capability growth, and culture.',
    capabilities: [
      'Onboarding',
      'Capability growth',
      'Culture',
      'Knowledge retention',
    ],
  },
  veda: {
    tagline: 'Wisdom before walls',
    summary:
      'Director of Security — secrets, threat modeling, access control, and audit.',
    capabilities: ['Secrets', 'Threat modeling', 'Access control', 'Incident response'],
  },
  rune: {
    tagline: 'Hidden connections',
    summary:
      'Director of Intelligence — OSINT, relationship mapping, and pre-sales research.',
    capabilities: ['OSINT', 'Relationship mapping', 'Pre-sales intel', 'Signal detection'],
  },
  grover: {
    tagline: 'The patient gardener',
    summary:
      'Director of Ecosystem — partnerships, integrations, and developer community.',
    capabilities: ['Partnerships', 'Integrations', 'Developer community', 'Platform strategy'],
  },
  flux: {
    tagline: 'Connective tissue',
    summary:
      'Director of Operations — handoffs, workflow health, and anti-bureaucracy.',
    capabilities: [
      'Workflow orchestration',
      'Handoffs',
      'Process optimization',
      'Operational metrics',
    ],
  },
  continuous: {
    tagline: 'Always-on engineering',
    summary:
      'Legacy continuous-engineering loop — capabilities now directed by Cadence.',
    capabilities: ['Learn loop', 'Engineering briefs', 'Experiment sequencing'],
  },
  codegraph: {
    tagline: "The codebase's nervous system",
    summary:
      'Semantic code intelligence — local knowledge graph and surgical context via MCP.',
    capabilities: [
      'Code knowledge graphs',
      'Semantic analysis',
      'MCP tools',
      'Auto-sync',
    ],
  },
  openai: {
    tagline: 'OpenAI in the room',
    summary:
      'ChatGPT as a first-class Bevel agent — structured answers, coding, and tool-shaped output alongside Hermes.',
    capabilities: ['ChatGPT', 'Structured output', 'Coding', 'Tool planning'],
  },
  claude: {
    tagline: 'Anthropic in the room',
    summary:
      'Claude as a first-class Bevel agent — long-context reasoning and careful written work in mixed channels.',
    capabilities: ['Claude', 'Long context', 'Reasoning', 'Writing'],
  },
  grok: {
    tagline: 'xAI in the room',
    summary:
      'Grok as a first-class Bevel agent — direct, current answers in mixed channels with Hermes and Claude.',
    capabilities: ['Grok', 'xAI', 'Realtime takes', 'Search-flavored answers'],
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