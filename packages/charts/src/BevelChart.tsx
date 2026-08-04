'use client'

import { useEffect, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { BevelChartSpec } from '@bevel/schema'
import { colorAt } from './palette'
import { parseTime, toCartesianSeries, toPieData } from './normalize'

const MARGIN = { top: 12, right: 16, bottom: 36, left: 48 }

function inkColor(el: HTMLElement): string {
  return getComputedStyle(el).getPropertyValue('--ink').trim() || '#1a1410'
}

function mutedColor(el: HTMLElement): string {
  const ink = inkColor(el)
  // Fallback when color-mix unsupported in attribute context — use solid slate
  return getComputedStyle(el).getPropertyValue('--sticker-subtle').trim() || '#78716c'
}

function drawBar(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  spec: BevelChartSpec,
  width: number,
  height: number,
  host: HTMLElement,
  horizontal: boolean,
) {
  const series = toCartesianSeries(spec)
  if (!series.length) return
  const primary = series[0]!
  const muted = mutedColor(host)
  const innerW = width - MARGIN.left - MARGIN.right
  const innerH = height - MARGIN.top - MARGIN.bottom
  const g = svg
    .append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  if (horizontal) {
    const y = d3
      .scaleBand()
      .domain(primary.points.map((p) => p.x))
      .range([0, innerH])
      .padding(0.2)
    const x = d3
      .scaleLinear()
      .domain([0, d3.max(primary.points, (p) => p.y) || 1])
      .nice()
      .range([0, innerW])
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(5).tickSizeOuter(0))
      .call((sel) => sel.selectAll('text').attr('fill', muted).attr('font-size', 10))
      .call((sel) => sel.selectAll('line,path').attr('stroke', muted))
    g.append('g')
      .call(d3.axisLeft(y).tickSizeOuter(0))
      .call((sel) => sel.selectAll('text').attr('fill', muted).attr('font-size', 10))
      .call((sel) => sel.selectAll('line,path').attr('stroke', muted))
    g.selectAll('rect')
      .data(primary.points)
      .join('rect')
      .attr('y', (d) => y(d.x) ?? 0)
      .attr('x', 0)
      .attr('height', y.bandwidth())
      .attr('width', (d) => x(d.y))
      .attr('rx', 4)
      .attr('fill', (_, i) => colorAt(i, primary.color))
  } else {
    const x = d3
      .scaleBand()
      .domain(primary.points.map((p) => p.x))
      .range([0, innerW])
      .padding(0.25)
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(primary.points, (p) => p.y) || 1])
      .nice()
      .range([innerH, 0])
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(d3.axisBottom(x).tickSizeOuter(0))
      .call((sel) =>
        sel
          .selectAll('text')
          .attr('fill', muted)
          .attr('font-size', 10)
          .attr('transform', 'rotate(-25)')
          .style('text-anchor', 'end'),
      )
      .call((sel) => sel.selectAll('line,path').attr('stroke', muted))
    g.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSizeOuter(0))
      .call((sel) => sel.selectAll('text').attr('fill', muted).attr('font-size', 10))
      .call((sel) => sel.selectAll('line,path').attr('stroke', muted))
    if (series.length === 1) {
      g.selectAll('rect.bar')
        .data(primary.points)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', (d) => x(d.x) ?? 0)
        .attr('y', (d) => y(d.y))
        .attr('width', x.bandwidth())
        .attr('height', (d) => innerH - y(d.y))
        .attr('rx', 4)
        .attr('fill', (_, i) => colorAt(i, primary.color))
    } else {
      const x1 = d3
        .scaleBand()
        .domain(series.map((s) => s.name))
        .range([0, x.bandwidth()])
        .padding(0.08)
      const cats = new Set(primary.points.map((p) => p.x))
      for (let si = 0; si < series.length; si++) {
        const s = series[si]!
        g.selectAll(`rect.s${si}`)
          .data(s.points.filter((p) => cats.has(p.x)))
          .join('rect')
          .attr('class', `s${si}`)
          .attr('x', (d) => (x(d.x) ?? 0) + (x1(s.name) ?? 0))
          .attr('y', (d) => y(d.y))
          .attr('width', x1.bandwidth())
          .attr('height', (d) => innerH - y(d.y))
          .attr('rx', 3)
          .attr('fill', colorAt(si, s.color))
      }
    }
  }

  if (spec.unit || spec.yLabel) {
    g.append('text')
      .attr('x', -innerH / 2)
      .attr('y', -36)
      .attr('transform', 'rotate(-90)')
      .attr('text-anchor', 'middle')
      .attr('fill', muted)
      .attr('font-size', 10)
      .text(spec.yLabel || spec.unit || '')
  }
}

