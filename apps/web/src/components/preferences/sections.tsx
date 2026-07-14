'use client'

import { useEffect, useRef, useState } from 'react'
import { signIn, signOut, useSession } from 'next-auth/react'
import { XMarkIcon } from '@heroicons/react/24/outline'
import {
  AI_PROVIDER_IDS,
  AI_PROVIDER_META,
  CUSTOM_MODEL_PRESETS,
  OLLAMA_DEFAULT_BASE_URL,
  OLLAMA_MODEL_SUGGESTIONS,
  PROFILE_ATTRIBUTE_SUGGESTIONS,
  PROFILE_TAG_SUGGESTIONS,
  SOCIAL_META,
  SOCIAL_NETWORKS,
  validateHttpUrl,
  validateSocialUrl,
  type AiProviderId,
  type ProfileAttribute,
  type SocialNetworkId,
} from '@bevel/schema'
import { Button, cn } from '@bevel/ui'
import {
  PrefChip,
  PrefGroup,
  PrefRadio,
  PrefSection,
  PrefSelect,
  PrefToggle,
} from './form-controls'
import { HCardProfile } from './HCardProfile'
import { usePreferences } from './PreferencesProvider'
import {
  listMediaDevices,
  openMediaPreview,
  permissionLabel,
  playSpeakerTestTone,
  requestMediaPermission,
  requestNotificationPermission,
  stopMediaStream,
} from '@/lib/preferences/permissions'
import { BEVEL_NAME } from '@/lib/bevel'

const AI_KEY_PREFIX = 'bevel.ai.key.'
const INTEGRATION_KEY_PREFIX = 'bevel.integration.'

export function AiSection() {
  const { prefs, updatePrefs } = usePreferences()
  const [draftKey, setDraftKey] = useState('')
  const [reveal, setReveal] = useState(false)
  const [status, setStatus] = useState('')
  const [statusOk, setStatusOk] = useState<boolean | null>(null)
  const [testing, setTesting] = useState(false)
  const [ollamaModels, setOllamaModels] = useState<string[]>([])
  const [ollamaStatus, setOllamaStatus] = useState('')
  const [loadingModels, setLoadingModels] = useState(false)
  const active = prefs.ai.activeProvider
  const meta = AI_PROVIDER_META[active]
  const custom = prefs.ai.custom ?? {
    baseUrl: 'https://openrouter.ai/api/v1',
    modelId: 'z-ai/glm-5.2',
    label: 'GLM-5.2',
  }
  const ollama = prefs.ai.ollama ?? {
    baseUrl: OLLAMA_DEFAULT_BASE_URL,
    modelId: 'llama3.2:latest',
  }
  const providerState = prefs.ai.providers[active] ?? {
    enabled: false,
    configured: false,
    keyPreview: '',
  }
  const isOllama = active === 'ollama'
  const isLocalCustom =
    active === 'custom' &&
    /127\.0\.0\.1:11434|localhost:11434/i.test(custom.baseUrl || '')

  const selectProvider = (id: AiProviderId) => {
    updatePrefs({ ai: { activeProvider: id } })
    setDraftKey('')
    setStatus('')
    setStatusOk(null)
  }

  const markConfigured = (preview: string) => {
    updatePrefs({
      ai: {
        providers: {
          ...prefs.ai.providers,
          [active]: {
            enabled: true,
            configured: true,
            keyPreview: preview,
          },
        },
      },
    })
  }

  const saveKey = () => {
    if (isOllama) {
      // Local Ollama — no cloud key; mark ready with selected model
      markConfigured(`local · ${ollama.modelId}`)
      setStatusOk(true)
      setStatus(`Ollama ready with ${ollama.modelId}`)
      return
    }
    const key = draftKey.trim()
    if (!key) return
    if (active === 'custom') {
      const base = (custom.baseUrl || '').trim()
      const model = (custom.modelId || '').trim()
      if (!base || !model) {
        setStatus('Custom provider needs base URL and model id.')
        setStatusOk(false)
        return
      }
    }
    const preview =
      key.length > 10 ? `${key.slice(0, 4)}…${key.slice(-4)}` : '••••'
    markConfigured(preview)
    try {
      window.localStorage.setItem(`${AI_KEY_PREFIX}${active}`, key)
    } catch {
      /* ignore */
    }
    setDraftKey('')
    setStatusOk(true)
    setStatus(
      active === 'custom'
        ? `Custom key saved for ${custom.modelId} (local only).`
        : `${meta.shortName} key saved locally (not uploaded).`,
    )
  }

  const removeKey = () => {
    updatePrefs({
      ai: {
        providers: {
          ...prefs.ai.providers,
          [active]: {
            enabled: true,
            configured: false,
            keyPreview: '',
          },
        },
      },
    })
    try {
      window.localStorage.removeItem(`${AI_KEY_PREFIX}${active}`)
    } catch {
      /* ignore */
    }
    setStatusOk(null)
    setStatus(`${meta.shortName} key removed.`)
  }

  const refreshOllamaModels = async () => {
    setLoadingModels(true)
    setOllamaStatus('')
    try {
      const base = isOllama ? ollama.baseUrl : custom.baseUrl
      const res = await fetch(
        `/api/ai/ollama/models?baseUrl=${encodeURIComponent(base || OLLAMA_DEFAULT_BASE_URL)}`,
        { credentials: 'include' },
      )
      const data = (await res.json()) as {
        ok?: boolean
        models?: string[]
        error?: string
        hint?: string
      }
      if (!res.ok || !data.ok) {
        setOllamaModels([...OLLAMA_MODEL_SUGGESTIONS])
        setOllamaStatus(
          data.hint || data.error || 'Ollama unreachable — showing suggestions',
        )
        return
      }
      setOllamaModels(data.models || [])
      setOllamaStatus(
        `${(data.models || []).length} model${(data.models || []).length === 1 ? '' : 's'} on this Mac`,
      )
      // Auto-pick first model if current missing
      const current = isOllama ? ollama.modelId : custom.modelId
      if (data.models?.length && current && !data.models.includes(current)) {
        if (isOllama) {
          updatePrefs({
            ai: { ollama: { ...ollama, modelId: data.models[0]! } },
          })
        }
      }
    } catch {
      setOllamaModels([...OLLAMA_MODEL_SUGGESTIONS])
      setOllamaStatus('Could not reach Ollama — is the app running?')
    } finally {
      setLoadingModels(false)
    }
  }

  useEffect(() => {
    if (active === 'ollama' || isLocalCustom) {
      void refreshOllamaModels()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when switching to ollama
  }, [active, isLocalCustom])

  const testKey = async () => {
    setTesting(true)
    setStatus('')
    setStatusOk(null)
    try {
      const stored =
        typeof window !== 'undefined'
          ? window.localStorage.getItem(`${AI_KEY_PREFIX}${active}`)
          : null
      const apiKey = (draftKey.trim() || stored || (isOllama ? 'ollama' : '')).trim()
      if (!apiKey && !isOllama) {
        setStatus(`Add a ${meta.shortName} key first.`)
        setStatusOk(false)
        return
      }
      if (active === 'custom' && (!custom.baseUrl?.trim() || !custom.modelId?.trim())) {
        setStatus('Set custom base URL and model id before testing.')
        setStatusOk(false)
        return
      }
      if (isOllama && !ollama.modelId?.trim()) {
        setStatus('Pick an Ollama model first.')
        setStatusOk(false)
        return
      }

      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          provider: active,
          apiKey: apiKey || 'ollama',
          baseUrl:
            active === 'custom'
              ? custom.baseUrl
              : active === 'ollama'
                ? ollama.baseUrl
                : undefined,
          modelId:
            active === 'custom'
              ? custom.modelId
              : active === 'ollama'
                ? ollama.modelId
                : active === 'perplexity'
                  ? 'sonar'
                  : undefined,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        message?: string
        error?: string
        latencyMs?: number
        model?: string
        detail?: string
      }
      if (!res.ok || !data.ok) {
        setStatusOk(false)
        setStatus(
          data.message ||
            data.error ||
            `Test failed${data.detail ? `: ${data.detail}` : ''}`,
        )
        return
      }
      if (draftKey.trim()) {
        const preview =
          draftKey.trim().length > 10
            ? `${draftKey.trim().slice(0, 4)}…${draftKey.trim().slice(-4)}`
            : '••••'
        try {
          window.localStorage.setItem(`${AI_KEY_PREFIX}${active}`, draftKey.trim())
        } catch {
          /* ignore */
        }
        markConfigured(preview)
        setDraftKey('')
      } else if (isOllama) {
        markConfigured(`local · ${ollama.modelId}`)
      } else if (!providerState.configured) {
        markConfigured(providerState.keyPreview || '••••')
      }
      setStatusOk(true)
      setStatus(
        [
          data.message || 'Connection OK',
          data.model ? `model ${data.model}` : null,
          data.latencyMs != null ? `${data.latencyMs}ms` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      )
    } catch (err) {
      setStatusOk(false)
      setStatus(err instanceof Error ? err.message : 'Test failed')
    } finally {
      setTesting(false)
    }
  }

  return (
    <PrefSection
      title="AI"
      description="Claude, OpenAI, Gemini, Grok, Perplexity, Ollama on this Mac, and custom OpenAI-compatible endpoints (GLM-5.2, Kimi K2.7 Code, …)."
    >
      <PrefGroup title="Active provider">
        <div className="grid gap-2 sm:grid-cols-2">
          {AI_PROVIDER_IDS.map((id, index) => {
            const pMeta = AI_PROVIDER_META[id]
            const state = prefs.ai.providers[id] ?? {
              enabled: false,
              configured: false,
            }
            const selected = active === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => selectProvider(id)}
                className={`rounded-xl border px-3 py-3 text-left transition ${
                  selected
                    ? 'border-accent bg-accent/10 ring-1 ring-accent/40'
                    : 'border-border bg-background/40 hover:border-accent/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-mono text-muted">
                    {index + 1}. {id}
                  </span>
                  <PrefChip
                    state={state.configured ? 'granted' : 'prompt'}
                    label={
                      state.configured
                        ? 'Ready'
                        : id === 'ollama'
                          ? 'Local'
                          : 'Key'
                    }
                  />
                </div>
                <p className="mt-1.5 text-sm font-semibold text-foreground">
                  {pMeta.shortName}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {pMeta.description}
                </p>
              </button>
            )
          })}
        </div>
      </PrefGroup>

      {isOllama ? (
        <PrefGroup
          title="Ollama on this Mac"
          description="Uses the OpenAI-compatible API at 127.0.0.1:11434. No cloud key — keep Ollama running."
        >
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">Base URL</span>
            <input
              type="url"
              value={ollama.baseUrl}
              onChange={(e) =>
                updatePrefs({
                  ai: { ollama: { ...ollama, baseUrl: e.target.value } },
                })
              }
              placeholder={OLLAMA_DEFAULT_BASE_URL}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-accent"
              autoComplete="off"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loadingModels}
              onClick={() => void refreshOllamaModels()}
            >
              {loadingModels ? 'Scanning…' : 'Refresh models'}
            </Button>
            {ollamaStatus ? (
              <span className="text-xs text-muted">{ollamaStatus}</span>
            ) : null}
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">Model</span>
            {(ollamaModels.length > 0
              ? ollamaModels
              : [...OLLAMA_MODEL_SUGGESTIONS]
            ).length > 0 ? (
              <select
                value={ollama.modelId}
                onChange={(e) =>
                  updatePrefs({
                    ai: { ollama: { ...ollama, modelId: e.target.value } },
                  })
                }
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-accent"
              >
                {(ollamaModels.length > 0
                  ? ollamaModels
                  : [...OLLAMA_MODEL_SUGGESTIONS]
                ).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            ) : null}
            <input
              type="text"
              value={ollama.modelId}
              onChange={(e) =>
                updatePrefs({
                  ai: { ollama: { ...ollama, modelId: e.target.value } },
                })
              }
              placeholder="llama3.2:latest"
              className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-accent"
              autoComplete="off"
            />
          </label>
          <p className="text-[11px] text-muted">
            Pull more with{' '}
            <code className="font-mono">ollama pull gemma4</code> · list with{' '}
            <code className="font-mono">ollama list</code>
          </p>
        </PrefGroup>
      ) : null}

      {active === 'custom' ? (
        <PrefGroup
          title="Custom model endpoint"
          description="Any OpenAI-compatible base URL — OpenRouter, Ollama Mac, Z.ai, Moonshot."
        >
          <div className="flex flex-wrap gap-2">
            {CUSTOM_MODEL_PRESETS.map((preset) => {
              const selected =
                custom.modelId === preset.modelId &&
                custom.baseUrl === preset.baseUrl
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() =>
                    updatePrefs({
                      ai: {
                        custom: {
                          baseUrl: preset.baseUrl,
                          modelId: preset.modelId,
                          label: preset.label,
                        },
                      },
                    })
                  }
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    selected
                      ? 'border-accent bg-accent/15 text-foreground'
                      : 'border-border text-muted hover:border-accent/40 hover:text-foreground'
                  }`}
                  title={preset.hint}
                >
                  {preset.label}
                </button>
              )
            })}
          </div>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">Base URL</span>
            <input
              type="url"
              value={custom.baseUrl}
              onChange={(e) =>
                updatePrefs({
                  ai: {
                    custom: {
                      ...custom,
                      baseUrl: e.target.value,
                    },
                  },
                })
              }
              placeholder="https://openrouter.ai/api/v1 or http://127.0.0.1:11434/v1"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-accent"
              autoComplete="off"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs font-medium text-muted">Model id</span>
            <input
              type="text"
              value={custom.modelId}
              onChange={(e) =>
                updatePrefs({
                  ai: {
                    custom: {
                      ...custom,
                      modelId: e.target.value,
                      label: e.target.value,
                    },
                  },
                })
              }
              placeholder="z-ai/glm-5.2 · moonshotai/kimi-k2.7-code · llama3.2:latest"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-accent"
              autoComplete="off"
            />
          </label>
          {isLocalCustom ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loadingModels}
              onClick={() => void refreshOllamaModels()}
            >
              {loadingModels ? 'Scanning…' : 'Refresh Ollama models'}
            </Button>
          ) : null}
          <p className="text-[11px] text-muted">
            Local Ollama needs no key. Cloud presets need an OpenRouter (or
            provider) key below.
          </p>
        </PrefGroup>
      ) : null}

      <PrefGroup
        title={`Configure ${meta.name}`}
        description={
          isOllama
            ? 'No API key required for local Ollama. Test connection runs a tiny completion.'
            : 'Keys stay in this browser (localStorage). Test connection hits the real provider API.'
        }
      >
        <p className="text-xs text-muted">
          Hint:{' '}
          <code className="font-mono text-foreground/80">{meta.keyHint}</code>
          {active === 'custom' && custom.modelId ? (
            <>
              {' '}
              · model{' '}
              <code className="font-mono text-foreground/80">
                {custom.modelId}
              </code>
            </>
          ) : null}
          {isOllama ? (
            <>
              {' '}
              · model{' '}
              <code className="font-mono text-foreground/80">
                {ollama.modelId}
              </code>
            </>
          ) : null}
        </p>
        {!isOllama ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type={reveal ? 'text' : 'password'}
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder={
                isLocalCustom
                  ? 'Optional for local Ollama'
                  : providerState.keyPreview || 'Paste API key'
              }
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm outline-none focus:border-accent"
              autoComplete="off"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? 'Hide' : 'Show'}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={saveKey}
              disabled={!draftKey.trim() && !isLocalCustom}
            >
              Save key
            </Button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
          {providerState.configured ? (
            <span>
              {isOllama ? 'Ready' : 'Stored preview'}:{' '}
              <span className="font-mono text-foreground">
                {providerState.keyPreview}
              </span>
            </span>
          ) : isOllama ? (
            <span>Pick a model and Test connection.</span>
          ) : (
            <span>No key stored yet — paste and Save or Test.</span>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={
              testing ||
              (!isOllama &&
                !isLocalCustom &&
                !draftKey.trim() &&
                !providerState.configured)
            }
            onClick={() => void testKey()}
          >
            {testing ? 'Testing…' : 'Test connection'}
          </Button>
          {isOllama ? (
            <Button type="button" size="sm" onClick={saveKey}>
              Use this model
            </Button>
          ) : null}
          {providerState.configured && !isOllama ? (
            <button
              type="button"
              className="text-accent hover:underline"
              onClick={removeKey}
            >
              Remove
            </button>
          ) : null}
        </div>
        {status ? (
          <p
            className={`text-xs ${
              statusOk === true
                ? 'text-emerald-700 dark:text-emerald-400'
                : statusOk === false
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-muted'
            }`}
          >
            {status}
          </p>
        ) : null}
      </PrefGroup>

      <PrefGroup title="Behavior">
        <PrefToggle
          label="Stream summary results"
          description="Channel and search summaries appear as they generate."
          checked={prefs.ai.streamSummaries}
          onChange={(streamSummaries) =>
            updatePrefs({ ai: { streamSummaries } })
          }
        />
        <PrefToggle
          label="Natural language commands"
          description="Route free-text ops through the active provider when available (decli-style)."
          checked={prefs.ai.naturalLanguage}
          onChange={(naturalLanguage) =>
            updatePrefs({ ai: { naturalLanguage } })
          }
        />
      </PrefGroup>

      <PrefGroup title="Provider order">
        <ol className="space-y-1.5">
          {AI_PROVIDER_IDS.map((id, index) => (
            <li
              key={id}
              className="flex items-center justify-between rounded-lg border border-border/80 bg-background/40 px-3 py-2 text-xs"
            >
              <span className="text-muted">
                {index + 1}. {AI_PROVIDER_META[id].name}
              </span>
              <span className="font-mono text-muted">{id}</span>
            </li>
          ))}
        </ol>
      </PrefGroup>
    </PrefSection>
  )
}

