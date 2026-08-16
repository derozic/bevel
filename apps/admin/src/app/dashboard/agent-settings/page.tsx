'use client'

import { useCallback, useEffect, useState } from 'react'

type Principles = {
  thinkBeforeActing: boolean
  simplicityFirst: boolean
  surgicalChanges: boolean
  goalDrivenExecution: boolean
}

type Effective = {
  enabled: boolean
  principles: Principles
  customMarkdown: string | null
  notes?: string
  source: string
  updatedAt?: string
  updatedBy?: string
}

type Payload = {
  effective: Effective
  builtinMarkdown: string
  overridePath: string
  agentsRepoRoot: string
  hasOverride: boolean
  principleLabels: Record<string, string>
  docs: { upstream: string; local: string }
}

const PRINCIPLE_ORDER: (keyof Principles)[] = [
  'thinkBeforeActing',
  'simplicityFirst',
  'surgicalChanges',
  'goalDrivenExecution',
]

const API = '/api/agent-settings/global'

export default function AgentSettingsPage() {
  const [data, setData] = useState<Payload | null>(null)
  const [enabled, setEnabled] = useState(true)
  const [principles, setPrinciples] = useState<Principles>({
    thinkBeforeActing: true,
    simplicityFirst: true,
    surgicalChanges: true,
    goalDrivenExecution: true,
  })
  const [customMarkdown, setCustomMarkdown] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(API, { cache: 'no-store' })
      const json = (await res.json()) as Payload & { detail?: string }
      if (!res.ok) {
        throw new Error(json.detail || `HTTP ${res.status}`)
      }
      setData(json)
      setEnabled(json.effective.enabled !== false)
      setPrinciples({
        thinkBeforeActing: json.effective.principles?.thinkBeforeActing !== false,
        simplicityFirst: json.effective.principles?.simplicityFirst !== false,
        surgicalChanges: json.effective.principles?.surgicalChanges !== false,
        goalDrivenExecution:
          json.effective.principles?.goalDrivenExecution !== false,
      })
      const cm = json.effective.customMarkdown
      setUseCustom(Boolean(cm && cm.trim()))
      setCustomMarkdown(cm?.trim() || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    setSaving(true)
    setStatus(null)
    setError(null)
    try {
      const res = await fetch(API, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          principles,
          customMarkdown: useCustom ? customMarkdown : null,
          clearCustomMarkdown: !useCustom,
          updatedBy: 'bevel-admin',
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || `HTTP ${res.status}`)
      setStatus('Saved. Restart realtime (or wait for cache clear) so runners reload.')
      setData(json as Payload)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  async function resetToDefaults() {
    if (!confirm('Remove Bevel override and use agents-repo defaults?')) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(API, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.detail || `HTTP ${res.status}`)
      setStatus('Override cleared — fleet defaults restored.')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading && !data) {
    return (
      <div className="text-sm text-[var(--bevel-text-muted)]">Loading…</div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Global agent settings</h1>
        <p className="mt-1 text-sm text-[var(--bevel-text-muted)]">
          Fleet-wide guidelines injected into every agent system prompt. Defaults
          ship from{' '}
          <code className="font-mono text-xs">agents/src/global/</code> (Karpathy-inspired).
          Overrides here apply to BEVEL deployments and any runtime with{' '}
          <code className="font-mono text-xs">AGENTS_GLOBAL_SETTINGS_PATH</code>.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}
      {status && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {status}
        </div>
      )}

      <section className="space-y-4 rounded-xl border border-[var(--bevel-border)] bg-[var(--bevel-surface)] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--bevel-text-muted)]">
              Master switch
            </h2>
            <p className="mt-1 text-sm text-[var(--bevel-text-muted)]">
              When off, no global guidelines are injected (agent SOUL/SKILL still apply).
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4"
            />
            Enabled
          </label>
        </div>

        <div className="space-y-3 border-t border-[var(--bevel-border)] pt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--bevel-text-muted)]">
            Principles
          </h2>
          {PRINCIPLE_ORDER.map((key) => (
            <label
              key={key}
              className="flex items-start gap-3 rounded-lg border border-[var(--bevel-border)] px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={principles[key]}
                disabled={!enabled}
                onChange={(e) =>
                  setPrinciples((p) => ({ ...p, [key]: e.target.checked }))
                }
              />
              <span>
                <span className="font-medium text-[var(--bevel-text)]">
                  {data?.principleLabels?.[key] ?? key}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--bevel-text-muted)]">
                  {key}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div className="space-y-2 border-t border-[var(--bevel-border)] pt-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              disabled={!enabled}
              className="h-4 w-4"
            />
            Override markdown body (advanced)
          </label>
          {useCustom && (
            <textarea
              value={customMarkdown}
              onChange={(e) => setCustomMarkdown(e.target.value)}
              rows={14}
              className="w-full rounded-lg border border-[var(--bevel-border)] bg-black/20 px-3 py-2 font-mono text-xs text-[var(--bevel-text)]"
              placeholder="Paste custom GLOBAL_SETTINGS.md…"
            />
          )}
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-[var(--bevel-text)] hover:bg-white/15 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save override'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void resetToDefaults()}
            className="rounded-lg border border-[var(--bevel-border)] px-4 py-2 text-sm text-[var(--bevel-text-muted)] hover:bg-white/5"
          >
            Reset to agents defaults
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void load()}
            className="rounded-lg border border-[var(--bevel-border)] px-4 py-2 text-sm text-[var(--bevel-text-muted)] hover:bg-white/5"
          >
            Reload
          </button>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--bevel-border)] bg-[var(--bevel-surface)] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--bevel-text-muted)]">
          Effective source
        </h2>
        <dl className="space-y-2 text-sm text-[var(--bevel-text-muted)]">
          <div>
            <dt className="font-medium text-[var(--bevel-text)]">Source</dt>
            <dd className="font-mono text-xs">{data?.effective.source}</dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--bevel-text)]">Override file</dt>
            <dd className="font-mono text-xs break-all">{data?.overridePath}</dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--bevel-text)]">Agents repo</dt>
            <dd className="font-mono text-xs break-all">{data?.agentsRepoRoot}</dd>
          </div>
          <div>
            <dt className="font-medium text-[var(--bevel-text)]">Has override</dt>
            <dd>{data?.hasOverride ? 'yes' : 'no'}</dd>
          </div>
        </dl>
        <div className="flex flex-wrap gap-3 text-sm">
          {data?.docs?.upstream && (
            <a
              href={data.docs.upstream}
              target="_blank"
              rel="noreferrer"
              className="text-[var(--bevel-text)] underline-offset-2 hover:underline"
            >
              Karpathy skills upstream
            </a>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-[var(--bevel-border)] bg-[var(--bevel-surface)] p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--bevel-text-muted)]">
          Built-in markdown (read-only)
        </h2>
        <pre className="max-h-96 overflow-auto rounded-lg border border-[var(--bevel-border)] bg-black/30 p-4 font-mono text-xs leading-relaxed text-[var(--bevel-text-muted)] whitespace-pre-wrap">
          {data?.builtinMarkdown || '(agents GLOBAL_SETTINGS.md not found — set AGENTS_REPO_ROOT)'}
        </pre>
      </section>
    </div>
  )
}