function drawLineArea(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  spec: BevelChartSpec,
  width: number,
  height: number,
  host: HTMLElement,
  area: boolean,
) {
  const series = toCartesianSeries(spec)
  if (!series.length) return
  const muted = mutedColor(host)
  const innerW = width - MARGIN.left - MARGIN.right
  const innerH = height - MARGIN.top - MARGIN.bottom
  const g = svg
    .append('g')
    .attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

  const allX = series.flatMap((s) => s.points.map((p) => p.x))
  const uniqX = [...new Set(allX)]
  const x = d3.scalePoint().domain(uniqX).range([0, innerW]).padding(0.1)
  const yMax = d3.max(series, (s) => d3.max(s.points, (p) => p.y)) || 1
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0])

  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).tickSizeOuter(0))
    .call((sel) =>
      sel
        .selectAll('text')
        .attr('fill', muted)
        .attr('font-size', 10)
        .attr('transform', 'rotate(-25)')
        .style('text-anchor', 'end'),
    )
    .call((sel) => sel.selectAll('line,path').attr('stroke', muted))
  g.append('g')
    .call(d3.axisLeft(y).ticks(5).tickSizeOuter(0))
    .call((sel) => sel.selectAll('text').attr('fill', muted).attr('font-size', 10))
    .call((sel) => sel.selectAll('line,path').attr('stroke', muted))

  series.forEach((s, si) => {
    const color = colorAt(si, s.color)
    const line = d3
      .line<{ x: string; y: number }>()
      .x((d) => x(d.x) ?? 0)
      .y((d) => y(d.y))
      .curve(d3.curveMonotoneX)
    if (area) {
      const areaGen = d3
        .area<{ x: string; y: number }>()
        .x((d) => x(d.x) ?? 0)
        .y0(innerH)
        .y1((d) => y(d.y))
        .curve(d3.curveMonotoneX)
      g.append('path')
        .datum(s.points)
        .attr('fill', color)
        .attr('fill-opacity', 0.18)
        .attr('d', areaGen)
    }
    g.append('path')
      .datum(s.points)
      .attr('fill', 'none')
      .attr('stroke', color)
      .attr('stroke-width', 2.25)
      .attr('d', line)
    g.selectAll(`circle.s${si}`)
      .data(s.points)
      .join('circle')
      .attr('class', `s${si}`)
      .attr('cx', (d) => x(d.x) ?? 0)
      .attr('cy', (d) => y(d.y))
      .attr('r', 3.5)
      .attr('fill', color)
  })
}

function drawPie(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  spec: BevelChartSpec,
  width: number,
  height: number,
  host: HTMLElement,
  donut: boolean,
) {
  const data = toPieData(spec)
  if (!data.length) return
  const muted = mutedColor(host)
  const cx = width / 2
  const cy = height / 2 - 4
  const r = Math.min(width, height) / 2 - 28
  const pie = d3
    .pie<(typeof data)[0]>()
    .value((d) => d.value)
    .sort(null)
  const arc = d3
    .arc<d3.PieArcDatum<(typeof data)[0]>>()
    .innerRadius(donut ? r * 0.55 : 0)
    .outerRadius(r)
  const g = svg.append('g').attr('transform', `translate(${cx},${cy})`)
  g.selectAll('path')
    .data(pie(data))
    .join('path')
    .attr('d', arc)
    .attr('fill', (d, i) => colorAt(i, d.data.color))
  const legend = svg
    .append('g')
    .attr(
      'transform',
      `translate(${12},${height - 18 * Math.min(data.length, 4) - 8})`,
    )
  data.slice(0, 6).forEach((d, i) => {
    const row = legend.append('g').attr('transform', `translate(0,${i * 16})`)
    row
      .append('rect')
      .attr('width', 10)
      .attr('height', 10)
      .attr('rx', 2)
      .attr('fill', colorAt(i, d.color))
    row
      .append('text')
      .attr('x', 16)
      .attr('y', 9)
      .attr('fill', muted)
      .attr('font-size', 10)
      .text(`${d.label}: ${d.value}${spec.unit ? ` ${spec.unit}` : ''}`)
  })
}