function normalizeTag(raw: string): string {
  return raw
    .trim()
    .replace(/^#/, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
}

export function ProfileSection() {
  const { data: session } = useSession()
  const { prefs, updatePrefs } = usePreferences()
  const p = prefs.profile
  const user = session?.user
  const [tagDraft, setTagDraft] = useState('')
  const [attrDraft, setAttrDraft] = useState<ProfileAttribute>({
    key: '',
    value: '',
  })

  // Seed empty profile once from session
  useEffect(() => {
    if (p.displayName || p.handle) return
    const email = user?.email ?? ''
    const handle = email.split('@')[0] ?? ''
    updatePrefs({
      profile: {
        displayName: user?.name ?? handle,
        handle,
        photoUrl: user?.image ?? '',
        org: session?.tenantSlug ?? '',
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed once when session appears
  }, [user?.email])

  const setField = (
    key: keyof typeof p,
    value: string | boolean | string[] | ProfileAttribute[],
  ) => {
    updatePrefs({ profile: { [key]: value } as Partial<typeof p> })
  }

  const tags = p.tags ?? []
  const attributes = p.attributes ?? []

  const addTag = (raw: string) => {
    const tag = normalizeTag(raw)
    if (!tag || tags.includes(tag)) {
      setTagDraft('')
      return
    }
    setField('tags', [...tags, tag])
    setTagDraft('')
  }

  const removeTag = (tag: string) => {
    setField(
      'tags',
      tags.filter((t) => t !== tag),
    )
  }

  const addAttribute = () => {
    const key = attrDraft.key.trim()
    const value = attrDraft.value.trim()
    if (!key || !value) return
    // Replace existing key (case-insensitive) or append
    const next = attributes.filter(
      (a) => a.key.trim().toLowerCase() !== key.toLowerCase(),
    )
    next.push({ key, value })
    setField('attributes', next)
    setAttrDraft({ key: '', value: '' })
  }

  const removeAttribute = (key: string) => {
    setField(
      'attributes',
      attributes.filter((a) => a.key !== key),
    )
  }

  const updateAttribute = (index: number, patch: Partial<ProfileAttribute>) => {
    const next = attributes.map((a, i) =>
      i === index ? { ...a, ...patch } : a,
    )
    setField('attributes', next)
  }

  return (
    <PrefSection
      title="Profile"
      description="Identity for teammates and agents — h-card / schema.org Person plus capability tags and facts so fleet agents know how to work with you."
    >
      <HCardProfile
        displayName={p.displayName || user?.name || ''}
        givenName={p.givenName}
        familyName={p.familyName}
        nickname={p.nickname}
        handle={p.handle}
        bio={p.bio}
        description={p.description}
        pronouns={p.pronouns}
        timezone={p.timezone}
        url={p.url}
        email={user?.email}
        emailPublic={p.emailPublic}
        org={p.org}
        jobTitle={p.jobTitle}
        location={p.location}
        photoUrl={p.photoUrl || user?.image || undefined}
        tags={tags}
        attributes={attributes}
        socials={p.socials}
      />

      <PrefGroup title="Identity">
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">Display name (p-name)</span>
          <input
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
            value={p.displayName}
            onChange={(e) => setField('displayName', e.target.value)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">
              Given name (p-given-name)
            </span>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
              value={p.givenName ?? ''}
              onChange={(e) => setField('givenName', e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">
              Family name (p-family-name)
            </span>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
              value={p.familyName ?? ''}
              onChange={(e) => setField('familyName', e.target.value)}
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">
              Handle / nickname (p-nickname)
            </span>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
              value={p.handle}
              onChange={(e) =>
                setField('handle', e.target.value.replace(/^@/, ''))
              }
              placeholder="scott"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Pronouns</span>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
              value={p.pronouns ?? ''}
              onChange={(e) => setField('pronouns', e.target.value)}
              placeholder="they/them"
            />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">
            Short bio (p-note)
          </span>
          <textarea
            className="min-h-[4.5rem] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            value={p.bio}
            onChange={(e) => setField('bio', e.target.value)}
            maxLength={280}
            placeholder="One or two lines for your h-card and channel presence."
          />
          <span className="text-[11px] text-muted">{p.bio.length}/280</span>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">
              Job title (p-job-title)
            </span>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
              value={p.jobTitle ?? ''}
              onChange={(e) => setField('jobTitle', e.target.value)}
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">
              Organization (p-org)
            </span>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
              value={p.org ?? ''}
              onChange={(e) => setField('org', e.target.value)}
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">
              Location (p-locality)
            </span>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 outline-none focus:border-accent"
              value={p.location ?? ''}
              onChange={(e) => setField('location', e.target.value)}
              placeholder="Portland, OR"
            />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-foreground">Timezone</span>
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
              value={p.timezone ?? ''}
              onChange={(e) => setField('timezone', e.target.value)}
              placeholder="America/Los_Angeles"
              list="bevel-tz-suggestions"
            />
            <datalist id="bevel-tz-suggestions">
              <option value="America/Los_Angeles" />
              <option value="America/Denver" />
              <option value="America/Chicago" />
              <option value="America/New_York" />
              <option value="UTC" />
              <option value="Europe/London" />
            </datalist>
          </label>
        </div>
        <WebsiteUrlField
          value={p.url ?? ''}
          onCommit={(url) => setField('url', url)}
        />
        <PrefToggle
          label="Show email on public h-card"
          description="Exposes a mailto: link with rel patterns for contact."
          checked={p.emailPublic}
          onChange={(emailPublic) => setField('emailPublic', emailPublic)}
        />
      </PrefGroup>

      <PrefGroup
        title="For agents"
        description="Helps BEVEL agents understand your capabilities, domains, and how to work with you — used in routing and context, not required for the public card."
      >
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">
            Agent description
          </span>
          <textarea
            className="min-h-[6.5rem] w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            value={p.description ?? ''}
            onChange={(e) => setField('description', e.target.value)}
            maxLength={2000}
            placeholder="Strengths, domains you own, decision rights, how you like to be briefed, and anything agents should not assume."
          />
          <span className="text-[11px] text-muted">
            {(p.description ?? '').length}/2000 · plain text for agent context
          </span>
        </label>

        <div className="space-y-2">
          <span className="block text-sm font-medium text-foreground">
            Capability tags
          </span>
          <p className="text-xs text-muted">
            Skills, stacks, focus areas. Press Enter or comma to add.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => removeTag(tag)}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-background/60 px-2.5 py-1 text-xs font-medium text-foreground transition hover:border-red-400/50 hover:bg-red-500/10"
                title={`Remove ${tag}`}
              >
                {tag}
                <XMarkIcon className="size-3.5 opacity-70" aria-hidden />
              </button>
            ))}
          </div>
          <input
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault()
                addTag(tagDraft.replace(/,/g, ''))
              } else if (
                e.key === 'Backspace' &&
                !tagDraft &&
                tags.length > 0
              ) {
                removeTag(tags[tags.length - 1]!)
              }
            }}
            onBlur={() => {
              if (tagDraft.trim()) addTag(tagDraft)
            }}
            placeholder="e.g. typescript, product, on-call"
            list="bevel-tag-suggestions"
          />
          <datalist id="bevel-tag-suggestions">
            {PROFILE_TAG_SUGGESTIONS.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
          <div className="flex flex-wrap gap-1">
            {PROFILE_TAG_SUGGESTIONS.filter((t) => !tags.includes(t))
              .slice(0, 8)
              .map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => addTag(t)}
                  className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted transition hover:border-accent hover:text-accent"
                >
                  + {t}
                </button>
              ))}
          </div>
        </div>

        <div className="space-y-2">
          <span className="block text-sm font-medium text-foreground">
            Attributes (name-value)
          </span>
          <p className="text-xs text-muted">
            Structured facts agents can cite — languages, tools, on-call, domains owned.
          </p>
          {attributes.length > 0 ? (
            <ul className="space-y-2">
              {attributes.map((a, index) => (
                <li
                  key={`${a.key}-${index}`}
                  className="flex flex-col gap-2 rounded-xl border border-border/80 bg-background/40 p-2.5 sm:flex-row sm:items-center"
                >
                  <input
                    className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium outline-none focus:border-accent sm:w-36 sm:shrink-0"
                    value={a.key}
                    onChange={(e) =>
                      updateAttribute(index, { key: e.target.value })
                    }
                    placeholder="Key"
                    aria-label="Attribute name"
                  />
                  <input
                    className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent"
                    value={a.value}
                    onChange={(e) =>
                      updateAttribute(index, { value: e.target.value })
                    }
                    placeholder="Value"
                    aria-label="Attribute value"
                  />
                  <button
                    type="button"
                    onClick={() => removeAttribute(a.key)}
                    className="rounded-lg px-2 py-1.5 text-xs font-medium text-muted transition hover:bg-red-500/10 hover:text-red-600 sm:shrink-0"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-col gap-2 rounded-xl border border-dashed border-border p-2.5 sm:flex-row sm:items-center">
            <input
              className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium outline-none focus:border-accent sm:w-36 sm:shrink-0"
              value={attrDraft.key}
              onChange={(e) =>
                setAttrDraft((d) => ({ ...d, key: e.target.value }))
              }
              placeholder="Key"
              list="bevel-attr-key-suggestions"
              aria-label="New attribute name"
            />
            <datalist id="bevel-attr-key-suggestions">
              {PROFILE_ATTRIBUTE_SUGGESTIONS.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
            <input
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent"
              value={attrDraft.value}
              onChange={(e) =>
                setAttrDraft((d) => ({ ...d, value: e.target.value }))
              }
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addAttribute()
                }
              }}
              placeholder="Value"
              aria-label="New attribute value"
            />
            <Button
              type="button"
              variant="secondary"
              className="sm:shrink-0"
              onClick={addAttribute}
              disabled={!attrDraft.key.trim() || !attrDraft.value.trim()}
            >
              Add
            </Button>
          </div>
          <div className="flex flex-wrap gap-1">
            {PROFILE_ATTRIBUTE_SUGGESTIONS.filter(
              (k) =>
                !attributes.some(
                  (a) => a.key.trim().toLowerCase() === k.toLowerCase(),
                ),
            )
              .slice(0, 6)
              .map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setAttrDraft((d) => ({ ...d, key: k }))}
                  className="rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted transition hover:border-accent hover:text-accent"
                >
                  + {k}
                </button>
              ))}
          </div>
        </div>
      </PrefGroup>

      <PrefGroup
        title="Social (rel=me)"
        description="Use Update or ⌘S to save (also auto-saves). Bare @handles expand on blur; invalid URLs are flagged and omitted from your h-card."
      >
        {SOCIAL_NETWORKS.map((id) => (
          <SocialUrlField
            key={id}
            network={id}
            value={p.socials[id]}
            onCommit={(value) =>
              updatePrefs({
                profile: {
                  socials: { ...p.socials, [id]: value },
                },
              })
            }
          />
        ))}
      </PrefGroup>
    </PrefSection>
  )
}

