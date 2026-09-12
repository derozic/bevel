import type { Nugget } from '@bevel/schema'
import { nuggetLogoPath } from '@bevel/schema'

export const MAGENTA_TRAFFIC_NUGGET: Nugget = {
  v: 1,
  scale: 'organism',
  source: 'magenta',
  title: 'Traffic vs probes · last 24h',
  summary: 'Product events held. Uptime checks are Magenta probing itself — not visitors.',
  href: 'https://admin.magenta.ac',
  logo: nuggetLogoPath('magenta'),
  atoms: [
    { kind: 'metric', label: 'product', value: '1,284', tone: 'accent' },
    { kind: 'metric', label: 'probes', value: '2,880', tone: 'neutral' },
    { kind: 'chip', label: 'fleet', value: 'up', tone: 'success' },
    { kind: 'time', label: 'window', value: '24h' },
  ],
  chart: {
    type: 'pie',
    slices: [
      { label: 'Product', value: 1284, color: '#C026D3' },
      { label: 'Probes', value: 2880, color: '#64748b' },
    ],
  },
  sections: [
    {
      title: 'What this is',
      body: 'Magenta MCP magenta_traffic splits first-party product events from uptime_check probes (every 30s per brand). Agents must not treat probe volume as people.',
    },
    {
      title: 'Related workflow',
      body: 'If a site drops, Magenta fires reliability.site_down to Hermes. Bevel can post that as a molecule in ~ops.',
    },
  ],
}

export const CLICKUP_TASK_NUGGET: Nugget = {
  v: 1,
  scale: 'organism',
  source: 'clickup',
  title: 'Ship Magenta MCP card',
  summary: 'Task update from ClickUp — workable in the channel, expandable to the full brief.',
  href: 'https://app.clickup.com',
  logo: nuggetLogoPath('clickup'),
  atoms: [
    { kind: 'chip', label: 'status', value: 'in review', tone: 'accent' },
    { kind: 'person', label: 'assignee', value: 'Scott' },
    { kind: 'time', label: 'due', value: 'Fri' },
    { kind: 'chip', label: 'list', value: 'Bevel ship', tone: 'neutral' },
  ],
  sections: [
    {
      title: 'Description',
      body: 'Catalog Magenta MCP on Console → Integrations. Inbound posts use organism nuggets; agents query via Streamable HTTP.',
    },
    {
      title: 'Acceptance',
      body: 'Card shows live MCP status, copyable mcp.json, and a preview organism in the catalog.',
    },
  ],
}

export const LINEAR_ISSUE_NUGGET: Nugget = {
  v: 1,
  scale: 'organism',
  source: 'linear',
  title: 'BEV-184 · Pin grid eats the rail',
  summary: 'Linear issue — same organism contract as ClickUp, Linear triangle mark.',
  href: 'https://linear.app',
  logo: nuggetLogoPath('linear'),
  atoms: [
    { kind: 'chip', label: 'id', value: 'BEV-184', tone: 'accent' },
    { kind: 'chip', label: 'priority', value: 'P1', tone: 'critical' },
    { kind: 'person', label: 'owner', value: 'Cadence' },
    { kind: 'chip', label: 'state', value: 'In Progress', tone: 'warning' },
  ],
  sections: [
    {
      title: 'Repro',
      body: 'One pinned conversation used auto-fit 1fr, so the brand square stretched to the full rail width.',
    },
    {
      title: 'Fix',
      body: 'Rail grid is always 3 columns; face max-width 3rem.',
    },
  ],
}

export const LINEAR_MOLECULE: Nugget = {
  v: 1,
  scale: 'molecule',
  source: 'linear',
  title: 'BEV-184 moved to In Progress',
  logo: nuggetLogoPath('linear'),
  atoms: [
    { kind: 'chip', label: 'id', value: 'BEV-184', tone: 'accent' },
    { kind: 'chip', label: 'state', value: 'In Progress', tone: 'warning' },
  ],
}

export const MAGENTA_ATOM: Nugget = {
  v: 1,
  scale: 'atom',
  source: 'magenta',
  title: 'bevel up',
  logo: nuggetLogoPath('magenta'),
  atoms: [{ kind: 'chip', label: 'site', value: 'bevel up', tone: 'success' }],
}

