'use client'

import { cn } from '@bevel/ui'
import type { ReactNode } from 'react'

export function PrefSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  )
}

export function PrefGroup({
  title,
  description,
  children,
}: {
  title?: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      {title ? (
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-sm text-muted">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div className="space-y-2">{children}</div>
    </section>
  )
}

export function PrefToggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (next: boolean) => void
  disabled?: boolean
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-xl border border-border/80 bg-background/40 px-3 py-2.5 transition hover:border-border',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-4 rounded border-border accent-[var(--bevel-accent)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs leading-relaxed text-muted">
            {description}
          </span>
        ) : null}
      </span>
    </label>
  )
}

export function PrefRadio<T extends string>({
  name,
  value,
  options,
  onChange,
}: {
  name: string
  value: T
  options: { value: T; label: string; description?: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="space-y-2">
      {options.map((opt) => (
        <label
          key={opt.value}
          className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/80 bg-background/40 px-3 py-2.5 transition hover:border-border"
        >
          <input
            type="radio"
            name={name}
            className="mt-0.5 size-4 border-border accent-[var(--bevel-accent)]"
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              {opt.label}
            </span>
            {opt.description ? (
              <span className="mt-0.5 block text-xs text-muted">
                {opt.description}
              </span>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  )
}

export function PrefSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export function PrefChip({
  state,
  label,
}: {
  state: 'granted' | 'denied' | 'prompt' | 'unsupported'
  label: string
}) {
  const tone =
    state === 'granted'
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : state === 'denied'
        ? 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300'
        : state === 'unsupported'
          ? 'border-border bg-background text-muted'
          : 'border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200'
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        tone,
      )}
    >
      {label}
    </span>
  )
}