function WebsiteUrlField({
  value,
  onCommit,
}: {
  value: string
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value)
  const validation = validateHttpUrl(draft, 'Website')

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-foreground">Website (u-url)</span>
      <input
        className={cn(
          'w-full rounded-lg border bg-surface px-3 py-2 outline-none focus:border-accent',
          validation.ok
            ? 'border-border'
            : 'border-danger/60 focus:border-danger',
        )}
        value={draft}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          onCommit(next)
        }}
        onBlur={() => {
          const result = validateHttpUrl(draft, 'Website')
          if (result.ok && result.value !== draft) {
            setDraft(result.value)
            onCommit(result.value)
          }
        }}
        placeholder="https://example.com"
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        aria-invalid={!validation.ok}
      />
      {!validation.ok && validation.error ? (
        <span className="block text-[11px] text-danger" role="status">
          {validation.error}
        </span>
      ) : null}
    </label>
  )
}

/** Social URL field with live validation + normalize-on-blur (auto-saved). */
function SocialUrlField({
  network,
  value,
  onCommit,
}: {
  network: SocialNetworkId
  value: string
  onCommit: (value: string) => void
}) {
  const meta = SOCIAL_META[network]
  const [draft, setDraft] = useState(value)
  const validation = validateSocialUrl(network, draft)

  useEffect(() => {
    setDraft(value)
  }, [value])

  return (
    <label className="block space-y-1 text-sm">
      <span className="font-medium text-foreground">{meta.label}</span>
      <input
        className={cn(
          'w-full rounded-lg border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent',
          validation.ok
            ? 'border-border'
            : 'border-danger/60 focus:border-danger',
        )}
        value={draft}
        onChange={(e) => {
          const next = e.target.value
          setDraft(next)
          // Persist as typed so work is not lost; h-card only uses valid URLs.
          onCommit(next)
        }}
        onBlur={() => {
          const result = validateSocialUrl(network, draft)
          if (result.ok && result.value !== draft) {
            setDraft(result.value)
            onCommit(result.value)
          }
        }}
        placeholder={meta.placeholder}
        inputMode="url"
        autoComplete="url"
        spellCheck={false}
        aria-invalid={!validation.ok}
        aria-describedby={
          validation.ok ? undefined : `social-${network}-error`
        }
      />
      {!validation.ok && validation.error ? (
        <span
          id={`social-${network}-error`}
          className="block text-[11px] text-danger"
          role="status"
        >
          {validation.error}
        </span>
      ) : draft.trim() && validation.ok ? (
        <span className="block text-[11px] text-muted">
          Saved · will appear as rel=me
        </span>
      ) : null}
    </label>
  )
}

export function AccountSection() {
  const { data: session } = useSession()
  const { prefs, updatePrefs } = usePreferences()
  const user = session?.user

  return (
    <PrefSection
      title="Account"
      description={`Sign-in identity for ${BEVEL_NAME} in this workspace.`}
    >
      <div className="flex items-center gap-4 rounded-xl border border-border bg-background/50 p-4">
        {user?.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.image}
            alt=""
            className="size-14 rounded-full border border-border object-cover"
          />
        ) : (
          <div className="flex size-14 items-center justify-center rounded-full bg-accent/15 text-lg font-semibold text-accent">
            {(user?.name ?? user?.email ?? '?').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-foreground">
            {user?.name ?? 'Signed in'}
          </p>
          <p className="truncate text-sm text-muted">{user?.email}</p>
          {session?.tenantSlug ? (
            <p className="mt-1 text-xs text-muted">
              Workspace · {session.tenantSlug}
              {session.realtimeNamespace
                ? ` · ns ${session.realtimeNamespace}`
                : ''}
            </p>
          ) : null}
        </div>
      </div>

      <PrefGroup title="Display name source">
        <PrefRadio
          name="displayNameSource"
          value={prefs.account.displayNameSource}
          onChange={(displayNameSource) =>
            updatePrefs({ account: { displayNameSource } })
          }
          options={[
            {
              value: 'google',
              label: 'Google Workspace name',
              description: 'Synced from your organization profile.',
            },
            {
              value: 'profile',
              label: 'BEVEL profile (h-card)',
              description: 'Use the Profile section display name.',
            },
            {
              value: 'custom',
              label: 'Custom (legacy)',
              description: 'Reserved for advanced overrides.',
            },
          ]}
        />
      </PrefGroup>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void signOut({ callbackUrl: '/' })}
        >
          Sign out
        </Button>
      </div>
    </PrefSection>
  )
}

