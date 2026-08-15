'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { HAIL_AGENTS, hailProgress } from './hail-lock'

export type FleetHailVariant = 'crash' | 'fatal' | 'missing'

type Props = {
  variant: FleetHailVariant
  error?: Error & { digest?: string }
  onReset?: () => void
  homeHref: string
  homeLabel: string
}

const COPY: Record<
  FleetHailVariant,
  { channel: string; title: string; body: string; reset: string }
> = {
  crash: {
    channel: '~deadair',
    title: 'This channel lost lock',
    body: 'The room is still on the server. Hail three agents to re-acquire, or walk back in.',
    reset: 'Rejoin the room',
  },
  fatal: {
    channel: '~deadair',
    title: 'The whole fleet dropped carrier',
    body: 'A client throw took the shell with it. Hail three agents, or clear the session and start clean.',
    reset: 'Rebuild the shell',
  },
  missing: {
    channel: '~nowhere',
    title: 'No channel was cut here',
    body: 'That path is empty water. Hail three agents and we will take you home, or jump there now.',
    reset: 'Take me to Private',
  },
}

function CutMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      aria-hidden
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <path d="M2 14.5V3.5L7.5 9 2 14.5Z" fill="currentColor" opacity="0.35" />
      <path d="M2 3.5h14L9 10.5 2 3.5Z" fill="currentColor" />
      <path d="M16 3.5v11L9 10.5 16 14.5V3.5Z" fill="currentColor" opacity="0.55" />
    </svg>
  )
}

