import type { BevelChartSpec, ChartDatum } from '@bevel/schema'

export type CartesianSeries = {
  name: string
  color?: string
  points: { x: string; y: number }[]
}

/** Coerce data/series/points into series for bar/line/area. */
export function toCartesianSeries(spec: BevelChartSpec): CartesianSeries[] {
  if (spec.series?.length) {
    return spec.series.map((s) => ({
      name: s.name,
      color: s.color,
      points: s.data.map((d) => ({ x: String(d.x), y: d.y })),
    }))
  }
  if (spec.data?.length) {
    return [
      {
        name: spec.yLabel || spec.unit || 'value',
        points: spec.data.map((d) => ({ x: d.label, y: d.value })),
      },
    ]
  }
  if (spec.points?.length) {
    const bySeries = new Map<string, { x: string; y: number }[]>()
    for (const p of spec.points) {
      const key = p.series || 'value'
      const arr = bySeries.get(key) ?? []
      arr.push({ x: String(p.x), y: p.y })
      bySeries.set(key, arr)
    }
    return [...bySeries.entries()].map(([name, points]) => ({ name, points }))
  }
  return []
}

export function toPieData(spec: BevelChartSpec): ChartDatum[] {
  if (spec.data?.length) return spec.data
  if (spec.points?.length) {
    return spec.points.map((p) => ({
      label: String(p.x),
      value: p.y,
      color: p.color,
    }))
  }
  return []
}

export function parseTime(v: string | number): Date {
  if (typeof v === 'number') return new Date(v)
  const d = new Date(v)
  if (!Number.isNaN(d.getTime())) return d
  // bare YYYY-MM-DD
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  if (m) return new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!))
  return new Date(v)
}