export function NotificationsSection() {
  const { prefs, updatePrefs, refreshPermissions } = usePreferences()
  const sms = prefs.notifications.sms
  const [browserState, setBrowserState] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default',
  )
  const [phoneDraft, setPhoneDraft] = useState(sms.phoneE164)
  const [smsStatus, setSmsStatus] = useState('')
  const [smsBusy, setSmsBusy] = useState(false)
  const [workspaceTwilio, setWorkspaceTwilio] = useState<{
    configured: boolean
    enabled: boolean
    smsAllowed: boolean
    plan: string
    upgradeMessage: string | null
  } | null>(null)

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setBrowserState(Notification.permission)
    }
  }, [prefs.notifications.desktopEnabled])

  useEffect(() => {
    setPhoneDraft(sms.phoneE164)
  }, [sms.phoneE164])

  useEffect(() => {
    let cancelled = false
    void fetch('/api/twilio/workspace', { credentials: 'include' })
      .then((r) => r.json())
      .then(
        (data: {
          twilio?: { configured?: boolean; enabled?: boolean }
          smsAllowed?: boolean
          plan?: string
          upgradeMessage?: string | null
        }) => {
          if (cancelled) return
          setWorkspaceTwilio({
            configured: Boolean(data.twilio?.configured),
            enabled: Boolean(data.twilio?.enabled),
            smsAllowed: data.smsAllowed !== false,
            plan: data.plan ?? 'free',
            upgradeMessage: data.upgradeMessage ?? null,
          })
        },
      )
      .catch(() => {
        if (!cancelled)
          setWorkspaceTwilio({
            configured: false,
            enabled: false,
            smsAllowed: false,
            plan: 'free',
            upgradeMessage: null,
          })
      })
    return () => {
      cancelled = true
    }
  }, [])

  const saveSmsPhone = () => {
    updatePrefs({
      notifications: {
        sms: {
          ...sms,
          phoneE164: phoneDraft.trim(),
          // Re-verify when number changes
          phoneVerified:
            phoneDraft.trim() === sms.phoneE164 ? sms.phoneVerified : false,
        },
      },
    })
    setSmsStatus(
      phoneDraft.trim() === sms.phoneE164 && sms.phoneVerified
        ? 'Number saved (verified).'
        : 'Number saved — mark verified after you confirm it, or send a test from Integrations.',
    )
  }

  const sendTestPresenceSms = async () => {
    setSmsBusy(true)
    setSmsStatus('')
    try {
      const res = await fetch('/api/twilio/notify-unread', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          force: true,
          smsEnabled: true,
          phoneVerified: true,
          phoneE164: phoneDraft.trim() || sms.phoneE164,
          graceMinutes: sms.graceMinutes,
          includeVoteLinks: sms.includeVoteLinks,
          channelSlug: 'general',
          messagePreview: 'Test: true-sentience presence SMS (unread while away).',
          productName: BEVEL_NAME,
          isMentionOrDm: true,
          presence: {},
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        simulated?: boolean
        error?: string
        skipped?: boolean
        reason?: string
      }
      if (data.skipped) {
        setSmsStatus(`Skipped: ${data.reason ?? 'unknown'}`)
      } else if (!res.ok) {
        setSmsStatus(data.error ?? 'Test SMS failed')
      } else {
        setSmsStatus(
          data.simulated
            ? 'Simulated SMS (workspace Twilio not fully configured) — check server logs.'
            : 'Test SMS sent with vote links (Open / Snooze / Ack).',
        )
      }
    } catch {
      setSmsStatus('Test SMS failed — network error.')
    } finally {
      setSmsBusy(false)
    }
  }

  return (
    <PrefSection
      title="Notifications"
      description="Desktop banners, mobile push, and true-sentience SMS when you have not seen a message on any device."
    >
      <PrefGroup title="How to notify you">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted">
          Browser permission:
          <PrefChip
            state={
              browserState === 'granted'
                ? 'granted'
                : browserState === 'denied'
                  ? 'denied'
                  : 'prompt'
            }
            label={
              browserState === 'granted'
                ? 'Allowed'
                : browserState === 'denied'
                  ? 'Blocked'
                  : 'Not set'
            }
          />
        </div>
        <PrefToggle
          label="Desktop notifications"
          description="Show banners in this browser when you are allowed."
          checked={prefs.notifications.desktopEnabled}
          onChange={async (desktopEnabled) => {
            if (desktopEnabled) {
              const state = await requestNotificationPermission()
              setBrowserState(
                state === 'granted'
                  ? 'granted'
                  : state === 'denied'
                    ? 'denied'
                    : 'default',
              )
              updatePrefs({
                notifications: {
                  desktopEnabled: state === 'granted',
                },
              })
              await refreshPermissions()
              return
            }
            updatePrefs({ notifications: { desktopEnabled: false } })
          }}
        />
        <PrefToggle
          label="Mobile notifications"
          description="Flutter / mobile app push when the client reports presence."
          checked={prefs.notifications.mobileEnabled}
          onChange={(mobileEnabled) =>
            updatePrefs({ notifications: { mobileEnabled } })
          }
        />
      </PrefGroup>

      <PrefGroup
        title="SMS · true sentience"
        description="Paid plans only. If you have not read or seen a message on desktop or mobile within the grace window, BEVEL can text you — reply Y / S / N (or optional vote links)."
      >
        {workspaceTwilio && !workspaceTwilio.smsAllowed ? (
          <div
            className="rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-foreground"
            role="status"
          >
            <p className="font-semibold">Pro feature</p>
            <p className="mt-1 text-xs text-muted">
              {workspaceTwilio.upgradeMessage ??
                'SMS is included on Pro, Team, and Enterprise. This workspace is on the free plan.'}
            </p>
            <p className="mt-2 text-[11px] text-muted">
              Plan: <span className="font-mono">{workspaceTwilio.plan}</span>
            </p>
          </div>
        ) : (
          <>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          Workspace Twilio:
          <PrefChip
            state={
              workspaceTwilio?.configured && workspaceTwilio.enabled
                ? 'granted'
                : workspaceTwilio?.configured
                  ? 'prompt'
                  : 'denied'
            }
            label={
              workspaceTwilio?.configured && workspaceTwilio.enabled
                ? 'Ready'
                : workspaceTwilio?.configured
                  ? 'Disabled'
                  : 'Not configured'
            }
          />
          <span className="text-muted/80">
            (set credentials under Integrations)
          </span>
        </div>
        <PrefToggle
          label="SMS when away (true sentience)"
          description="Only if neither browser nor Flutter has recent presence after the grace period."
          checked={sms.enabled}
          onChange={(enabled) =>
            updatePrefs({
              notifications: { sms: { ...sms, enabled } },
            })
          }
        />
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">Mobile number (E.164)</span>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
              value={phoneDraft}
              onChange={(e) => setPhoneDraft(e.target.value)}
              placeholder="+15551234567"
              inputMode="tel"
              autoComplete="tel"
            />
            <Button
              type="button"
              variant="secondary"
              className="sm:shrink-0"
              onClick={saveSmsPhone}
            >
              Save number
            </Button>
          </div>
          <span className="text-[11px] text-muted">
            {sms.phoneVerified
              ? 'Verified for SMS alerts'
              : 'Not verified yet — save number, then enable SMS and send a test'}
          </span>
        </label>
        <PrefToggle
          label="Mark number verified"
          description="Confirm you control this number (OTP verify can plug in later)."
          checked={sms.phoneVerified}
          onChange={(phoneVerified) =>
            updatePrefs({
              notifications: {
                sms: { ...sms, phoneE164: phoneDraft.trim() || sms.phoneE164, phoneVerified },
              },
            })
          }
        />
        <label className="block space-y-1 text-sm">
          <span className="font-medium text-foreground">
            Grace period (minutes without presence)
          </span>
          <input
            type="number"
            min={1}
            max={120}
            className="w-full max-w-[8rem] rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
            value={sms.graceMinutes}
            onChange={(e) =>
              updatePrefs({
                notifications: {
                  sms: {
                    ...sms,
                    graceMinutes: Math.min(
                      120,
                      Math.max(1, Number(e.target.value) || 5),
                    ),
                  },
                },
              })
            }
          />
        </label>
        <PrefToggle
          label="Mentions & DMs only"
          description="Skip SMS for general channel noise unless you are @mentioned or DM’d."
          checked={sms.onlyMentionsAndDms}
          onChange={(onlyMentionsAndDms) =>
            updatePrefs({
              notifications: { sms: { ...sms, onlyMentionsAndDms } },
            })
          }
        />
        <PrefToggle
          label="Include vote links in SMS"
          description="Off = cheaper 1-segment text (reply Y/S/N only). On = Open/Snooze/Ack URLs (often 2–3 segments)."
          checked={sms.includeVoteLinks}
          onChange={(includeVoteLinks) =>
            updatePrefs({
              notifications: { sms: { ...sms, includeVoteLinks } },
            })
          }
        />
        <PrefToggle
          label="Quiet hours"
          description="Suppress SMS overnight (local device clock)."
          checked={sms.quietHoursEnabled}
          onChange={(quietHoursEnabled) =>
            updatePrefs({
              notifications: { sms: { ...sms, quietHoursEnabled } },
            })
          }
        />
        {sms.quietHoursEnabled ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-foreground">Quiet start</span>
              <input
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
                value={sms.quietStart}
                onChange={(e) =>
                  updatePrefs({
                    notifications: {
                      sms: { ...sms, quietStart: e.target.value },
                    },
                  })
                }
                placeholder="22:00"
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-foreground">Quiet end</span>
              <input
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
                value={sms.quietEnd}
                onChange={(e) =>
                  updatePrefs({
                    notifications: {
                      sms: { ...sms, quietEnd: e.target.value },
                    },
                  })
                }
                placeholder="07:00"
              />
            </label>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            disabled={smsBusy || !phoneDraft.trim()}
            onClick={() => void sendTestPresenceSms()}
          >
            {smsBusy ? 'Sending…' : 'Send test presence SMS'}
          </Button>
        </div>
        {smsStatus ? (
          <p className="text-xs text-muted" role="status">
            {smsStatus}
          </p>
        ) : null}
          </>
        )}
      </PrefGroup>

      <PrefGroup title="What to notify you about">
        <PrefSelect
          label="Default level"
          value={prefs.notifications.notifyOn}
          onChange={(notifyOn) =>
            updatePrefs({
              notifications: {
                notifyOn: notifyOn as typeof prefs.notifications.notifyOn,
              },
            })
          }
          options={[
            { value: 'mentions_dms', label: 'Mentions and direct messages' },
            { value: 'all', label: 'All new messages' },
            { value: 'nothing', label: 'Nothing' },
          ]}
        />
        <PrefToggle
          label="Thread replies"
          checked={prefs.notifications.threadReplies}
          onChange={(threadReplies) =>
            updatePrefs({ notifications: { threadReplies } })
          }
        />
        <PrefToggle
          label="Priority people even when paused"
          checked={prefs.notifications.vipBypassPaused}
          onChange={(vipBypassPaused) =>
            updatePrefs({ notifications: { vipBypassPaused } })
          }
        />
      </PrefGroup>

      <PrefGroup title="What to show in Activity">
        <PrefToggle
          label="DMs and group DMs"
          checked={prefs.notifications.activity.dms}
          onChange={(dms) =>
            updatePrefs({
              notifications: {
                activity: { ...prefs.notifications.activity, dms },
              },
            })
          }
        />
        <PrefToggle
          label='Channels set to "All new posts"'
          checked={prefs.notifications.activity.allPostsChannels}
          onChange={(allPostsChannels) =>
            updatePrefs({
              notifications: {
                activity: {
                  ...prefs.notifications.activity,
                  allPostsChannels,
                },
              },
            })
          }
        />
        <PrefToggle
          label="Reminders when due"
          checked={prefs.notifications.activity.reminders}
          onChange={(reminders) =>
            updatePrefs({
              notifications: {
                activity: { ...prefs.notifications.activity, reminders },
              },
            })
          }
        />
      </PrefGroup>
    </PrefSection>
  )
}