export const CMYK_TOKEN_MOLECULE: Nugget = {
  v: 1,
  scale: 'molecule',
  source: 'cmyk',
  title: 'Process tokens',
  summary: 'Cyan · Magenta · Yellow · Key',
  logo: nuggetLogoPath('cmyk'),
  href: 'https://cmyk.2x4m.lvh.me/brandkits/1/kitchen-sink/',
  atoms: [
    { kind: 'chip', label: 'C', value: '#0ea5e9', tone: 'accent' },
    { kind: 'chip', label: 'M', value: '#d946ef' },
    { kind: 'chip', label: 'Y', value: '#eab308', tone: 'warning' },
    { kind: 'chip', label: 'K', value: '#111827' },
  ],
}

export const CMYK_BRANDKIT_ORGANISM: Nugget = {
  v: 1,
  scale: 'organism',
  source: 'cmyk',
  title: '2x4m BrandKit shared',
  summary:
    'Kitchen sink + Tokens Studio JSON. Open the process-token molecule, or the template in the pane.',
  href: 'https://cmyk.2x4m.lvh.me/brandkits/1/kitchen-sink/',
  logo: nuggetLogoPath('cmyk'),
  atoms: [
    { kind: 'link', label: 'sink', value: 'kitchen sink', href: 'https://cmyk.2x4m.lvh.me/brandkits/1/kitchen-sink/' },
    { kind: 'link', label: 'tokens', value: 'figma.tokens.json' },
    { kind: 'chip', label: 'figma', value: 'organisms', tone: 'accent' },
  ],
  related: [CMYK_TOKEN_MOLECULE],
}

export const CMYK_BRANDKIT_TEMPLATE: Nugget = {
  v: 1,
  scale: 'template',
  source: 'cmyk',
  title: 'BrandKit partial',
  summary: 'Page-level wireframe: header + token strip + organism jumps.',
  logo: nuggetLogoPath('cmyk'),
  placement: 'pane',
  atoms: [
    { kind: 'chip', label: 'kit', value: '2x4m' },
    { kind: 'chip', label: 'partial', value: 'template' },
  ],
  sections: [
    {
      title: 'Header',
      body: 'Wordmark, day-part mark, kit name. Atoms only.',
    },
    {
      title: 'Token strip',
      body: 'The process-token molecule (C M Y K) sits under the header.',
    },
    {
      title: 'Organism jumps',
      body: 'Figma organism frame deep-links. Sharing this template posts the organism in-thread and this partial in the right pane.',
    },
  ],
  related: [CMYK_BRANDKIT_ORGANISM, CMYK_TOKEN_MOLECULE],
}

export const CMYK_BRANDKIT_PAGE: Nugget = {
  v: 1,
  scale: 'page',
  source: 'cmyk',
  title: '2x4m BrandKit — live page',
  summary: 'Template populated with real tokens and imagery. Full width on tablet / fold inner; main pane on phone.',
  logo: nuggetLogoPath('cmyk'),
  placement: 'page',
  href: 'https://cmyk.2x4m.lvh.me/brandkits/1/kitchen-sink/',
  atoms: [
    { kind: 'chip', label: 'kit', value: '2x4m', tone: 'accent' },
    { kind: 'time', label: 'shared', value: 'just now' },
  ],
  sections: [
    {
      title: 'Live tokens',
      body: 'Cyan #0ea5e9, Magenta #d946ef, Yellow #eab308, Key #111827 — pulled from Tokens Studio JSON.',
    },
    {
      title: 'Kitchen sink',
      body: 'Buttons, inputs, cards, and type samples at https://cmyk.2x4m.lvh.me/brandkits/1/kitchen-sink/',
    },
  ],
  related: [CMYK_BRANDKIT_TEMPLATE, CMYK_BRANDKIT_ORGANISM],
}

export const NUGGET_EXAMPLES: Nugget[] = [
  MAGENTA_ATOM,
  LINEAR_MOLECULE,
  CMYK_TOKEN_MOLECULE,
  CLICKUP_TASK_NUGGET,
  LINEAR_ISSUE_NUGGET,
  MAGENTA_TRAFFIC_NUGGET,
  CMYK_BRANDKIT_ORGANISM,
  CMYK_BRANDKIT_TEMPLATE,
  CMYK_BRANDKIT_PAGE,
]