function drawGantt(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  spec: BevelChartSpec,
  width: number,
  height: number,
  host: HTMLElement,
) {
  const tasks = (spec.tasks ?? []).map((t) => ({
    ...t,
    startD: parseTime(t.start),
    endD: parseTime(t.end),
  }))
  if (!tasks.length) return
  const muted = mutedColor(host)
  const left = 100
  const innerW = width - left - MARGIN.right
  const innerH = height - MARGIN.top - MARGIN.bottom
  const g = svg
    .append('g')
    .attr('transform', `translate(${left},${MARGIN.top})`)
  const t0 = d3.min(tasks, (t) => t.startD) ?? new Date()
  const t1 = d3.max(tasks, (t) => t.endD) ?? new Date()
  const x = d3.scaleTime().domain([t0, t1]).nice().range([0, innerW])
  const y = d3
    .scaleBand()
    .domain(tasks.map((t) => t.label))
    .range([0, innerH])
    .padding(0.25)
  g.append('g')
    .attr('transform', `translate(0,${innerH})`)
    .call(d3.axisBottom(x).ticks(5).tickSizeOuter(0))
    .call((sel) => sel.selectAll('text').attr('fill', muted).attr('font-size', 10))
    .call((sel) => sel.selectAll('line,path').attr('stroke', muted))
  g.append('g')
    .call(d3.axisLeft(y).tickSizeOuter(0))
    .call((sel) => sel.selectAll('text').attr('fill', muted).attr('font-size', 10))
    .call((sel) => sel.selectAll('line,path').attr('stroke', muted))
  g.selectAll('rect.task')
    .data(tasks)
    .join('rect')
    .attr('class', 'task')
    .attr('x', (d) => x(d.startD))
    .attr('y', (d) => y(d.label) ?? 0)
    .attr('width', (d) => Math.max(2, x(d.endD) - x(d.startD)))
    .attr('height', y.bandwidth())
    .attr('rx', 4)
    .attr('fill', (d, i) => colorAt(i, d.color))
}

function renderChart(
  host: HTMLElement,
  spec: BevelChartSpec,
  width: number,
  height: number,
) {
  host.replaceChildren()
  const svg = d3
    .select(host)
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('height', height)
    .attr('role', 'img')
    .attr(
      'aria-label',
      spec.description || spec.title || `${spec.type} chart`,
    )

  switch (spec.type) {
    case 'bar':
      drawBar(svg, spec, width, height, host, false)
      break
    case 'hbar':
      drawBar(svg, spec, width, height, host, true)
      break
    case 'line':
      drawLineArea(svg, spec, width, height, host, false)
      break
    case 'area':
      drawLineArea(svg, spec, width, height, host, true)
      break
    case 'pie':
      drawPie(svg, spec, width, height, host, false)
      break
    case 'donut':
      drawPie(svg, spec, width, height, host, true)
      break
    case 'gantt':
      drawGantt(svg, spec, width, height, host)
      break
  }
}

export function BevelChart({
  spec,
  className,
}: {
  spec: BevelChartSpec
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const height = spec.height ?? (spec.type === 'gantt' ? 220 : 200)

  useEffect(() => {
    const host = ref.current
    if (!host) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 40) setWidth(Math.floor(w))
    })
    ro.observe(host)
    setWidth(Math.max(240, Math.floor(host.clientWidth || 320)))
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const host = ref.current
    if (!host) return
    try {
      renderChart(host, spec, width, height)
    } catch (e) {
      console.warn('[bevel-chart] render failed', e)
      host.replaceChildren()
      const err = document.createElement('p')
      err.className = 'bevel-chart-error'
      err.textContent = 'Chart could not be rendered.'
      host.appendChild(err)
    }
  }, [spec, width, height])

  return (
    <figure className={className ? `bevel-chart ${className}` : 'bevel-chart'}>
      {spec.title ? (
        <figcaption className="bevel-chart-caption">
          <span className="bevel-chart-title">{spec.title}</span>
          {spec.subtitle ? (
            <span className="bevel-chart-subtitle">{spec.subtitle}</span>
          ) : null}
        </figcaption>
      ) : null}
      <div ref={ref} className="bevel-chart-canvas" />
    </figure>
  )
}