export function MediaSection() {
  const { prefs, updatePrefs, refreshPermissions } = usePreferences()
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [speakers, setSpeakers] = useState<MediaDeviceInfo[]>([])
  const [busy, setBusy] = useState<'camera' | 'microphone' | null>(null)
  const [previewOn, setPreviewOn] = useState(false)
  const [level, setLevel] = useState(0)
  const [toneBusy, setToneBusy] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)

  const refreshDevices = async () => {
    setCameras(await listMediaDevices('videoinput'))
    setMics(await listMediaDevices('audioinput'))
    setSpeakers(await listMediaDevices('audiooutput'))
  }

  useEffect(() => {
    void refreshDevices()
  }, [prefs.media.cameraPermission, prefs.media.microphonePermission])

  useEffect(() => {
    return () => {
      stopMediaStream(streamRef.current)
      streamRef.current = null
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      void audioCtxRef.current?.close()
    }
  }, [])

  const stopPreview = () => {
    stopMediaStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    analyserRef.current = null
    void audioCtxRef.current?.close()
    audioCtxRef.current = null
    setLevel(0)
    setPreviewOn(false)
  }

  const startPreview = async (overrides?: {
    cameraId?: string
    micId?: string
    autoGainControl?: boolean
    noiseSuppression?: boolean
    echoCancellation?: boolean
  }) => {
    stopPreview()
    const stream = await openMediaPreview({
      video: true,
      audio: true,
      cameraId: overrides?.cameraId ?? prefs.media.preferredCameraId,
      micId: overrides?.micId ?? prefs.media.preferredMicId,
      autoGainControl:
        overrides?.autoGainControl ?? prefs.media.autoGainControl,
      noiseSuppression:
        overrides?.noiseSuppression ?? prefs.media.noiseSuppression,
      echoCancellation:
        overrides?.echoCancellation ?? prefs.media.echoCancellation,
    })
    if (!stream) {
      setPreviewOn(false)
      return
    }
    streamRef.current = stream
    if (videoRef.current) {
      videoRef.current.srcObject = stream
      void videoRef.current.play().catch(() => undefined)
    }
    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length > 0) {
      try {
        const ctx = new AudioContext()
        audioCtxRef.current = ctx
        const source = ctx.createMediaStreamSource(stream)
        const analyser = ctx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        analyserRef.current = analyser
        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteFrequencyData(data)
          let sum = 0
          for (let i = 0; i < data.length; i++) sum += data[i] ?? 0
          setLevel(Math.min(100, Math.round((sum / data.length / 255) * 140)))
          rafRef.current = requestAnimationFrame(tick)
        }
        rafRef.current = requestAnimationFrame(tick)
      } catch {
        /* analyser optional */
      }
    }
    setPreviewOn(true)
    updatePrefs({
      media: {
        cameraPermission: 'granted',
        microphonePermission: 'granted',
      },
    })
    await refreshDevices()
    await refreshPermissions()
  }

  const request = async (kind: 'camera' | 'microphone') => {
    setBusy(kind)
    const state = await requestMediaPermission(kind)
    if (kind === 'camera') {
      updatePrefs({ media: { cameraPermission: state } })
    } else {
      updatePrefs({ media: { microphonePermission: state } })
    }
    if (state === 'granted') await refreshDevices()
    await refreshPermissions()
    setBusy(null)
  }

  return (
    <PrefSection
      title="Audio & video"
      description="Camera, mic, and speaker for live sessions — device picks and processing. Chat works without these."
    >
      <PrefGroup title="Live preview">
        <div className="relative overflow-hidden rounded-xl border border-border bg-black/90">
          <video
            ref={videoRef}
            className="aspect-video w-full bg-black object-cover"
            muted
            playsInline
            autoPlay
          />
          {!previewOn ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">
              Camera off
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => void (previewOn ? stopPreview() : startPreview())}
          >
            {previewOn ? 'Stop preview' : 'Start camera preview'}
          </Button>
          <div className="flex min-w-[8rem] flex-1 items-center gap-2">
            <span className="text-[10px] uppercase tracking-wide text-muted">
              Mic
            </span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-75"
                style={{ width: `${level}%` }}
              />
            </div>
          </div>
        </div>
      </PrefGroup>

      <PrefGroup title="Camera">
        <div className="flex flex-wrap items-center gap-2">
          <PrefChip
            state={prefs.media.cameraPermission}
            label={permissionLabel(prefs.media.cameraPermission)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy === 'camera'}
            onClick={() => void request('camera')}
          >
            {busy === 'camera' ? 'Requesting…' : 'Allow camera'}
          </Button>
        </div>
        {cameras.length > 0 ? (
          <PrefSelect
            label="Camera"
            value={prefs.media.preferredCameraId ?? cameras[0]?.deviceId ?? ''}
            onChange={(preferredCameraId) => {
              updatePrefs({ media: { preferredCameraId } })
              if (previewOn) void startPreview({ cameraId: preferredCameraId })
            }}
            options={cameras.map((d) => ({
              value: d.deviceId,
              label: d.label || `Camera ${d.deviceId.slice(0, 6)}`,
            }))}
          />
        ) : null}
      </PrefGroup>

      <PrefGroup title="Microphone">
        <div className="flex flex-wrap items-center gap-2">
          <PrefChip
            state={prefs.media.microphonePermission}
            label={permissionLabel(prefs.media.microphonePermission)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy === 'microphone'}
            onClick={() => void request('microphone')}
          >
            {busy === 'microphone' ? 'Requesting…' : 'Allow microphone'}
          </Button>
        </div>
        {mics.length > 0 ? (
          <PrefSelect
            label="Microphone"
            value={prefs.media.preferredMicId ?? mics[0]?.deviceId ?? ''}
            onChange={(preferredMicId) => {
              updatePrefs({ media: { preferredMicId } })
              if (previewOn) void startPreview({ micId: preferredMicId })
            }}
            options={mics.map((d) => ({
              value: d.deviceId,
              label: d.label || `Mic ${d.deviceId.slice(0, 6)}`,
            }))}
          />
        ) : null}
      </PrefGroup>

      <PrefGroup title="Speaker">
        {speakers.length > 0 ? (
          <PrefSelect
            label="Speaker"
            value={
              prefs.media.preferredSpeakerId ?? speakers[0]?.deviceId ?? ''
            }
            onChange={(preferredSpeakerId) =>
              updatePrefs({ media: { preferredSpeakerId } })
            }
            options={speakers.map((d) => ({
              value: d.deviceId,
              label: d.label || `Speaker ${d.deviceId.slice(0, 6)}`,
            }))}
          />
        ) : (
          <p className="text-xs text-muted">
            Speakers appear after mic/camera permission on some browsers.
          </p>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={toneBusy}
          onClick={() => {
            setToneBusy(true)
            void playSpeakerTestTone(prefs.media.preferredSpeakerId).finally(
              () => setToneBusy(false),
            )
          }}
        >
          {toneBusy ? 'Playing…' : 'Test speaker'}
        </Button>
      </PrefGroup>

      <PrefGroup title="Audio processing">
        <PrefToggle
          label="Automatic gain control"
          description="Normalize mic input level during live sessions."
          checked={prefs.media.autoGainControl}
          onChange={(autoGainControl) => {
            updatePrefs({ media: { autoGainControl } })
            if (previewOn) void startPreview({ autoGainControl })
          }}
        />
        <PrefToggle
          label="Noise suppression"
          description="Reduce background noise when available."
          checked={prefs.media.noiseSuppression}
          onChange={(noiseSuppression) => {
            updatePrefs({ media: { noiseSuppression } })
            if (previewOn) void startPreview({ noiseSuppression })
          }}
        />
        <PrefToggle
          label="Echo cancellation"
          description="Cut feedback from speakers into the mic."
          checked={prefs.media.echoCancellation}
          onChange={(echoCancellation) => {
            updatePrefs({ media: { echoCancellation } })
            if (previewOn) void startPreview({ echoCancellation })
          }}
        />
      </PrefGroup>
    </PrefSection>
  )
}

export function SecuritySection() {
  const { data: session } = useSession()
  return (
    <PrefSection
      title="Security"
      description="Session and access for this browser."
    >
      <div className="space-y-2 rounded-xl border border-border bg-background/50 p-4 text-sm">
        <p>
          <span className="text-muted">Signed in as </span>
          <span className="font-medium text-foreground">
            {session?.user?.email}
          </span>
        </p>
        <p className="text-muted">
          Auth uses Google Workspace OIDC. Cookies may be scoped to{' '}
          <code className="rounded bg-background px-1 font-mono text-xs">
            .lvh.me
          </code>{' '}
          for org hops.
        </p>
        {session?.githubLogin ? (
          <p className="text-muted">
            GitHub linked as{' '}
            <span className="font-medium text-foreground">
              @{session.githubLogin}
            </span>
          </p>
        ) : (
          <p className="text-muted">GitHub not linked for work mode.</p>
        )}
      </div>
      <Button
        type="button"
        variant="outline"
        onClick={() => void signOut({ callbackUrl: '/' })}
      >
        Sign out of this browser
      </Button>
    </PrefSection>
  )
}

function IntegrationTokenCard({
  id,
  title,
  description,
  docsHint,
  connected,
  label,
  onConnect,
  onDisconnect,
}: {
  id: 'clickup' | 'attio'
  title: string
  description: string
  docsHint: string
  connected: boolean
  label?: string
  onConnect: (token: string, workspaceId: string) => void
  onDisconnect: () => void
}) {
  const [token, setToken] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [reveal, setReveal] = useState(false)

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">{description}</p>
          {connected && label ? (
            <p className="mt-1 font-mono text-[11px] text-muted">{label}</p>
          ) : null}
        </div>
        <PrefChip
          state={connected ? 'granted' : 'prompt'}
          label={connected ? 'Connected' : 'None'}
        />
      </div>
      {connected ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onDisconnect}>
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type={reveal ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={`${title} API token`}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
            autoComplete="off"
            data-integration={id}
          />
          <input
            type="text"
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            placeholder="Workspace / team id (optional)"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
          />
          <p className="text-[11px] text-muted">{docsHint}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setReveal((v) => !v)}
            >
              {reveal ? 'Hide' : 'Show'}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!token.trim()}
              onClick={() => {
                onConnect(token.trim(), workspaceId.trim())
                setToken('')
              }}
            >
              Connect
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function IntegrationsSection() {
  const { data: session } = useSession()
  const { prefs, updatePrefs } = usePreferences()
  const integ = prefs.integrations

  const connectIntegration = (
    id: 'clickup' | 'attio',
    token: string,
    workspaceId: string,
  ) => {
    try {
      window.localStorage.setItem(`${INTEGRATION_KEY_PREFIX}${id}`, token)
    } catch {
      /* ignore */
    }
    const preview =
      token.length > 8 ? `${token.slice(0, 4)}…${token.slice(-3)}` : '••••'
    updatePrefs({
      integrations: {
        [id]: {
          connected: true,
          workspaceId: workspaceId || undefined,
          label: workspaceId
            ? `${id} · ${workspaceId} · ${preview}`
            : `${id} · ${preview}`,
        },
      },
    })
  }

  const disconnectIntegration = (id: 'clickup' | 'attio') => {
    try {
      window.localStorage.removeItem(`${INTEGRATION_KEY_PREFIX}${id}`)
    } catch {
      /* ignore */
    }
    updatePrefs({
      integrations: {
        [id]: { connected: false, workspaceId: undefined, label: undefined },
      },
    })
  }

  return (
    <PrefSection
      title="Integrations"
      description="Connected accounts for auth, work mode, tasks (ClickUp), CRM (Attio), and workspace Twilio SMS. Browser tokens stay local; Twilio credentials are stored server-side per workspace."
    >
      <PrefToggle
        label="Allow connecting other apps"
        description="Show connect flows for third-party tools in this workspace."
        checked={integ.allowConnectOtherApps}
        onChange={(allowConnectOtherApps) =>
          updatePrefs({ integrations: { allowConnectOtherApps } })
        }
      />

      <PrefGroup title="Identity">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-foreground">
                Google Workspace
              </p>
              <p className="text-xs text-muted">
                {session?.user?.email
                  ? `Connected · ${session.user.email}`
                  : 'Not connected'}
              </p>
            </div>
            <PrefChip
              state={session?.user?.email ? 'granted' : 'prompt'}
              label={session?.user?.email ? 'Connected' : 'None'}
            />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/50 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">GitHub</p>
              <p className="text-xs text-muted">
                {session?.githubLogin
                  ? `Linked · @${session.githubLogin}${
                      session.canPutOnWork ? ' · work mode ready' : ''
                    }`
                  : 'Required for work mode write access'}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-muted">
                Grants repo access for agents, issues →{' '}
                <a
                  href="/^product"
                  className="font-medium text-accent underline-offset-2 hover:underline"
                >
                  ^product
                </a>
                , Actions, and accountability logs.
              </p>
            </div>
            {session?.githubLogin ? (
              <div className="flex shrink-0 flex-col items-end gap-1">
                <PrefChip state="granted" label="Linked" />
                <button
                  type="button"
                  className="text-[11px] text-muted hover:text-foreground"
                  onClick={() =>
                    void signIn('github', {
                      callbackUrl: window.location.href,
                    })
                  }
                >
                  Re-link scopes
                </button>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                className="shrink-0 rounded-full bg-orange-500 px-4 text-white hover:bg-orange-600"
                onClick={() =>
                  void signIn('github', {
                    callbackUrl: `${window.location.origin}/^product?github=linked`,
                  })
                }
              >
                Link GitHub
              </Button>
            )}
          </div>
        </div>
      </PrefGroup>

      <PrefGroup
        title="Work & CRM"
        description="Same integration surface as decli (ClickUp) plus Attio for relationship data."
      >
        <IntegrationTokenCard
          id="clickup"
          title="ClickUp"
          description="Tasks, lists, and sprint boards for channel-linked work."
          docsHint="Create a personal API token in ClickUp → Settings → Apps."
          connected={integ.clickup.connected}
          label={integ.clickup.label}
          onConnect={(token, workspaceId) =>
            connectIntegration('clickup', token, workspaceId)
          }
          onDisconnect={() => disconnectIntegration('clickup')}
        />
        <IntegrationTokenCard
          id="attio"
          title="Attio"
          description="CRM people, companies, and deal context for agents."
          docsHint="Generate an access token in Attio → Workspace settings → Developers."
          connected={integ.attio.connected}
          label={integ.attio.label}
          onConnect={(token, workspaceId) =>
            connectIntegration('attio', token, workspaceId)
          }
          onDisconnect={() => disconnectIntegration('attio')}
        />
      </PrefGroup>

      <PrefGroup
        title="Twilio (workspace) · cheap path"
        description="Bare Programmable Messaging only — Account SID, Auth Token, From number. No Verify, no Messaging Service, no SDK. Pay per SMS segment."
      >
        <TwilioWorkspaceCard />
      </PrefGroup>
    </PrefSection>
  )
}

function TwilioWorkspaceCard() {
  const { data: session } = useSession()
  const [enabled, setEnabled] = useState(false)
  const [accountSid, setAccountSid] = useState('')
  const [authToken, setAuthToken] = useState('')
  const [fromNumber, setFromNumber] = useState('')
  const [webhookBaseUrl, setWebhookBaseUrl] = useState('')
  const [preview, setPreview] = useState('')
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [smsAllowed, setSmsAllowed] = useState(true)
  const [plan, setPlan] = useState('free')
  const [upgradeMessage, setUpgradeMessage] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetch('/api/twilio/workspace', { credentials: 'include' })
      .then((r) => r.json())
      .then(
        (data: {
          twilio?: {
            enabled?: boolean
            accountSidPreview?: string
            fromNumber?: string
            webhookBaseUrl?: string
            configured?: boolean
          }
          smsAllowed?: boolean
          plan?: string
          upgradeMessage?: string | null
        }) => {
          if (cancelled) return
          const t = data.twilio
          setEnabled(Boolean(t?.enabled))
          setFromNumber(t?.fromNumber ?? '')
          setWebhookBaseUrl(t?.webhookBaseUrl ?? '')
          setPreview(t?.accountSidPreview ?? '')
          setSmsAllowed(data.smsAllowed !== false)
          setPlan(data.plan ?? 'free')
          setUpgradeMessage(data.upgradeMessage ?? null)
          setLoaded(true)
        },
      )
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const save = async () => {
    setBusy(true)
    setStatus('')
    try {
      const res = await fetch('/api/twilio/workspace', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          accountSid,
          authToken,
          fromNumber,
          webhookBaseUrl: webhookBaseUrl || undefined,
        }),
      })
      const data = (await res.json()) as {
        twilio?: { accountSidPreview?: string; configured?: boolean }
        error?: string
      }
      if (!res.ok) {
        setStatus(data.error ?? 'Save failed')
      } else {
        setPreview(data.twilio?.accountSidPreview ?? preview)
        setAuthToken('')
        setStatus(
          data.twilio?.configured
            ? 'Saved. Mode: Messages API only (cheapest).'
            : 'Saved — need Account SID, Auth Token, and From number.',
        )
      }
    } catch {
      setStatus('Save failed — network error.')
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setBusy(true)
    setStatus('')
    try {
      const res = await fetch('/api/twilio/test', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testTo }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        simulated?: boolean
        error?: string
        segments?: number
      }
      if (!res.ok) setStatus(data.error ?? 'Test failed')
      else
        setStatus(
          data.simulated
            ? 'Simulated (credentials incomplete) — check server logs.'
            : `Test SMS queued via Messages API${data.segments ? ` (~${data.segments} seg)` : ''}.`,
        )
    } catch {
      setStatus('Test failed — network error.')
    } finally {
      setBusy(false)
    }
  }

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://bevel…'

  if (loaded && !smsAllowed) {
    return (
      <div className="space-y-2 rounded-xl border border-accent/30 bg-accent/10 p-4">
        <p className="text-sm font-semibold text-foreground">
          Twilio SMS · paid plan required
        </p>
        <p className="text-xs leading-relaxed text-muted">
          {upgradeMessage ??
            'SMS (mobile OTP and true-sentience alerts) is included on Pro, Team, and Enterprise.'}
        </p>
        <p className="text-[11px] text-muted">
          Current plan:{' '}
          <span className="font-mono font-medium text-foreground">{plan}</span>
          {' · '}
          set <span className="font-mono">plan: pro</span> in{' '}
          <span className="font-mono">tenants/&lt;slug&gt;/bevel.yaml</span>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">
            Twilio · Messages API
          </p>
          <p className="text-xs text-muted">
            Workspace{' '}
            <span className="font-mono text-foreground/80">
              {session?.tenantSlug ?? '—'}
            </span>
            {preview ? <> · SID {preview}</> : null}
            {' · '}
            plan <span className="font-mono">{plan}</span>
          </p>
          <p className="mt-1 text-[11px] leading-snug text-muted">
            Paid feature. Buy a cheap local long code in Twilio Console → Phone
            Numbers. No Verify / Messaging Service.
          </p>
        </div>
        <PrefChip
          state={enabled && preview ? 'granted' : loaded ? 'prompt' : 'prompt'}
          label={enabled && preview ? 'On' : 'Off'}
        />
      </div>

      <PrefToggle
        label="Enable SMS for this workspace"
        description="OTP sign-in + true-sentience alerts bill per segment only."
        checked={enabled}
        onChange={setEnabled}
      />

      <label className="block space-y-1 text-sm">
        <span className="font-medium text-foreground">Account SID</span>
        <input
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
          value={accountSid}
          onChange={(e) => setAccountSid(e.target.value)}
          placeholder={preview ? `Current ${preview} — paste to replace` : 'ACxxxxxxxx'}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-foreground">Auth token</span>
        <input
          type="password"
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
          value={authToken}
          onChange={(e) => setAuthToken(e.target.value)}
          placeholder="Leave blank to keep existing"
          autoComplete="new-password"
          spellCheck={false}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-foreground">
          From number (local long code, E.164)
        </span>
        <input
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
          value={fromNumber}
          onChange={(e) => setFromNumber(e.target.value)}
          placeholder="+15551234567"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span className="font-medium text-foreground">
          Public base URL (optional, for vote links)
        </span>
        <input
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
          value={webhookBaseUrl}
          onChange={(e) => setWebhookBaseUrl(e.target.value)}
          placeholder={origin}
        />
        <span className="text-[11px] text-muted">
          Inbound webhook (POST):{' '}
          <span className="font-mono">
            {(webhookBaseUrl || origin).replace(/\/$/, '')}
            /api/twilio/webhook?tenant={session?.tenantSlug ?? 'slug'}
          </span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Save Twilio credentials'}
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 space-y-1 text-sm">
          <span className="font-medium text-foreground">Test SMS to</span>
          <input
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-accent"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="+15551234567"
          />
        </label>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={busy || !testTo.trim()}
          onClick={() => void test()}
        >
          Send test
        </Button>
      </div>

      {status ? (
        <p className="text-xs text-muted" role="status">
          {status}
        </p>
      ) : null}
    </div>
  )
}

