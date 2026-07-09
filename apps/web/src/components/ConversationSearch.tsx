'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { cn } from '@/lib/utils'
import type { SearchHitDto } from '@/app/api/search/route'

function formatWhen(ts: number): string {
  if (!ts) return ''
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(ts))
  } catch {
    return ''
  }
}

function roomLabel(hit: SearchHitDto): string {
  if (hit.kind === 'channel') return `#${hit.channelSlug ?? hit.sessionId}`
  return hit.sessionId.startsWith('dm-') ? 'Direct' : `Session ${hit.sessionId.slice(0, 8)}…`
}

/**
 * Cmd/Ctrl+K conversation search — bookmark-style jumps into the exact message.
 */
export function ConversationSearch({ className }: { className?: string }) {
  const router = useRouter()
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<SearchHitDto[]>([])
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    setQ('')
    setHits([])
    setError(null)
    setActive(0)
  }, [])

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setHits([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`, {
        credentials: 'include',
      })
      if (!res.ok) {
        setError('Search is unavailable right now')
        setHits([])
        return
      }
      const data = (await res.json()) as { hits?: SearchHitDto[] }
      setHits(data.hits ?? [])
      setActive(0)
    } catch {
      setError('Search failed')
      setHits([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void runSearch(q)
    }, 120)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [q, open, runSearch])

  const jump = useCallback(
    (hit: SearchHitDto) => {
      close()
      router.push(hit.href)
    },
    [close, router],
  )

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-1.5 text-left text-xs text-muted transition hover:border-accent/40 hover:text-foreground',
          className,
        )}
        aria-label="Search conversations"
      >
        <MagnifyingGlassIcon className="size-3.5 shrink-0" aria-hidden />
        <span className="flex-1 truncate">Search conversations…</span>
        <kbd className="rounded border border-border px-1 py-0.5 font-mono text-[10px] text-muted">
          ⌘K
        </kbd>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 px-4 pt-[12vh] backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby={inputId}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <MagnifyingGlassIcon className="size-4 text-muted" aria-hidden />
          <input
            ref={inputRef}
            id={inputId}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((i) => Math.min(i + 1, Math.max(0, hits.length - 1)))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((i) => Math.max(i - 1, 0))
              } else if (e.key === 'Enter' && hits[active]) {
                e.preventDefault()
                jump(hits[active]!)
              } else if (e.key === 'Escape') {
                e.preventDefault()
                close()
              }
            }}
            placeholder="Jump to a message…"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
            autoComplete="off"
            spellCheck={false}
          />
          {loading ? (
            <span className="text-[10px] uppercase tracking-wide text-muted">Searching</span>
          ) : null}
          <button
            type="button"
            onClick={close}
            className="rounded p-1 text-muted hover:bg-white/5 hover:text-foreground"
            aria-label="Close search"
          >
            <XMarkIcon className="size-4" />
          </button>
        </div>

        <div className="max-h-[min(50vh,22rem)] overflow-y-auto py-1">
          {error ? (
            <p className="px-4 py-6 text-center text-sm text-muted">{error}</p>
          ) : null}
          {!error && q.trim() && !loading && hits.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              No messages match “{q.trim()}”
            </p>
          ) : null}
          {!q.trim() && !error ? (
            <p className="px-4 py-6 text-center text-sm text-muted">
              Type to search — results open the exact place in chat
            </p>
          ) : null}
          <ul role="listbox" aria-label="Search results">
            {hits.map((hit, i) => (
              <li key={hit.key ?? `${hit.sessionId}:${hit.messageId}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={cn(
                    'flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition',
                    i === active ? 'bg-accent/15' : 'hover:bg-white/5',
                  )}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => jump(hit)}
                >
                  <div className="flex items-center gap-2 text-[11px] text-muted">
                    <span className="font-medium text-accent">{roomLabel(hit)}</span>
                    <span className="truncate">{hit.speaker}</span>
                    <span className="ml-auto shrink-0">{formatWhen(hit.ts)}</span>
                  </div>
                  <p className="line-clamp-2 text-sm text-foreground">{hit.snippet}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
