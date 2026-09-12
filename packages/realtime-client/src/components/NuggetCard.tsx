'use client'

import { useMemo, useState } from 'react'
import {
  nuggetLogoPath,
  resolveNuggetPlacement,
  type Nugget,
  type NuggetAtom,
} from '@bevel/schema'
import { cn } from '../lib/utils'

function piePath(start: number, fraction: number, r = 36, cx = 40, cy = 40): string {
  const a0 = start * Math.PI * 2 - Math.PI / 2
  const a1 = (start + fraction) * Math.PI * 2 - Math.PI / 2
  const x0 = cx + r * Math.cos(a0)
  const y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  const large = fraction > 0.5 ? 1 : 0
  return `M ${cx} ${cy} L ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} Z`
}

function Chart({ nugget }: { nugget: Nugget }) {
  const chart = nugget.chart
  if (!chart) return null
  if (chart.type === 'pie' && chart.slices?.length) {
    const total = chart.slices.reduce((s, x) => s + Math.max(0, x.value), 0) || 1
    let cursor = 0
    return (
      <div className="bevel-nugget-chart">
        <svg viewBox="0 0 80 80" className="bevel-nugget-pie" aria-hidden>
          {chart.slices.map((slice, i) => {
            const frac = Math.max(0, slice.value) / total
            const d = piePath(cursor, frac)
            cursor += frac
            return (
              <path
                key={slice.label}
                d={d}
                fill={slice.color || `var(--nugget-slice-${i}, var(--bevel-accent))`}
              />
            )
          })}
        </svg>
        <ul>
          {chart.slices.map((slice) => (
            <li key={slice.label}>
              <span
                className="bevel-nugget-swatch"
                style={{ background: slice.color || 'var(--bevel-accent)' }}
              />
              {slice.label}
              <b>{slice.value.toLocaleString()}</b>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  if ((chart.type === 'spark' || chart.type === 'bars') && chart.series?.length) {
    const max = Math.max(...chart.series, 1)
    const w = 120
    const h = 36
    const step = w / Math.max(chart.series.length - 1, 1)
    const d = chart.series
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${i * step} ${h - (v / max) * h}`)
      .join(' ')
    return (
      <svg viewBox={`0 0 ${w} ${h}`} className="bevel-nugget-spark" aria-hidden>
        <path d={d} fill="none" stroke="var(--bevel-accent)" strokeWidth="2" />
      </svg>
    )
  }
  return null
}

function Atom({ atom }: { atom: NuggetAtom }) {
  const inner = (
    <>
      {atom.label ? <span className="bevel-nugget-k">{atom.label}</span> : null}
      {atom.value ? <span className="bevel-nugget-v">{atom.value}</span> : null}
    </>
  )
  const className = cn('bevel-nugget-atom', `bevel-nugget-atom--${atom.kind}`)
  if (atom.href) {
    return (
      <a className={className} data-tone={atom.tone} href={atom.href}>
        {inner}
      </a>
    )
  }
  return (
    <span className={className} data-tone={atom.tone}>
      {inner}
    </span>
  )
}

export function NuggetCard({
  nugget,
  className,
}: {
  nugget: Nugget
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState<Nugget | null>(null)
  const shown = focus ?? nugget
  const logo = shown.logo || nuggetLogoPath(shown.source)
  const placement = resolveNuggetPlacement(shown)
  const expandable =
    shown.scale === 'organism' ||
    shown.scale === 'template' ||
    shown.scale === 'page' ||
    Boolean(shown.sections?.length)
  const expandLabel =
    shown.scale === 'page'
      ? 'Open page'
      : shown.scale === 'template'
        ? 'Open in pane'
        : 'Expand'

  function tryNativeOpen(target: Nugget = shown): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false
    }
    if (document.documentElement.getAttribute('data-bevel-native') !== '1') {
      return false
    }
    const where = resolveNuggetPlacement(target)
    const pane =
      target.scale === 'template' ||
      target.scale === 'page' ||
      where === 'pane' ||
      where === 'page'
    if (!pane) return false
    const channel = (
      window as Window & { BevelNuggets?: { postMessage: (msg: string) => void } }
    ).BevelNuggets
    if (!channel?.postMessage) return false
    channel.postMessage(JSON.stringify(target))
    return true
  }

  const print = () => {
    const node = document.getElementById(`nugget-print-${nugget.title}`)
    if (!node) {
      window.print()
      return
    }
    const w = window.open('', '_blank', 'noopener,noreferrer')
    if (!w) return
    w.document.write(
      `<!doctype html><title>${nugget.title}</title><body>${node.innerHTML}</body>`,
    )
    w.document.close()
    w.focus()
    w.print()
  }

  const body = useMemo(
    () => (
      <article
        className={cn('bevel-nugget', `bevel-nugget--${shown.scale}`, className)}
        data-source={shown.source}
        data-scale={shown.scale}
        data-placement={placement}
        itemScope
        itemType="https://schema.org/CreativeWork"
      >
        <header className="bevel-nugget-head">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" className="bevel-nugget-logo" width={28} height={28} />
          <div className="min-w-0">
            <p className="bevel-nugget-source">
              {shown.source} · {shown.scale}
            </p>
            <h3 className="bevel-nugget-title" itemProp="name">
              {shown.href ? (
                <a href={shown.href} itemProp="url">
                  {shown.title}
                </a>
              ) : (
                shown.title
              )}
            </h3>
          </div>
        </header>
        {shown.summary ? (
          <p className="bevel-nugget-summary" itemProp="description">
            {shown.summary}
          </p>
        ) : null}
        {shown.atoms.length > 0 ? (
          <div className="bevel-nugget-atoms">
            {shown.atoms.map((atom, i) => (
              <Atom key={`${atom.kind}-${atom.value}-${i}`} atom={atom} />
            ))}
          </div>
        ) : null}
        <Chart nugget={shown} />
        {shown.related && shown.related.length > 0 ? (
          <div className="bevel-nugget-related">
            {shown.related.map((child) => (
              <button
                key={`${child.scale}-${child.title}`}
                type="button"
                className="bevel-nugget-related-btn"
                onClick={() => {
                  if (tryNativeOpen(child)) return
                  setFocus(child)
                }}
              >
                Open {child.scale}: {child.title}
              </button>
            ))}
            {focus ? (
              <button
                type="button"
                className="bevel-nugget-related-btn"
                onClick={() => setFocus(null)}
              >
                Back to {nugget.scale}
              </button>
            ) : null}
          </div>
        ) : null}
        {expandable ? (
          <div className="bevel-nugget-actions">
            <button
              type="button"
              onClick={() => {
                if (tryNativeOpen()) return
                setOpen(true)
              }}
            >
              {expandLabel}
            </button>
          </div>
        ) : null}
      </article>
    ),
    [shown, logo, expandable, expandLabel, className, focus, nugget.scale, placement],
  )

  return (
    <>
      {body}
      {open ? (
        <div
          className={cn(
            'bevel-nugget-stage',
            placement !== 'thread' && `bevel-nugget-stage--${placement}`,
          )}
          role="dialog"
          aria-modal="true"
        >
          <div className="bevel-nugget-stage-bar">
            <p>
              {shown.source} · {shown.scale} · {placement}
            </p>
            <div>
              <button type="button" onClick={print}>
                Export PDF
              </button>
              <button type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>
          </div>
          <div
            id={`nugget-print-${nugget.title}`}
            className="bevel-nugget-stage-body"
          >
            {body}
            {nugget.sections?.map((section) => (
              <section key={section.title} className="bevel-nugget-section">
                <h4>{section.title}</h4>
                <p>{section.body}</p>
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </>
  )
}