export function PrivacySection() {
  const { prefs, updatePrefs } = usePreferences()
  const [blockDraft, setBlockDraft] = useState('')

  return (
    <PrefSection
      title="Privacy"
      description="Discoverability and who can invite you — contact controls for this workspace."
    >
      <PrefGroup title="Discoverability">
        <PrefRadio
          name="discoverability"
          value={prefs.privacy.discoverability}
          onChange={(discoverability) =>
            updatePrefs({ privacy: { discoverability } })
          }
          options={[
            {
              value: 'email',
              label: 'People can find me by email',
              description: 'Workspace members may look you up with your email.',
            },
            {
              value: 'none',
              label: 'Nobody can find me',
              description: 'You will not appear in email-based search.',
            },
          ]}
        />
      </PrefGroup>

      <PrefGroup title="Contact invitations">
        <PrefRadio
          name="contactSharing"
          value={prefs.privacy.contactSharing}
          onChange={(contactSharing) =>
            updatePrefs({ privacy: { contactSharing } })
          }
          options={[
            {
              value: 'all_contacts',
              label: 'Anyone with my contact info',
              description: 'People who know your email can send invites.',
            },
            {
              value: 'workspace_only',
              label: 'People in my workspaces only',
              description: 'Invites limited to members of orgs you already share.',
            },
            {
              value: 'none',
              label: 'No one',
              description: 'Block all invitation requests from contacts.',
            },
          ]}
        />
      </PrefGroup>

      <PrefGroup
        title="Blocked from inviting you"
        description="Emails or member ids that cannot send you invites."
      >
        <div className="flex gap-2">
          <input
            value={blockDraft}
            onChange={(e) => setBlockDraft(e.target.value)}
            placeholder="email@example.com"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const id = blockDraft.trim().toLowerCase()
              if (!id || prefs.privacy.blockedInviteIds.includes(id)) return
              updatePrefs({
                privacy: {
                  blockedInviteIds: [...prefs.privacy.blockedInviteIds, id],
                },
              })
              setBlockDraft('')
            }}
          >
            Block
          </Button>
        </div>
        <ul className="space-y-1">
          {prefs.privacy.blockedInviteIds.length === 0 ? (
            <li className="text-sm text-muted">No blocked contacts.</li>
          ) : (
            prefs.privacy.blockedInviteIds.map((id) => (
              <li
                key={id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs">{id}</span>
                <button
                  type="button"
                  className="text-xs text-muted hover:text-foreground"
                  onClick={() =>
                    updatePrefs({
                      privacy: {
                        blockedInviteIds: prefs.privacy.blockedInviteIds.filter(
                          (x) => x !== id,
                        ),
                      },
                    })
                  }
                >
                  Unblock
                </button>
              </li>
            ))
          )}
        </ul>
      </PrefGroup>
    </PrefSection>
  )
}

