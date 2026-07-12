'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ANNOUNCEMENT_ICON_IDS,
  ANNOUNCEMENT_ICON_LABELS,
  ANNOUNCEMENT_STYLE_PRESETS,
  SOFT_SKY_ANNOUNCEMENT_STYLE,
  type Announcement,
  type AnnouncementCtaVariant,
  type AnnouncementStyle,
} from '@bevel/schema'
import { AnnouncementBar, AnnouncementIcon, Button, cn } from '@bevel/ui'
import {
  Megaphone,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react'

const API =
  process.env.NEXT_PUBLIC_BEVEL_API_URL?.replace(/\/$/, '') ||
  'https://api.bevel.lvh.me'

const APP_LINK_OPTIONS = [
  { value: '/download', label: 'Download Flutter app' },
  { value: '/settings?section=ai', label: 'Preferences · AI' },
  { value: '/settings?section=profile', label: 'Preferences · Profile' },
  { value: '/settings?section=security', label: 'Preferences · Security' },
  { value: '/settings?section=privacy', label: 'Preferences · Privacy' },
  { value: '/settings?section=integrations', label: 'Preferences · Integrations' },
  { value: '/settings?section=media', label: 'Preferences · Audio & video' },
  { value: '/bevel', label: 'Workspace home' },
  { value: '/welcome', label: 'Welcome' },
  { value: 'custom', label: 'Custom path or URL…' },
] as const

type Draft = {
  id?: string
  title: string
  body: string
  icon: string
  linkLabel: string
  linkHref: string
  linkKind: 'app' | 'external'
  ctaVariant: AnnouncementCtaVariant
  placement: 'top' | 'bottom'
  kind: 'static' | 'next_step'
  dismissible: boolean
  enabled: boolean
  priority: number
  audience: 'all' | 'authenticated' | 'operators'
  tenantSlugsText: string
  style: AnnouncementStyle
  startsAt: string
  endsAt: string
  presetKey: string
}

function emptyDraft(): Draft {
  return {
    title: '',
    body: "Stay connected to BEVEL, even when you're on the go",
    icon: 'device-phone-mobile',
    linkLabel: 'Get the Flutter app',
    linkHref: '/download',
    linkKind: 'app',
    ctaVariant: 'button',
    placement: 'top',
    kind: 'static',
    dismissible: true,
    enabled: true,
    priority: 20,
    audience: 'all',
    tenantSlugsText: '',
    style: structuredClone(SOFT_SKY_ANNOUNCEMENT_STYLE),
    startsAt: '',
    endsAt: '',
    presetKey: 'soft_sky',
  }
}

function fromAnnouncement(a: Announcement): Draft {
  const preset =
    Object.entries(ANNOUNCEMENT_STYLE_PRESETS).find(
      ([, p]) =>
        JSON.stringify(p.style.gradient) === JSON.stringify(a.style.gradient),
    )?.[0] ?? 'custom'
  return {
    id: a.id,
    title: a.title ?? '',
    body: a.body,
    icon: a.icon ?? '',
    linkLabel: a.linkLabel,
    linkHref: a.linkHref,
    linkKind: a.linkKind,
    ctaVariant: a.ctaVariant ?? 'link',
    placement: a.placement ?? 'top',
    kind: a.kind ?? 'static',
    dismissible: a.dismissible,
    enabled: a.enabled,
    priority: a.priority,
    audience: a.audience,
    tenantSlugsText: (a.tenantSlugs ?? []).join(', '),
    style: structuredClone(a.style),
    startsAt: a.startsAt ?? '',
    endsAt: a.endsAt ?? '',
    presetKey: preset,
  }
}

function linkSelectValue(href: string): string {
  const match = APP_LINK_OPTIONS.find((o) => o.value === href)
  return match ? href : 'custom'
}

export default function AnnouncementsAdminPage() {
  const [items, setItems] = useState<Announcement[]>([])
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [linkSelect, setLinkSelect] = useState('/download')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/api/v1/announcements`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error(`Failed to load (${res.status})`)
      const data = (await res.json()) as { announcements: Announcement[] }
      setItems(data.announcements ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const select = (a: Announcement) => {
    const d = fromAnnouncement(a)
    setDraft(d)
    setLinkSelect(linkSelectValue(d.linkHref))
    setStatus('')
    setError('')
  }

  const newOne = () => {
    setDraft(emptyDraft())
    setLinkSelect('/download')
    setStatus('')
    setError('')
  }

  const applyPreset = (key: string) => {
    const preset = ANNOUNCEMENT_STYLE_PRESETS[key]
    if (!preset) {
      setDraft((d) => ({ ...d, presetKey: 'custom' }))
      return
    }
    setDraft((d) => ({
      ...d,
      presetKey: key,
      style: structuredClone(preset.style),
    }))
  }

  const save = async () => {
    if (!draft.body.trim() || !draft.linkHref.trim()) {
      setError('Body and link are required.')
      return
    }
    setSaving(true)
    setError('')
    setStatus('')
    const payload = {
      title: draft.title,
      body: draft.body.trim(),
      icon: draft.icon,
      linkLabel: draft.linkLabel || 'Learn more',
      linkHref: draft.linkHref.trim(),
      linkKind: draft.linkKind,
      ctaVariant: draft.ctaVariant,
      placement: draft.placement,
      kind: draft.kind,
      dismissible: draft.dismissible,
      enabled: draft.enabled,
      priority: Number(draft.priority) || 0,
      audience: draft.audience,
      tenantSlugs: draft.tenantSlugsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      style: draft.style,
      startsAt: draft.startsAt || '',
      endsAt: draft.endsAt || '',
    }
    try {
      const res = await fetch(
        draft.id
          ? `${API}/api/v1/announcements/${draft.id}`
          : `${API}/api/v1/announcements`,
        {
          method: draft.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      if (!res.ok) {
        const detail = await res.text()
        throw new Error(detail || `Save failed (${res.status})`)
      }
      const saved = (await res.json()) as Announcement
      setStatus(draft.id ? 'Updated.' : 'Created.')
      await load()
      select(saved)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!draft.id) return
    if (!window.confirm('Delete this announcement?')) return
    setSaving(true)
    try {
      const res = await fetch(`${API}/api/v1/announcements/${draft.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Delete failed')
      setStatus('Deleted.')
      newOne()
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSaving(false)
    }
  }

  const toggleEnabled = async (a: Announcement) => {
    await fetch(`${API}/api/v1/announcements/${a.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !a.enabled }),
    })
    await load()
  }

  const stops = draft.style.gradient.stops
  const previewStyle = useMemo(() => draft.style, [draft.style])

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--bevel-border)] pb-5 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Megaphone className="h-7 w-7 text-[var(--bevel-accent)]" />
            Announcements
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--bevel-text-muted)]">
            Top-of-app bars with rich Display P3 gradients. Link into Preferences,
            workspace routes, or external URLs. Members can dismiss; dismissed ids
            stay local to their browser.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button type="button" size="sm" onClick={newOne}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New
          </Button>
        </div>
      </div>

      {/* Live preview */}
      <section className="overflow-hidden rounded-xl border border-[var(--bevel-border)]">
        <div className="border-b border-[var(--bevel-border)] bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--bevel-text-muted)]">
          Preview
        </div>
        <AnnouncementBar
          title={draft.title || undefined}
          body={draft.body || 'Announcement body goes here…'}
          icon={draft.icon || undefined}
          linkLabel={draft.linkLabel || 'Learn more'}
          linkHref={draft.linkHref || '#'}
          linkKind={draft.linkKind}
          ctaVariant={draft.ctaVariant}
          dismissible={draft.dismissible}
          style={previewStyle}
        />
      </section>

      <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* List */}
        <aside className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--bevel-text-muted)]">
            All bars
          </h2>
          {loading ? (
            <p className="text-sm text-[var(--bevel-text-muted)]">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-[var(--bevel-text-muted)]">None yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {items.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => select(a)}
                    className={cn(
                      'w-full rounded-lg border px-3 py-2.5 text-left text-sm transition',
                      draft.id === a.id
                        ? 'border-[var(--bevel-accent)] bg-[var(--bevel-accent)]/10'
                        : 'border-[var(--bevel-border)] bg-[var(--bevel-surface)] hover:border-white/20',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">
                        {a.title || a.body.slice(0, 40)}
                      </span>
                      <button
                        type="button"
                        className="shrink-0 text-[var(--bevel-text-muted)] hover:text-[var(--bevel-text)]"
                        title={a.enabled ? 'Disable' : 'Enable'}
                        onClick={(e) => {
                          e.stopPropagation()
                          void toggleEnabled(a)
                        }}
                      >
                        {a.enabled ? (
                          <Eye className="h-3.5 w-3.5" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--bevel-text-muted)]">
                      {a.placement ?? 'top'} · p{a.priority} · {a.linkHref}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Editor */}
        <form
          className="space-y-5 rounded-xl border border-[var(--bevel-border)] bg-[var(--bevel-surface)] p-5"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <h2 className="text-sm font-semibold">
            {draft.id ? 'Edit announcement' : 'Create announcement'}
          </h2>

          <label className="block space-y-1.5 text-sm">
            <span className="text-xs font-medium text-[var(--bevel-text-muted)]">
              Bold title prefix (optional)
            </span>
            <input
              className="w-full rounded-lg border border-[var(--bevel-border)] bg-[var(--bevel-bg)] px-3 py-2"
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Action may be required:"
            />
          </label>

          <label className="block space-y-1.5 text-sm">
            <span className="text-xs font-medium text-[var(--bevel-text-muted)]">
              Body
            </span>
            <textarea
              required
              className="min-h-[5rem] w-full rounded-lg border border-[var(--bevel-border)] bg-[var(--bevel-bg)] px-3 py-2"
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              placeholder="Stay connected to BEVEL, even when you're on the go"
            />
          </label>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-[var(--bevel-text-muted)]">
              Heroicon
            </legend>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, icon: '' }))}
                className={cn(
                  'rounded-lg border px-2.5 py-1.5 text-[11px] font-medium',
                  !draft.icon
                    ? 'border-[var(--bevel-accent)] bg-[var(--bevel-accent)]/15'
                    : 'border-[var(--bevel-border)] text-[var(--bevel-text-muted)]',
                )}
              >
                None
              </button>
              {ANNOUNCEMENT_ICON_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  title={ANNOUNCEMENT_ICON_LABELS[id] ?? id}
                  onClick={() => setDraft((d) => ({ ...d, icon: id }))}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[11px] font-medium transition',
                    draft.icon === id
                      ? 'border-[var(--bevel-accent)] bg-[var(--bevel-accent)]/15 text-[var(--bevel-text)]'
                      : 'border-[var(--bevel-border)] text-[var(--bevel-text-muted)] hover:text-[var(--bevel-text)]',
                  )}
                >
                  <AnnouncementIcon id={id} className="h-3.5 w-3.5" />
                  {ANNOUNCEMENT_ICON_LABELS[id] ?? id}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-[var(--bevel-text-muted)]">
              Placement
            </legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['top', 'Top of workspace'],
                  ['bottom', 'Bottom of workspace'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, placement: value }))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium',
                    draft.placement === value
                      ? 'border-[var(--bevel-accent)] bg-[var(--bevel-accent)]/15'
                      : 'border-[var(--bevel-border)] text-[var(--bevel-text-muted)]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-[var(--bevel-text-muted)]">
              Kind
            </legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['static', 'Static copy'],
                  ['next_step', 'Next step (profile / integrations)'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, kind: value }))}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium',
                    draft.kind === value
                      ? 'border-[var(--bevel-accent)] bg-[var(--bevel-accent)]/15'
                      : 'border-[var(--bevel-border)] text-[var(--bevel-text-muted)]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            {draft.kind === 'next_step' ? (
              <p className="text-[11px] text-[var(--bevel-text-muted)]">
                Client rewrites body/link from the member&apos;s next incomplete
                step: profile → socials → ClickUp/Attio → GitHub.
              </p>
            ) : null}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-xs font-medium text-[var(--bevel-text-muted)]">
              CTA style
            </legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ['button', 'Pill button (promo)'],
                  ['link', 'Inline “Learn more” link'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({ ...d, ctaVariant: value }))
                  }
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium',
                    draft.ctaVariant === value
                      ? 'border-[var(--bevel-accent)] bg-[var(--bevel-accent)]/15'
                      : 'border-[var(--bevel-border)] text-[var(--bevel-text-muted)]',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium text-[var(--bevel-text-muted)]">
                Link label
              </span>
              <input
                className="w-full rounded-lg border border-[var(--bevel-border)] bg-[var(--bevel-bg)] px-3 py-2"
                value={draft.linkLabel}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, linkLabel: e.target.value }))
                }
              />
            </label>
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium text-[var(--bevel-text-muted)]">
                In-app destination
              </span>
              <select
                className="w-full rounded-lg border border-[var(--bevel-border)] bg-[var(--bevel-bg)] px-3 py-2"
                value={linkSelect}
                onChange={(e) => {
                  const v = e.target.value
                  setLinkSelect(v)
                  if (v !== 'custom') {
                    setDraft((d) => ({
                      ...d,
                      linkHref: v,
                      linkKind: 'app',
                    }))
                  }
                }}
              >
                {APP_LINK_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {(linkSelect === 'custom' ||
            !APP_LINK_OPTIONS.some((o) => o.value === draft.linkHref)) && (
            <label className="block space-y-1.5 text-sm">
              <span className="text-xs font-medium text-[var(--bevel-text-muted)]">
                Custom path or URL
              </span>
              <input
                className="w-full rounded-lg border border-[var(--bevel-border)] bg-[var(--bevel-bg)] px-3 py-2 font-mono text-xs"
                value={draft.linkHref}
                onChange={(e) => {
                  const href = e.target.value
                  setDraft((d) => ({
                    ...d,
                    linkHref: href,
                    linkKind: /^https?:\/\//i.test(href) ? 'external' : 'app',
                  }))
                }}
                placeholder="/settings?section=privacy or https://…"
              />
            </label>
          )}

          <fieldset className="space-y-3">
            <legend className="text-xs font-medium text-[var(--bevel-text-muted)]">
              Style · Display P3 gradient
            </legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(ANNOUNCEMENT_STYLE_PRESETS).map(([key, p]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-xs font-medium transition',
                    draft.presetKey === key
                      ? 'border-[var(--bevel-accent)] bg-[var(--bevel-accent)]/15 text-[var(--bevel-text)]'
                      : 'border-[var(--bevel-border)] text-[var(--bevel-text-muted)] hover:text-[var(--bevel-text)]',
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <label className="block space-y-1 text-sm">
              <span className="text-xs text-[var(--bevel-text-muted)]">
                Gradient angle (deg)
              </span>
              <input
                type="number"
                min={0}
                max={360}
                className="w-28 rounded-lg border border-[var(--bevel-border)] bg-[var(--bevel-bg)] px-3 py-1.5"
                value={draft.style.gradient.angleDeg}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    presetKey: 'custom',
                    style: {
                      ...d.style,
                      gradient: {
                        ...d.style.gradient,
                        angleDeg: Number(e.target.value) || 0,
                      },
                    },
                  }))
                }
              />
            </label>
            <div className="space-y-2">
              {stops.map((stop, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[auto_1fr_1fr_4rem] items-center gap-2"
                >
                  <span
                    className="size-7 rounded-md border border-[var(--bevel-border)]"
                    style={{ background: stop.color }}
                    title="sRGB swatch"
                  />
                  <input
                    type="text"
                    className="rounded-lg border border-[var(--bevel-border)] bg-[var(--bevel-bg)] px-2 py-1.5 font-mono text-[11px]"
                    value={stop.color}
                    onChange={(e) => {
                      const color = e.target.value
                      setDraft((d) => {
                        const next = [...d.style.gradient.stops]
                        next[i] = { ...next[i]!, color }
                        return {
                          ...d,
                          presetKey: 'custom',
                          style: {
                            ...d.style,
                            gradient: { ...d.style.gradient, stops: next },
                          },
                        }
                      })
                    }}
                    placeholder="#f6c84a"
                  />
                  <input
                    type="text"
                    className="rounded-lg border border-[var(--bevel-border)] bg-[var(--bevel-bg)] px-2 py-1.5 font-mono text-[11px]"
                    value={stop.p3 ?? ''}
                    onChange={(e) => {
                      const p3 = e.target.value.trim()
                      setDraft((d) => {
                        const next = [...d.style.gradient.stops]
                        next[i] = {
                          ...next[i]!,
                          p3: p3 || undefined,
                        }
                        return {
                          ...d,
                          presetKey: 'custom',
                          style: {
                            ...d.style,
                            gradient: { ...d.style.gradient, stops: next },
                          },
                        }
                      })
                    }}
                    placeholder="P3 R G B (0–1)"
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="rounded-lg border border-[var(--bevel-border)] bg-[var(--bevel-bg)] px-2 py-1.5 font-mono text-[11px]"
                    value={stop.at ?? ''}
                    onChange={(e) => {
                      const at = e.target.value === '' ? undefined : Number(e.target.value)
                      setDraft((d) => {
                        const next = [...d.style.gradient.stops]
                        next[i] = { ...next[i]!, at }
                        return {
                          ...d,
                          presetKey: 'custom',
                          style: {
                            ...d.style,
                            gradient: { ...d.style.gradient, stops: next },
                          },
                        }
                      })
                    }}
                    placeholder="%"
                  />
                </div>
              ))}
              <p className="text-[11px] text-[var(--bevel-text-muted)]">
                Columns: sRGB hex · display-p3 channels · stop %. P3 colors render on
                wide-gamut displays via{' '}
                <code className="font-mono">color(display-p3 …)</code>.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span className="text-xs text-[var(--bevel-text-muted)]">
                  Text color
                </span>
                <input
                  type="text"
                  className="w-full rounded-lg border border-[var(--bevel-border)] bg-[var(--bevel-bg)] px-3 py-1.5 font-mono text-xs"
                  value={draft.style.textColor}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      style: { ...d.style, textColor: e.target.value },
                    }))
                  }
                />
              </label>
              <label className="block space-y-1 text-sm">
                <span className="text-xs text-[var(--bevel-text-muted)]">
                  Link color
                </span>
                <input
                  type="text"
                  className="w-full rounded-lg border border-[var(--bevel-border)] bg-[var(--bevel-bg)] px-3 py-1.5 font-mono text-xs"
                  value={draft.style.linkColor ?? draft.style.textColor}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      style: { ...d.style, linkColor: e.target.value },
                    }))
                  }
                />
              </label>
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.enabled}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, enabled: e.target.checked }))
                }
              />
              Enabled
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.dismissible}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, dismissible: e.target.checked }))
                }
              />
              Dismissible
            </label>
            <label className="block space-y-1 text-sm">
              <span className="text-xs text-[var(--bevel-text-muted)]">Priority</span>
              <input
                type="number"
                className="w-full rounded-lg border border-[var(--bevel-border)] bg-[var(--bevel-bg)] px-3 py-1.5"
                value={draft.priority}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    priority: Number(e.target.value) || 0,
                  }))
                }
              />
            </label>
          </div>

          <label className="block space-y-1.5 text-sm">
            <span className="text-xs font-medium text-[var(--bevel-text-muted)]">
              Tenant scope (comma slugs; empty = all)
            </span>
            <input
              className="w-full rounded-lg border border-[var(--bevel-border)] bg-[var(--bevel-bg)] px-3 py-2 font-mono text-xs"
              value={draft.tenantSlugsText}
              onChange={(e) =>
                setDraft((d) => ({ ...d, tenantSlugsText: e.target.value }))
              }
              placeholder="demo, 2x4m"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--bevel-border)] pt-4">
            <Button type="submit" disabled={saving}>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Create'}
            </Button>
            {draft.id ? (
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => void remove()}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Delete
              </Button>
            ) : null}
            {status ? (
              <span className="text-xs text-emerald-400">{status}</span>
            ) : null}
            {error ? (
              <span className="text-xs text-red-400">{error}</span>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  )
}