export function FleetHailScreen({
  variant,
  error,
  onReset,
  homeHref,
  homeLabel,
}: Props) {
  const copy = COPY[variant]
  const [hailed, setHailed] = useState<string[]>([])
  const [ping, setPing] = useState(0)
  const [copied, setCopied] = useState(false)
  const [boxOpen, setBoxOpen] = useState(Boolean(error?.digest))
  const [reduceMotion, setReduceMotion] = useState(false)
  const progress = useMemo(() => hailProgress(hailed), [hailed])

  useEffect(() => {
    if (error) console.error(`BEVEL ${variant}`, error)
  }, [error, variant])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduceMotion(mq.matches)
    const onChange = () => setReduceMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  function hail(id: string) {
    setPing((n) => n + 1)
    setHailed((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }

  function goReset() {
    if (onReset) onReset()
    else window.location.assign(homeHref)
  }

  const recorder = [
    `channel ${copy.channel}`,
    `variant ${variant}`,
    error?.name ? `name ${error.name}` : null,
    error?.message ? `throw ${error.message}` : 'throw (no message)',
    error?.digest ? `digest ${error.digest}` : 'digest none',
    `hailed ${progress.unique.join(',') || 'none'}`,
    `href ${typeof window !== 'undefined' ? window.location.href : ''}`,
  ]
    .filter(Boolean)
    .join('\n')

  async function copyBox() {
    try {
      await navigator.clipboard.writeText(recorder)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="bevel-hail" data-locked={progress.locked ? 'true' : 'false'}>
      <style>{HAIL_CSS}</style>
      <header className="bevel-hail-top">
        <p className="bevel-hail-channel">{copy.channel}</p>
        <p className="bevel-hail-brand">
          <CutMark className="bevel-hail-cut" />
          BEVEL
        </p>
      </header>

      <div className="bevel-hail-stage">
        <div className="bevel-hail-scope" aria-hidden={reduceMotion}>
          <span className="bevel-hail-ring" data-n="1" />
          <span className="bevel-hail-ring" data-n="2" />
          <span className="bevel-hail-ring" data-n="3" />
          <span className="bevel-hail-sweep" />
          <span key={ping} className="bevel-hail-ping" data-fire={ping > 0 ? 'true' : 'false'} />
          {HAIL_AGENTS.map((agent) => (
            <button
              key={agent.id}
              type="button"
              className="bevel-hail-pip"
              data-hailed={progress.unique.includes(agent.id) ? 'true' : 'false'}
              style={
                {
                  '--r': `${agent.radius}%`,
                  '--dur': reduceMotion ? '0s' : `${agent.duration}s`,
                  '--start': String(agent.angle),
                } as CSSProperties
              }
              onClick={() => hail(agent.id)}
              aria-pressed={progress.unique.includes(agent.id)}
              aria-label={`Hail ${agent.name}`}
            >
              <span className="bevel-hail-pip-inner">
                <span className="bevel-hail-pip-dot" />
                <span className="bevel-hail-pip-name">{agent.name}</span>
              </span>
            </button>
          ))}
          <span className="bevel-hail-core">
            <CutMark />
          </span>
        </div>
        <p className="bevel-hail-meter" aria-live="polite">
          {progress.locked
            ? 'Lock acquired'
            : `Hail ${progress.remaining} more · ${progress.count}/${progress.need}`}
        </p>
      </div>

      <div className="bevel-hail-copy">
        <h1>{copy.title}</h1>
        <p>{copy.body}</p>
      </div>

      <div className="bevel-hail-actions">
        <button
          type="button"
          className="bevel-hail-btn"
          data-primary="true"
          data-ready={progress.locked ? 'true' : 'false'}
          onClick={goReset}
        >
          {progress.locked ? copy.reset : `${copy.reset} anyway`}
        </button>
        <a className="bevel-hail-btn" href={homeHref}>
          {homeLabel}
        </a>
      </div>

      {error ? (
        <section className="bevel-hail-box" data-open={boxOpen ? 'true' : 'false'}>
          <button
            type="button"
            className="bevel-hail-box-toggle"
            onClick={() => setBoxOpen((v) => !v)}
            aria-expanded={boxOpen}
          >
            <span>Black box</span>
            <span className="bevel-hail-box-hint">
              for developers · people can ignore this
            </span>
          </button>
          {boxOpen ? (
            <div className="bevel-hail-box-body">
              <pre>{recorder}</pre>
              <button type="button" className="bevel-hail-btn" onClick={() => void copyBox()}>
                {copied ? 'Copied flight recorder' : 'Copy flight recorder'}
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

const HAIL_CSS = `
.bevel-hail {
  --void: #081018;
  --grid: #143044;
  --fog: #8ba3b5;
  --hail: #ff8c42;
  --tape: #d5e1ea;
  --box: #0c161c;
  box-sizing: border-box;
  min-height: 100svh;
  padding: 1.25rem 1.25rem 2rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  background:
    radial-gradient(120% 80% at 50% -10%, #12283a 0%, var(--void) 55%);
  color: var(--tape);
  font-family: "IBM Plex Sans", "Avenir Next Condensed", ui-sans-serif, system-ui, sans-serif;
}
.bevel-hail *, .bevel-hail *::before, .bevel-hail *::after { box-sizing: border-box; }
.bevel-hail-top {
  width: min(36rem, 100%);
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--fog);
}
.bevel-hail-brand { display: inline-flex; align-items: center; gap: 0.35rem; color: var(--tape); }
.bevel-hail-cut { width: 0.85rem; height: 0.85rem; color: var(--hail); }
.bevel-hail-stage { display: flex; flex-direction: column; align-items: center; gap: 0.65rem; }
.bevel-hail-scope {
  position: relative;
  width: min(18rem, 78vw);
  height: min(18rem, 78vw);
  border-radius: 50%;
  background:
    repeating-radial-gradient(circle at 50% 50%, transparent 0 18px, color-mix(in srgb, var(--grid) 55%, transparent) 18px 19px);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--hail) 28%, transparent),
    inset 0 0 48px #000a,
    0 0 0 1px #000;
  overflow: hidden;
}
.bevel-hail-ring {
  position: absolute; inset: 18%;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--grid) 80%, transparent);
}
.bevel-hail-ring[data-n="2"] { inset: 30%; }
.bevel-hail-ring[data-n="3"] { inset: 42%; }
.bevel-hail-sweep {
  position: absolute; inset: 0;
  background: conic-gradient(from 200deg, transparent 0 78%, color-mix(in srgb, var(--hail) 22%, transparent) 88%, transparent 100%);
  animation: bevel-hail-spin 7.5s linear infinite;
  pointer-events: none;
}
.bevel-hail-ping {
  position: absolute; inset: 8%;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--hail) 0%, transparent);
  pointer-events: none;
}
.bevel-hail-ping[data-fire="true"] {
  animation: bevel-hail-ripple 0.7s ease-out 1;
}
.bevel-hail-core {
  position: absolute; left: 50%; top: 50%;
  width: 2.1rem; height: 2.1rem;
  transform: translate(-50%, -50%);
  display: grid; place-items: center;
  color: var(--hail);
  background: color-mix(in srgb, var(--void) 70%, #000);
  border-radius: 50%;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--hail) 45%, transparent);
}
.bevel-hail-core svg { width: 1.05rem; height: 1.05rem; }
.bevel-hail-pip {
  position: absolute;
  left: 50%; top: 50%;
  width: 0; height: 0;
  padding: 0; border: 0; background: none;
  color: inherit;
  transform-origin: 0 0;
  animation: bevel-hail-orbit var(--dur, 14s) linear infinite;
  animation-delay: calc(var(--start) / -360 * var(--dur));
}
.bevel-hail-pip-inner {
  position: absolute;
  left: var(--r);
  top: 0;
  width: 4.4rem;
  height: 2.1rem;
  margin: -0.55rem 0 0 -0.4rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.15rem;
  animation: bevel-hail-counter var(--dur, 14s) linear infinite;
  animation-delay: calc(var(--start) / -360 * var(--dur));
}
.bevel-hail-pip-dot {
  width: 0.55rem; height: 0.55rem;
  border-radius: 50%;
  background: var(--fog);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--void) 70%, transparent);
}
.bevel-hail-pip-name {
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--fog);
  white-space: nowrap;
}
.bevel-hail-pip[data-hailed="true"] .bevel-hail-pip-dot {
  background: var(--hail);
  box-shadow: 0 0 10px var(--hail);
}
.bevel-hail-pip[data-hailed="true"] .bevel-hail-pip-name { color: var(--hail); }
.bevel-hail-pip:focus-visible { outline: none; }
.bevel-hail-pip:focus-visible .bevel-hail-pip-dot {
  box-shadow: 0 0 0 3px var(--hail);
}
.bevel-hail-meter {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--hail);
}
.bevel-hail[data-locked="true"] .bevel-hail-meter { color: var(--tape); }
.bevel-hail-copy { width: min(28rem, 100%); text-align: center; }
.bevel-hail-copy h1 {
  margin: 0 0 0.45rem;
  font-size: clamp(1.45rem, 4vw, 1.9rem);
  font-weight: 650;
  letter-spacing: -0.03em;
  color: var(--tape);
}
.bevel-hail-copy p {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--fog);
}
.bevel-hail-actions {
  display: flex; flex-wrap: wrap; gap: 0.6rem; justify-content: center;
}
.bevel-hail-btn {
  appearance: none;
  display: inline-flex; align-items: center; justify-content: center;
  min-height: 2.5rem;
  padding: 0 0.95rem;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--tape) 18%, transparent);
  background: transparent;
  color: var(--tape);
  text-decoration: none;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 650;
  cursor: pointer;
}
.bevel-hail-btn[data-primary="true"] {
  border-color: color-mix(in srgb, var(--hail) 40%, transparent);
  color: var(--hail);
}
.bevel-hail-btn[data-primary="true"][data-ready="true"] {
  background: var(--hail);
  color: #1c1008;
  border-color: var(--hail);
}
.bevel-hail-box {
  width: min(36rem, 100%);
  border-top: 1px dashed color-mix(in srgb, var(--fog) 28%, transparent);
  padding-top: 0.75rem;
}
.bevel-hail-box-toggle {
  width: 100%;
  display: flex; justify-content: space-between; gap: 1rem; align-items: baseline;
  padding: 0; border: 0; background: none; color: var(--fog);
  font: inherit; font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase;
  font-weight: 700; cursor: pointer; text-align: left;
}
.bevel-hail-box-hint { letter-spacing: 0.06em; font-weight: 500; text-transform: none; opacity: 0.8; }
.bevel-hail-box-body pre {
  margin: 0.75rem 0;
  padding: 0.85rem 0.9rem;
  background: var(--box);
  border: 1px solid color-mix(in srgb, var(--fog) 16%, transparent);
  border-radius: 0.4rem;
  color: #cfe0ea;
  font-family: "IBM Plex Mono", "JetBrains Mono", ui-monospace, monospace;
  font-size: 0.72rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}
@keyframes bevel-hail-spin { to { transform: rotate(360deg); } }
@keyframes bevel-hail-orbit { to { transform: rotate(360deg); } }
@keyframes bevel-hail-counter { to { transform: rotate(-360deg); } }
@keyframes bevel-hail-ripple {
  from { transform: scale(0.4); border-color: var(--hail); opacity: 0.9; }
  to { transform: scale(1.05); border-color: transparent; opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .bevel-hail-sweep, .bevel-hail-pip, .bevel-hail-pip-inner, .bevel-hail-ping { animation: none; }
  .bevel-hail-pip { transform: rotate(calc(var(--start) * 1deg)); }
}
`