export function AvailabilitySection() {
  const { prefs, updatePrefs } = usePreferences()
  const a = prefs.availability
  return (
    <PrefSection
      title="Availability"
      description="Working hours and automatic status when you might be delayed."
    >
      <PrefGroup title="Working hours">
        <PrefToggle
          label="Limit notification hours"
          description="Outside these hours, notifications pause (except priority people if enabled)."
          checked={a.workingHoursEnabled}
          onChange={(workingHoursEnabled) =>
            updatePrefs({ availability: { workingHoursEnabled } })
          }
        />
        <div className="grid gap-3 sm:grid-cols-3">
          <PrefSelect
            label="Days"
            value={a.days}
            onChange={(days) =>
              updatePrefs({
                availability: { days: days as typeof a.days },
              })
            }
            options={[
              { value: 'every_day', label: 'Every day' },
              { value: 'weekdays', label: 'Weekdays' },
              { value: 'custom', label: 'Custom' },
            ]}
          />
          <PrefSelect
            label="From"
            value={a.start}
            onChange={(start) => updatePrefs({ availability: { start } })}
            options={HOUR_OPTIONS}
          />
          <PrefSelect
            label="To"
            value={a.end}
            onChange={(end) => updatePrefs({ availability: { end } })}
            options={HOUR_OPTIONS}
          />
        </div>
      </PrefGroup>
      <PrefGroup title="Automatic statuses">
        <PrefToggle
          label="In channel when active in chat"
          checked={a.autoInChannel}
          onChange={(autoInChannel) =>
            updatePrefs({ availability: { autoInChannel } })
          }
        />
        <PrefToggle
          label="Focus when focus mode is on"
          checked={a.autoFocus}
          onChange={(autoFocus) =>
            updatePrefs({ availability: { autoFocus } })
          }
        />
        <PrefToggle
          label="After hours outside working hours"
          checked={a.autoAfterHours}
          onChange={(autoAfterHours) =>
            updatePrefs({ availability: { autoAfterHours } })
          }
        />
      </PrefGroup>
    </PrefSection>
  )
}

export function AppearanceSection() {
  const { prefs, updatePrefs } = usePreferences()
  return (
    <PrefSection
      title="Appearance"
      description="Day-part atmosphere first (auto by default), then density and theme. Each part trains background, contrast, accent, and rail wash."
    >
      <PrefGroup
        title="Day part"
        description="Auto follows your local clock (default). Manual locks a trained look for morning, midday, afternoon, or night."
      >
        <PrefRadio
          name="daypart"
          value={prefs.appearance.daypart ?? 'auto'}
          onChange={(daypart) =>
            updatePrefs({
              appearance: {
                daypart: daypart as typeof prefs.appearance.daypart,
              },
            })
          }
          options={[
            {
              value: 'auto',
              label: 'Auto (default)',
              description:
                'Resolves morning 5–11 · midday 11–15 · afternoon 15–20 · night 20–5.',
            },
            {
              value: 'morning',
              label: 'Morning',
              description:
                'Warm cream, peach-amber accent, soft borders — easy on eyes early day.',
            },
            {
              value: 'midday',
              label: 'Midday',
              description:
                'Cool paper white, cyan-sky accent, crisp structure for peak hours.',
            },
            {
              value: 'afternoon',
              label: 'Afternoon',
              description:
                'Honey-cream base, golden accent — golden-hour warmth without mud.',
            },
            {
              value: 'night',
              label: 'Night',
              description:
                'Deep ink surface, violet-slate accent, high-legibility muted labels.',
            },
          ]}
        />
      </PrefGroup>
      <WorkspaceLogoDaypartUploads />
      <PrefGroup title="Density">
        <PrefRadio
          name="density"
          value={prefs.appearance.density}
          onChange={(density) => updatePrefs({ appearance: { density } })}
          options={[
            {
              value: 'clean',
              label: 'Clean',
              description: 'Comfortable spacing for long channels.',
            },
            {
              value: 'compact',
              label: 'Compact',
              description: 'Tighter layout for dense workspaces.',
            },
          ]}
        />
      </PrefGroup>
      <PrefGroup title="Theme">
        <PrefRadio
          name="themeId"
          value={prefs.appearance.themeId}
          onChange={(themeId) => updatePrefs({ appearance: { themeId } })}
          options={[
            {
              value: 'tenant',
              label: 'Workspace default',
              description:
                'Day-part atmosphere + workspace accent from bevel.yaml.',
            },
            {
              value: 'system',
              label: 'System',
              description:
                'Follows OS light/dark (midday vs night atmosphere).',
            },
            {
              value: 'high_contrast',
              label: 'High contrast',
              description:
                'Hard borders, stronger text, no soft washes — keeps day-part light/dark.',
            },
          ]}
        />
      </PrefGroup>
    </PrefSection>
  )
}

const DAYPART_UPLOAD_META: {
  id: 'morning' | 'midday' | 'afternoon' | 'night'
  label: string
  hours: string
  surface: string
}[] = [
  {
    id: 'morning',
    label: 'Morning',
    hours: '5–11',
    surface: 'Warm cream rail — prefer a darker mark.',
  },
  {
    id: 'midday',
    label: 'Midday',
    hours: '11–15',
    surface: 'Cool paper — crisp black or brand color.',
  },
  {
    id: 'afternoon',
    label: 'Afternoon',
    hours: '15–20',
    surface: 'Honey-cream — warm ink or amber mark.',
  },
  {
    id: 'night',
    label: 'Night',
    hours: '20–5',
    surface: 'Deep navy — light / inverted mark.',
  },
]

/** Four unique workspace logo uploads, one per day part. */
function WorkspaceLogoDaypartUploads() {
  const { data: session } = useSession()
  const [logos, setLogos] = useState<
    Partial<Record<'morning' | 'midday' | 'afternoon' | 'night', string>>
  >({})
  const [fallback, setFallback] = useState<string | undefined>()
  const [busy, setBusy] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const inputRefs = useRef<
    Partial<Record<'morning' | 'midday' | 'afternoon' | 'night', HTMLInputElement | null>>
  >({})

  const reload = async () => {
    try {
      const res = await fetch('/api/brand/logo')
      if (!res.ok) return
      const data = (await res.json()) as {
        logos?: Partial<Record<'morning' | 'midday' | 'afternoon' | 'night', string>>
        fallback?: string
      }
      setLogos(data.logos || {})
      setFallback(data.fallback)
      // Keep html data-tenant-logos in sync for rail / chrome
      if (typeof document !== 'undefined' && data.logos) {
        document.documentElement.setAttribute(
          'data-tenant-logos',
          JSON.stringify(data.logos),
        )
      }
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    void reload()
  }, [])

  const onPick = async (
    daypart: 'morning' | 'midday' | 'afternoon' | 'night',
    file: File | null,
  ) => {
    if (!file) return
    setBusy(daypart)
    setStatus('')
    try {
      const body = new FormData()
      body.set('daypart', daypart)
      body.set('file', file)
      const res = await fetch('/api/brand/logo', { method: 'POST', body })
      const data = (await res.json()) as {
        ok?: boolean
        error?: string
        urlWithBust?: string
        url?: string
      }
      if (!res.ok || !data.ok) {
        setStatus(data.error || 'Upload failed')
        return
      }
      const url = data.urlWithBust || data.url
      if (url) {
        setLogos((prev) => ({ ...prev, [daypart]: url.split('?')[0] }))
        // Bust cache on the live attr map
        setLogos((prev) => {
          const next = { ...prev, [daypart]: url }
          document.documentElement.setAttribute(
            'data-tenant-logos',
            JSON.stringify(
              Object.fromEntries(
                Object.entries(next).map(([k, v]) => [k, String(v).split('?')[0]]),
              ),
            ),
          )
          return next
        })
      }
      setStatus(`${daypart} logo updated.`)
      await reload()
    } catch {
      setStatus('Upload failed')
    } finally {
      setBusy(null)
    }
  }

  if (!session?.user) {
    return (
      <PrefGroup
        title="Workspace logo (day part)"
        description="Sign in to upload four unique marks — one for each day part."
      >
        <p className="text-sm text-muted">Sign in required.</p>
      </PrefGroup>
    )
  }

  return (
    <PrefGroup
      title="Workspace logo (day part)"
      description="Four unique uploads. Each mark sits left of the product name and switches with day part (auto or locked)."
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {DAYPART_UPLOAD_META.map((slot) => {
          const url = logos[slot.id] || fallback
          const preview = url
            ? `${url.split('?')[0]}?v=${encodeURIComponent(url)}`
            : undefined
          return (
            <div
              key={slot.id}
              className="flex flex-col gap-2 rounded-xl border border-border/80 bg-background/40 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {slot.label}
                  </p>
                  <p className="text-[11px] text-muted">{slot.hours}</p>
                </div>
                <div
                  className="flex size-10 items-center justify-center rounded-lg border border-border bg-surface"
                  style={{
                    background:
                      slot.id === 'night'
                        ? 'var(--bevel-bg, #0c1220)'
                        : 'var(--cream, #faf7f2)',
                  }}
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preview}
                      alt=""
                      className="max-h-7 max-w-7 object-contain"
                    />
                  ) : (
                    <span className="text-[10px] text-muted">—</span>
                  )}
                </div>
              </div>
              <p className="text-[11px] leading-snug text-muted">{slot.surface}</p>
              <input
                ref={(el) => {
                  inputRefs.current[slot.id] = el
                }}
                type="file"
                accept="image/svg+xml,image/png,image/webp,image/jpeg"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  e.target.value = ''
                  void onPick(slot.id, f)
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy === slot.id}
                onClick={() => inputRefs.current[slot.id]?.click()}
              >
                {busy === slot.id
                  ? 'Uploading…'
                  : logos[slot.id]
                    ? 'Replace'
                    : 'Upload'}
              </Button>
            </div>
          )
        })}
      </div>
      {status ? <p className="text-xs text-muted">{status}</p> : null}
    </PrefGroup>
  )
}

