/**
 * Channel nuggets — Brad Frost atomic design applied to inbound posts
 * and agent-built surfaces.
 *
 * atom       indivisible UX unit (chip, icon, metric)
 * molecule   two or more atoms bonded (status + assignee)
 * organism   complex preview (task card, traffic chart)
 * template   page partial — opens in the right pane (desktop) / main pane (phone)
 * page       full instance of a template with real content — full width
 *
 * @see https://atomicdesign.bradfrost.com/chapter-2/
 */
import { z } from 'zod'

export const NUGGET_SCALES = [
  'atom',
  'molecule',
  'organism',
  'template',
  'page',
] as const
export type NuggetScale = (typeof NUGGET_SCALES)[number]

export const NUGGET_PLACEMENTS = ['thread', 'pane', 'page'] as const
export type NuggetPlacement = (typeof NUGGET_PLACEMENTS)[number]

export const NUGGET_SOURCES = [
  'magenta',
  'clickup',
  'linear',
  'github',
  'slack',
  'sendgrid',
  'cmyk',
  'bevel',
] as const
export type NuggetSource = (typeof NUGGET_SOURCES)[number]

export const NuggetAtomSchema = z.object({
  kind: z.enum([
    'mark',
    'chip',
    'metric',
    'stat',
    'time',
    'person',
    'link',
    'icon',
  ]),
  label: z.string().max(80).optional(),
  value: z.string().max(240).optional(),
  href: z.string().max(512).optional(),
  tone: z
    .enum(['neutral', 'accent', 'success', 'warning', 'critical'])
    .optional(),
})
export type NuggetAtom = z.infer<typeof NuggetAtomSchema>

export const NuggetChartSchema = z.object({
  type: z.enum(['pie', 'spark', 'bars']),
  slices: z
    .array(
      z.object({
        label: z.string().max(40),
        value: z.number(),
        color: z.string().max(32).optional(),
      }),
    )
    .max(8)
    .optional(),
  series: z.array(z.number()).max(48).optional(),
})
export type NuggetChart = z.infer<typeof NuggetChartSchema>

export const NuggetSectionSchema = z.object({
  title: z.string().max(80),
  body: z.string().max(4000),
})

export type NuggetLint = {
  level: 'error' | 'warn'
  code: string
  message: string
}

type NuggetShape = {
  v: 1
  scale: NuggetScale
  source: string
  title: string
  summary?: string
  href?: string
  logo?: string
  atoms: NuggetAtom[]
  chart?: z.infer<typeof NuggetChartSchema>
  sections?: z.infer<typeof NuggetSectionSchema>[]
  related?: NuggetShape[]
  placement?: NuggetPlacement
}

export const NuggetSchema: z.ZodType<NuggetShape> = z.lazy(() =>
  z.object({
    v: z.literal(1),
    scale: z.enum(NUGGET_SCALES),
    source: z.string().min(1).max(40),
    title: z.string().min(1).max(160),
    summary: z.string().max(400).optional(),
    href: z.string().max(512).optional(),
    logo: z.string().max(200).optional(),
    atoms: z.array(NuggetAtomSchema).max(16).default([]),
    chart: NuggetChartSchema.optional(),
    sections: z.array(NuggetSectionSchema).max(8).optional(),
    related: z.array(NuggetSchema).max(8).optional(),
    placement: z.enum(NUGGET_PLACEMENTS).optional(),
  }),
) as z.ZodType<NuggetShape>
export type Nugget = NuggetShape

export const NUGGET_PREFIX = 'bevel-nugget:v1'

export function defaultNuggetPlacement(scale: NuggetScale): NuggetPlacement {
  if (scale === 'page') return 'page'
  if (scale === 'template') return 'pane'
  return 'thread'
}

export function resolveNuggetPlacement(nugget: Nugget): NuggetPlacement {
  return nugget.placement ?? defaultNuggetPlacement(nugget.scale)
}

/** Lint a nugget so agents can insert valid atoms → pages into a thread. */
export function lintNugget(nugget: Nugget, path = 'nugget'): NuggetLint[] {
  const issues: NuggetLint[] = []
  const n = nugget.atoms.length
  if (nugget.scale === 'atom') {
    if (n === 0) {
      issues.push({
        level: 'error',
        code: 'atom.empty',
        message: `${path}: an atom needs one chip, icon, or metric.`,
      })
    }
    if (n > 2) {
      issues.push({
        level: 'error',
        code: 'atom.too-big',
        message: `${path}: an atom is indivisible — promote extra facts to a molecule.`,
      })
    }
    if (nugget.chart || nugget.sections?.length) {
      issues.push({
        level: 'error',
        code: 'atom.complex',
        message: `${path}: charts/sections belong on an organism or template.`,
      })
    }
  }
  if (nugget.scale === 'molecule' && n < 2) {
    issues.push({
      level: 'error',
      code: 'molecule.too-small',
      message: `${path}: a molecule bonds two or more atoms.`,
    })
  }
  if (nugget.scale === 'organism' && n < 1 && !nugget.chart) {
    issues.push({
      level: 'warn',
      code: 'organism.thin',
      message: `${path}: an organism should preview atoms or a chart.`,
    })
  }
  if (
    (nugget.scale === 'template' || nugget.scale === 'page') &&
    !nugget.sections?.length
  ) {
    issues.push({
      level: 'error',
      code: `${nugget.scale}.empty`,
      message: `${path}: a ${nugget.scale} needs sections (real content / wireframe blocks).`,
    })
  }
  if (nugget.placement && nugget.placement !== defaultNuggetPlacement(nugget.scale)) {
    if (nugget.scale === 'atom' && nugget.placement !== 'thread') {
      issues.push({
        level: 'warn',
        code: 'atom.placement',
        message: `${path}: atoms stay in the thread.`,
      })
    }
  }
  for (const [i, child] of (nugget.related ?? []).entries()) {
    issues.push(...lintNugget(child, `${path}.related[${i}]`))
  }
  return issues
}

export function serializeNugget(nugget: Nugget): string {
  return `${NUGGET_PREFIX}\n${JSON.stringify(nugget)}`
}

export function parseNugget(raw: string | null | undefined): Nugget | null {
  if (!raw) return null
  const text = raw.trim()
  if (!text.startsWith(NUGGET_PREFIX)) return null
  const json = text.slice(NUGGET_PREFIX.length).trim()
  try {
    const parsed = JSON.parse(json)
    const result = NuggetSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export function nuggetLogoPath(source: string): string {
  const id = source.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
  return `/integrations/${id || 'bevel'}.svg`
}
