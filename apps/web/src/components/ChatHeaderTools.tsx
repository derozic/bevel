'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckIcon, Cog6ToothIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import type { DaypartPreference } from '@bevel/schema'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@bevel/ui'
import { usePreferencesOptional } from '@/components/preferences/PreferencesProvider'
import {
  DAYPART_META,
  DAYPART_ORDER,
  resolveDaypart,
} from '@/lib/daypart'
import { rewriteLocalWorkspaceHref } from '@/lib/local-workspace-href'

type WorkspaceSpace = {
  slug: string
  label: string
  href: string
  current: boolean
  kind: 'private' | 'workspace'
}

/**
 * Compact chrome left of the account avatar: settings, spaces, day part.
 */
export function ChatHeaderTools() {
  const prefs = usePreferencesOptional()
  const [product, setProduct] = useState('Workspace')
  const [spaces, setSpaces] = useState<WorkspaceSpace[]>([])

  useEffect(() => {
    const el = document.documentElement
    const read = () => {
      const name = (
        el.getAttribute('data-tenant-product') ||
        el.getAttribute('data-tenant-theme') ||
        ''
      )
        .replace(/\s+Agents$/i, '')
        .trim()
      if (name && name !== 'default') setProduct(name)
    }
    read()
    const mo = new MutationObserver(read)
    mo.observe(el, {
      attributes: true,
      attributeFilter: ['data-tenant-product', 'data-tenant-theme'],
    })
    return () => mo.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    void fetch('/api/workspaces', { credentials: 'include' })
      .then(async (res) => {
        if (!res.ok) return
        const data = (await res.json()) as { spaces?: WorkspaceSpace[] }
        if (!cancelled && Array.isArray(data.spaces)) setSpaces(data.spaces)
      })
      .catch(() => {
        /* keep fallback label */
      })
    return () => {
      cancelled = true
    }
  }, [])

  const preference = prefs?.prefs.appearance.daypart ?? 'auto'
  const resolved = resolveDaypart(preference)
  const currentLabel = DAYPART_META[resolved].shortLabel
  const currentSpace = spaces.find((s) => s.current)
  const pillLabel = currentSpace?.label || product

  function openSpace(href: string) {
    const next = rewriteLocalWorkspaceHref(href)
    window.location.assign(next)
  }

  return (
    <div className="bevel-chat-tools" role="group" aria-label="Workspace">
      <button
        type="button"
        className="bevel-chat-tools-icon"
        title="Settings"
        aria-label="Settings"
        onClick={() => prefs?.openSection('ai')}
      >
        <Cog6ToothIcon className="h-4 w-4" aria-hidden />
      </button>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="bevel-chat-tools-property"
            title={`Switch space · ${pillLabel}`}
            aria-label="Switch Bevel space"
            aria-haspopup="menu"
          >
            <span className="bevel-chat-tools-property-label">{pillLabel}</span>
            <ChevronDownIcon className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="z-[400] min-w-[12.5rem]"
          style={{ zIndex: 400 }}
        >
          <DropdownMenuLabel>Spaces</DropdownMenuLabel>
          {spaces.map((space) => (
            <DropdownMenuItem
              key={space.slug}
              onSelect={() => {
                if (!space.current) openSpace(space.href)
              }}
            >
              <span className="min-w-0 flex-1 truncate">{space.label}</span>
              {space.current ? (
                <CheckIcon className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
              ) : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/workspaces">All spaces</Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="bevel-chat-tools-daypart"
            title={
              preference === 'auto'
                ? `Day part · Auto (${DAYPART_META[resolved].label})`
                : `Day part · ${DAYPART_META[resolved].label}`
            }
            aria-label="Day part"
          >
            <span>{currentLabel}</span>
            <ChevronDownIcon className="h-3 w-3 opacity-70" aria-hidden />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="z-[400] min-w-[11rem]"
          style={{ zIndex: 400 }}
        >
          <DropdownMenuLabel>Day part</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={preference}
            onValueChange={(v) =>
              prefs?.updatePrefs({
                appearance: { daypart: v as DaypartPreference },
              })
            }
          >
            <DropdownMenuRadioItem value="auto">
              Auto
              <span className="ml-auto text-[10px] text-muted">{currentLabel}</span>
            </DropdownMenuRadioItem>
            {DAYPART_ORDER.map((id) => (
              <DropdownMenuRadioItem key={id} value={id}>
                {DAYPART_META[id].label}
                <span className="ml-auto text-[10px] text-muted">
                  {DAYPART_META[id].shortLabel}
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