export function MessagesSection() {
  const { data: session } = useSession()
  const { prefs, updatePrefs } = usePreferences()
  const fullName =
    prefs.profile.displayName?.trim() ||
    session?.user?.name?.trim() ||
    'Scott de Rozic'
  const display =
    prefs.profile.handle?.trim() ||
    session?.user?.email?.split('@')[0] ||
    'scott'
  const photo = prefs.profile.photoUrl || session?.user?.image || undefined
  const initial = fullName.slice(0, 1).toUpperCase()
  const nameStyle = prefs.messages.nameStyle
  const showAvatars = prefs.messages.showAvatars !== false

  return (
    <PrefSection title="Messages" description="How names and clocks appear.">
      <PrefGroup
        title="Names"
        description="Preview uses your profile photo and name."
      >
        <div className="space-y-2">
          {(
            [
              {
                value: 'full_and_display' as const,
                label: 'Full and display names',
                primary: fullName,
                secondary: `@${display.replace(/^@/, '')}`,
              },
              {
                value: 'display_only' as const,
                label: 'Just display names',
                primary: display.replace(/^@/, ''),
                secondary: undefined as string | undefined,
              },
            ] as const
          ).map((opt) => {
            const selected = nameStyle === opt.value
            return (
              <label
                key={opt.value}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition',
                  selected
                    ? 'border-accent/40 bg-accent/5 ring-1 ring-accent/25'
                    : 'border-border/80 bg-background/40 hover:border-border',
                )}
              >
                <input
                  type="radio"
                  name="nameStyle"
                  className="size-4 shrink-0 border-border accent-[var(--bevel-accent)]"
                  checked={selected}
                  onChange={() =>
                    updatePrefs({ messages: { nameStyle: opt.value } })
                  }
                />
                {/* Live preview of how a message header looks */}
                <span className="flex min-w-0 flex-1 items-center gap-2.5">
                  {showAvatars ? (
                    photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo}
                        alt=""
                        className="size-9 shrink-0 rounded-full border border-border object-cover"
                      />
                    ) : (
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-semibold text-accent"
                        aria-hidden
                      >
                        {initial}
                      </span>
                    )
                  ) : (
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted"
                      aria-hidden
                    >
                      —
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {opt.label}
                    </span>
                    <span className="mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-xs text-muted">
                      <span className="font-semibold text-foreground/90">
                        {opt.primary}
                      </span>
                      {opt.secondary ? (
                        <span className="text-muted">{opt.secondary}</span>
                      ) : null}
                    </span>
                  </span>
                </span>
              </label>
            )
          })}
        </div>
      </PrefGroup>
      <PrefGroup title="Additional options">
        <PrefToggle
          label="Show avatars next to messages"
          description="Human and agent faces in the thread. When off, names still show."
          checked={showAvatars}
          onChange={(next) => updatePrefs({ messages: { showAvatars: next } })}
        />
        <PrefToggle
          label="Show who is typing"
          checked={prefs.messages.showTyping}
          onChange={(showTyping) => updatePrefs({ messages: { showTyping } })}
        />
        <PrefToggle
          label="24-hour clock"
          checked={prefs.messages.clock24h}
          onChange={(clock24h) => updatePrefs({ messages: { clock24h } })}
        />
        <PrefToggle
          label="Color swatches next to hex values"
          checked={prefs.messages.colorSwatches}
          onChange={(colorSwatches) =>
            updatePrefs({ messages: { colorSwatches } })
          }
        />
      </PrefGroup>
    </PrefSection>
  )
}

export function LanguageSection() {
  const { prefs, updatePrefs } = usePreferences()
  return (
    <PrefSection title="Language & region">
      <PrefSelect
        label="Language"
        value={prefs.language.locale}
        onChange={(locale) => updatePrefs({ language: { locale } })}
        options={[
          { value: 'en-US', label: 'English (US)' },
          { value: 'en-GB', label: 'English (UK)' },
          { value: 'es-ES', label: 'Español' },
          { value: 'fr-FR', label: 'Français' },
        ]}
      />
      <PrefToggle
        label="Set time zone automatically"
        checked={prefs.language.timezoneAuto}
        onChange={(timezoneAuto) =>
          updatePrefs({ language: { timezoneAuto } })
        }
      />
      {!prefs.language.timezoneAuto ? (
        <PrefSelect
          label="Time zone"
          value={prefs.language.timezone}
          onChange={(timezone) => updatePrefs({ language: { timezone } })}
          options={COMMON_TIMEZONES.map((tz) => ({ value: tz, label: tz }))}
        />
      ) : null}
      <PrefToggle
        label="Spellcheck messages"
        checked={prefs.language.spellcheck}
        onChange={(spellcheck) => updatePrefs({ language: { spellcheck } })}
      />
    </PrefSection>
  )
}

export function AccessibilitySection() {
  const { prefs, updatePrefs } = usePreferences()
  return (
    <PrefSection title="Accessibility">
      <PrefToggle
        label="Simplified layout mode"
        description="More predictable layout for focus."
        checked={prefs.accessibility.simplifiedLayout}
        onChange={(simplifiedLayout) =>
          updatePrefs({ accessibility: { simplifiedLayout } })
        }
      />
      <PrefSelect
        label="Zoom"
        value={String(prefs.accessibility.zoomPercent)}
        onChange={(v) =>
          updatePrefs({ accessibility: { zoomPercent: Number(v) } })
        }
        options={[70, 80, 90, 100, 110, 125, 150, 175, 200].map((n) => ({
          value: String(n),
          label: n === 100 ? '100% Default' : `${n}%`,
        }))}
      />
      <PrefToggle
        label="Remind me to add image descriptions"
        checked={prefs.accessibility.altTextReminders}
        onChange={(altTextReminders) =>
          updatePrefs({ accessibility: { altTextReminders } })
        }
      />
    </PrefSection>
  )
}

export function MarkAsReadSection() {
  const { prefs, updatePrefs } = usePreferences()
  return (
    <PrefSection title="Mark as read">
      <PrefGroup title="When I view a channel">
        <PrefRadio
          name="onView"
          value={prefs.markAsRead.onViewBehavior}
          onChange={(onViewBehavior) =>
            updatePrefs({ markAsRead: { onViewBehavior } })
          }
          options={[
            {
              value: 'resume_and_read',
              label: 'Start where I left off, and mark the channel read',
            },
            {
              value: 'newest_and_read',
              label: 'Start at the newest message, and mark the channel read',
            },
            {
              value: 'newest_leave_unread',
              label:
                'Start at the newest message, but leave unseen messages unread',
            },
          ]}
        />
      </PrefGroup>
      <PrefToggle
        label="Prompt to confirm when marking everything read"
        checked={prefs.markAsRead.confirmMarkAll}
        onChange={(confirmMarkAll) =>
          updatePrefs({ markAsRead: { confirmMarkAll } })
        }
      />
    </PrefSection>
  )
}

export function NavigationSection() {
  const { prefs, updatePrefs } = usePreferences()
  const tabs = prefs.navigation.tabs
  return (
    <PrefSection title="Navigation">
      <PrefGroup title="Show these tabs">
        {(
          [
            ['ai', 'AI'],
            ['home', 'Home'],
            ['dms', 'DMs'],
            ['activity', 'Activity'],
            ['files', 'Files'],
            ['tools', 'Tools'],
          ] as const
        ).map(([key, label]) => (
          <PrefToggle
            key={key}
            label={label}
            checked={tabs[key]}
            onChange={(v) =>
              updatePrefs({
                navigation: { tabs: { ...tabs, [key]: v } },
              })
            }
          />
        ))}
      </PrefGroup>
      <PrefGroup title="Tab appearance">
        <PrefRadio
          name="tabAppearance"
          value={prefs.navigation.tabAppearance}
          onChange={(tabAppearance) =>
            updatePrefs({ navigation: { tabAppearance } })
          }
          options={[
            { value: 'icons_and_text', label: 'Icons & text' },
            { value: 'icons_only', label: 'Icons only' },
          ]}
        />
      </PrefGroup>
      <PrefToggle
        label="Show agents in top bar"
        checked={prefs.navigation.showAgentsInTopBar}
        onChange={(showAgentsInTopBar) =>
          updatePrefs({ navigation: { showAgentsInTopBar } })
        }
      />
    </PrefSection>
  )
}

export function HomeSection() {
  const { prefs, updatePrefs } = usePreferences()
  const side = prefs.home.sidebarAlways
  return (
    <PrefSection title="Home">
      <PrefToggle
        label="Channel organization tips"
        checked={prefs.home.channelOrgTips}
        onChange={(channelOrgTips) =>
          updatePrefs({ home: { channelOrgTips } })
        }
      />
      <PrefToggle
        label="Show activity dot on Home"
        checked={prefs.home.homeActivityDot}
        onChange={(homeActivityDot) =>
          updatePrefs({ home: { homeActivityDot } })
        }
      />
      <PrefGroup title="Always show in the sidebar">
        {(
          [
            ['unreads', 'Unreads'],
            ['huddles', 'Live sessions'],
            ['threads', 'Threads'],
            ['drafts', 'Drafts & sent'],
            ['directories', 'Directories'],
          ] as const
        ).map(([key, label]) => (
          <PrefToggle
            key={key}
            label={label}
            checked={side[key]}
            onChange={(v) =>
              updatePrefs({
                home: { sidebarAlways: { ...side, [key]: v } },
              })
            }
          />
        ))}
      </PrefGroup>
      <PrefGroup title="Filter conversations by">
        <PrefRadio
          name="filter"
          value={prefs.home.filter}
          onChange={(filter) => updatePrefs({ home: { filter } })}
          options={[
            {
              value: 'active',
              label: 'Active only',
              description: 'New activity within the last 30 days',
            },
            { value: 'unreads', label: 'Unreads' },
            { value: 'mentions', label: 'Mentions' },
            { value: 'all', label: 'All' },
          ]}
        />
      </PrefGroup>
    </PrefSection>
  )
}

export function VipSection() {
  const { prefs, updatePrefs } = usePreferences()
  const [draft, setDraft] = useState('')
  return (
    <PrefSection
      title="Priority people"
      description="People and agents you never want to miss."
    >
      <PrefToggle
        label="Always allow notifications from priority people"
        description="Still notify even when general notifications are paused."
        checked={prefs.vip.alwaysNotify}
        onChange={(alwaysNotify) => updatePrefs({ vip: { alwaysNotify } })}
      />
      <PrefToggle
        label="Create priority unreads section"
        checked={prefs.vip.unreadsSection}
        onChange={(unreadsSection) => updatePrefs({ vip: { unreadsSection } })}
      />
      <PrefGroup title="Priority list">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add email or agent id"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const id = draft.trim().toLowerCase()
              if (!id || prefs.vip.memberIds.includes(id)) return
              updatePrefs({
                vip: { memberIds: [...prefs.vip.memberIds, id] },
              })
              setDraft('')
            }}
          >
            Add
          </Button>
        </div>
        <ul className="space-y-1">
          {prefs.vip.memberIds.length === 0 ? (
            <li className="text-sm text-muted">No priority people yet.</li>
          ) : (
            prefs.vip.memberIds.map((id) => (
              <li
                key={id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <span className="font-mono text-xs">{id}</span>
                <button
                  type="button"
                  className="text-xs text-muted hover:text-foreground"
                  onClick={() =>
                    updatePrefs({
                      vip: {
                        memberIds: prefs.vip.memberIds.filter((x) => x !== id),
                      },
                    })
                  }
                >
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>
      </PrefGroup>
    </PrefSection>
  )
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => {
  const hh = String(h).padStart(2, '0')
  return { value: `${hh}:00`, label: `${hh}:00` }
})

const COMMON_TIMEZONES = [
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'America/Toronto',
  'Europe/London',
  'Europe/Paris',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC',
]
