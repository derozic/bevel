import { z } from 'zod'

/**
 * Bevel chart objects — agents (e.g. Mildred) emit these in chat as
 * fenced ```bevel-chart JSON so the client can render D3 visuals inline.
 */

export const chartPointSchema = z.object({
  /** Category or time label */
  x: z.union([z.string(), z.number()]),
  /** Numeric value */
  y: z.number(),
  /** Optional series key when using multi-series flat data */
  series: z.string().optional(),
  color: z.string().optional(),
})

export const chartSeriesSchema = z.object({
  name: z.string(),
  data: z.array(
    z.object({
      x: z.union([z.string(), z.number()]),
      y: z.number(),
    }),
  ),
  color: z.string().optional(),
})

export const chartDatumSchema = z.object({
  label: z.string(),
  value: z.number(),
  color: z.string().optional(),
})

/** Gantt / timeline task (ISO date or epoch ms). */
export const chartGanttTaskSchema = z.object({
  id: z.string().optional(),
  label: z.string(),
  start: z.union([z.string(), z.number()]),
  end: z.union([z.string(), z.number()]),
  group: z.string().optional(),
  color: z.string().optional(),
})

export const chartTypeSchema = z.enum([
  'bar',
  'hbar',
  'line',
  'area',
  'pie',
  'donut',
  'gantt',
])

export const bevelChartSpecSchema = z
  .object({
    /** Discriminator for agents / parsers */
    kind: z.literal('bevel-chart').optional().default('bevel-chart'),
    type: chartTypeSchema,
    title: z.string().max(200).optional(),
    subtitle: z.string().max(400).optional(),
    unit: z.string().max(40).optional(),
    xLabel: z.string().max(80).optional(),
    yLabel: z.string().max(80).optional(),
    /**
     * Simple categorical series — preferred for token spend, counts, etc.
     * [{ label: "week 1", value: 12.4 }, ...]
     */
    data: z.array(chartDatumSchema).max(64).optional(),
    /** Multi-series cartesian (line/area/bar). */
    series: z.array(chartSeriesSchema).max(12).optional(),
    /** Flat points with optional series field. */
    points: z.array(chartPointSchema).max(500).optional(),
    /** Gantt tasks. */
    tasks: z.array(chartGanttTaskSchema).max(64).optional(),
    /** Height hint in px (client may clamp). */
    height: z.number().min(120).max(480).optional(),
    /** Accessibility / caption for screen readers */
    description: z.string().max(1000).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'gantt') {
      if (!val.tasks?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'gantt charts require tasks[]',
          path: ['tasks'],
        })
      }
      return
    }
    if (val.type === 'pie' || val.type === 'donut') {
      if (!val.data?.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'pie/donut charts require data[]',
          path: ['data'],
        })
      }
      return
    }
    // bar / hbar / line / area
    const has =
      (val.data?.length ?? 0) > 0 ||
      (val.series?.length ?? 0) > 0 ||
      (val.points?.length ?? 0) > 0
    if (!has) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'chart requires data[], series[], or points[]',
        path: ['data'],
      })
    }
  })

export type BevelChartSpec = z.infer<typeof bevelChartSpecSchema>
export type ChartType = z.infer<typeof chartTypeSchema>
export type ChartDatum = z.infer<typeof chartDatumSchema>
export type ChartGanttTask = z.infer<typeof chartGanttTaskSchema>

/** Parse unknown JSON into a chart spec, or null. */
export function parseBevelChartSpec(input: unknown): BevelChartSpec | null {
  const result = bevelChartSpecSchema.safeParse(input)
  return result.success ? result.data : null
}

/**
 * Extract fenced ```bevel-chart / ```chart blocks from agent message text.
 * Returns the remaining markdown with fences removed and the specs in order.
 */
export function extractChartBlocks(text: string): {
  specs: BevelChartSpec[]
  /** Text with chart fences replaced by placeholders (optional use) */
  withoutCharts: string
} {
  const specs: BevelChartSpec[] = []
  const re =
    /```(?:bevel-chart|chart|bevel_chart)[^\n]*\n([\s\S]*?)```/gi
  const withoutCharts = text.replace(re, (_full, body: string) => {
    try {
      const json = JSON.parse(String(body).trim()) as unknown
      const spec = parseBevelChartSpec(json)
      if (spec) {
        specs.push(spec)
        return '\n'
      }
    } catch {
      /* leave invalid fences alone */
    }
    return _full
  })
  return { specs, withoutCharts }
}
