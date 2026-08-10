"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Brain,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Save,
  Settings,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  User,
  Zap,
} from "lucide-react";
import { HCardProfile } from "@/components/preferences/HCardProfile";
import { usePreferencesOptional } from "@/components/preferences/PreferencesProvider";
import {
  loadPreferences,
  savePreferences,
} from "@/lib/preferences/storage";

type ProviderId = "claude" | "openai" | "gemini" | "grok" | "kimi";

type ProviderState = Record<
  ProviderId,
  {
    configured: boolean;
    keyPreview: string;
  }
>;

type ApiSettings = {
  profile_name: string;
  profile_handle: string;
  active_provider: ProviderId;
  debug_logs: boolean;
  natural_language: boolean;
  providers: Record<string, { configured: boolean; key_preview: string }>;
  email?: string;
  name?: string;
};

const PROVIDERS: Array<{
  id: ProviderId;
  name: string;
  shortName: string;
  keyHint: string;
  description: string;
  signupUrl?: string;
}> = [
  {
    id: "claude",
    name: "Anthropic Claude",
    shortName: "Claude",
    keyHint: "sk-ant-...",
    description: "Default command reasoning path.",
  },
  {
    id: "openai",
    name: "OpenAI",
    shortName: "OpenAI",
    keyHint: "sk-proj-...",
    description: "Fast coding, structured output, and tool planning.",
  },
  {
    id: "gemini",
    name: "Google Gemini",
    shortName: "Gemini",
    keyHint: "AIza...",
    description: "Google model access for broad context workflows.",
  },
  {
    id: "grok",
    name: "xAI Grok",
    shortName: "Grok",
    keyHint: "xai-...",
    description: "xAI-compatible model routing.",
  },
  {
    id: "kimi",
    name: "Kimi3",
    shortName: "Kimi3",
    keyHint: "sk-...",
    description:
      "Flagship Kimi3 (kimi-k3) via Moonshot OpenAI-compatible API. Sign up at platform.kimi.ai.",
    signupUrl: "https://platform.kimi.ai",
  },
];

const EMPTY_PROVIDERS: ProviderState = {
  claude: { configured: false, keyPreview: "" },
  openai: { configured: false, keyPreview: "" },
  gemini: { configured: false, keyPreview: "" },
  grok: { configured: false, keyPreview: "" },
  kimi: { configured: false, keyPreview: "" },
};

function mapProviders(apiProviders: ApiSettings["providers"]): ProviderState {
  const next = { ...EMPTY_PROVIDERS };
  for (const provider of PROVIDERS) {
    const status = apiProviders[provider.id];
    if (status) {
      next[provider.id] = {
        configured: status.configured,
        keyPreview: status.key_preview,
      };
    }
  }
  return next;
}

/** X / Twitter bio length — same limit as h-card p-note in preferences. */
const BIO_MAX = 280;

export default function DashboardSettingsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const prefs = usePreferencesOptional();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savePhase, setSavePhase] = useState<"idle" | "settings" | "validating">("idle");
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [profileName, setProfileName] = useState("");
  const [profileHandle, setProfileHandle] = useState("");
  const [profileBio, setProfileBio] = useState("");
  const [activeProvider, setActiveProvider] = useState<ProviderId>("claude");
  const [providerState, setProviderState] = useState<ProviderState>(EMPTY_PROVIDERS);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [revealAiKey, setRevealAiKey] = useState(false);
  const [debugLogs, setDebugLogs] = useState(true);
  const [naturalLanguage, setNaturalLanguage] = useState(true);
  const [isTesting, setIsTesting] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const section = (searchParams.get("section") || "").toLowerCase();
  const tenantSlug = session?.tenantSlug || "2x4m";
  const userId = session?.user?.id || session?.user?.email || "anon";

  // Deep-link from announcements: open full prefs profile when available, and
  // scroll to the on-page bio field.
  useEffect(() => {
    if (section !== "profile") return;
    prefs?.openSection("profile");
    const t = window.setTimeout(() => {
      document.getElementById("profile-bio")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);
    return () => window.clearTimeout(t);
  }, [section, prefs]);

  useEffect(() => {
    let cancelled = false;

    async function loadSettings() {
      setIsLoading(true);
      setErrorMessage("");
      try {
        const response = await fetch("/api/me/settings");
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { detail?: string } | null;
          throw new Error(payload?.detail || "Could not load settings from your BEVEL account.");
        }
        const data = (await response.json()) as ApiSettings & {
          preferences?: {
            profile?: { displayName?: string; handle?: string; bio?: string }
            ai?: {
              activeProvider?: string
              naturalLanguage?: boolean
              providers?: Record<string, { configured?: boolean; keyPreview?: string }>
            }
          }
        };
        if (cancelled) return;

        const local = loadPreferences(tenantSlug, userId);
        const serverProfile = data.preferences?.profile
        const fromPrefs = {
          ...local.profile,
          ...(serverProfile ?? {}),
        };

        setProfileName(
          fromPrefs.displayName ||
            data.profile_name ||
            session?.user?.name ||
            session?.user?.email?.split("@")[0] ||
            "",
        );
        setProfileHandle(
          (fromPrefs.handle || data.profile_handle || session?.user?.email?.split("@")[0] || "").replace(
            /^@/,
            "",
          ),
        );
        setProfileBio((fromPrefs.bio || "").slice(0, BIO_MAX));
        setActiveProvider(
          (data.preferences?.ai?.activeProvider ||
            data.active_provider ||
            "claude") as ProviderId,
        );
        setProviderState(
          mapProviders(
            (data.preferences?.ai?.providers as ApiSettings["providers"]) ||
              data.providers ||
              {},
          ),
        );
        setDebugLogs(data.debug_logs ?? true);
        setNaturalLanguage(
          data.preferences?.ai?.naturalLanguage ?? data.natural_language ?? true,
        );
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load settings.");
          const local = loadPreferences(tenantSlug, userId);
          setProfileName(
            local.profile.displayName ||
              session?.user?.name ||
              session?.user?.email?.split("@")[0] ||
              "",
          );
          setProfileHandle(
            (local.profile.handle || session?.user?.email?.split("@")[0] || "").replace(/^@/, ""),
          );
          setProfileBio((local.profile.bio || "").slice(0, BIO_MAX));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadSettings();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.email, session?.user?.name, session?.user?.id, tenantSlug, userId]);

  const selectedProvider = useMemo(
    () => PROVIDERS.find((provider) => provider.id === activeProvider) || PROVIDERS[0],
    [activeProvider],
  );

  async function handleSaveSettings(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setSavePhase("settings");
    setSuccess(false);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const bio = profileBio.trim().slice(0, BIO_MAX);
      const handle = profileHandle.trim().replace(/^@/, "");

      // Persist full preferences document to Postgres (profile + AI settings)
      const current = loadPreferences(tenantSlug, userId);
      const nextPrefs = {
        ...current,
        profile: {
          ...current.profile,
          displayName: profileName.trim(),
          handle,
          bio,
        },
        ai: {
          ...current.ai,
          activeProvider: activeProvider as typeof current.ai.activeProvider,
          naturalLanguage,
          providers: current.ai.providers,
        },
      };
      savePreferences(tenantSlug, userId, nextPrefs);
      if (prefs?.setPrefs) {
        prefs.setPrefs(nextPrefs);
      }

      const settingsResponse = await fetch("/api/me/settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: nextPrefs,
          merge: true,
          tenantId: tenantSlug || undefined,
        }),
      });

      if (!settingsResponse.ok) {
        const payload = (await settingsResponse.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(payload?.detail || "Failed to save settings to the server.");
      }

      const saved = (await settingsResponse.json()) as ApiSettings & {
        preferences?: { ai?: { providers?: ApiSettings["providers"] } }
      };
      setProviderState(
        mapProviders(
          saved.preferences?.ai?.providers || saved.providers || {},
        ),
      );

      if (apiKeyDraft.trim()) {
        setSavePhase("validating");
        setStatusMessage(`Validating ${selectedProvider.shortName} key with the provider and running an LLM smoke test…`);

        const providerResponse = await fetch(`/api/me/providers/${activeProvider}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ api_key: apiKeyDraft.trim() }),
        });

        if (!providerResponse.ok) {
          const payload = (await providerResponse.json().catch(() => null)) as { detail?: string } | null;
          throw new Error(payload?.detail || `${selectedProvider.shortName} validation failed.`);
        }

        const providerResult = (await providerResponse.json()) as {
          key_preview: string;
          message: string;
        };

        setProviderState((current) => ({
          ...current,
          [activeProvider]: {
            configured: true,
            keyPreview: providerResult.key_preview,
          },
        }));
        setApiKeyDraft("");
        setStatusMessage(
          `${providerResult.message} Run bevel auth sync --pull in your terminal to use this key locally.`,
        );
      } else {
        setStatusMessage("Settings saved to your BEVEL account.");
      }

      setSuccess(true);
      window.setTimeout(() => setSuccess(false), 4000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Save failed.");
    } finally {
      setIsSaving(false);
      setSavePhase("idle");
    }
  }

  async function handleTestProvider() {
    setIsTesting(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch(`/api/me/providers/${activeProvider}/test`, {
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        detail?: string;
        message?: string;
        smoke_response?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.detail || "Provider test failed.");
      }
      setStatusMessage(
        payload?.smoke_response
          ? `${payload.message} Response: ${payload.smoke_response}`
          : payload?.message || "Provider validated for LLM calls.",
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Provider test failed.");
    } finally {
      setIsTesting(false);
    }
  }

  async function handleRemoveProvider() {
    setIsRemoving(true);
    setErrorMessage("");
    setStatusMessage("");
    try {
      const response = await fetch(`/api/me/providers/${activeProvider}`, {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as { detail?: string; message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.detail || "Failed to remove provider key.");
      }
      setProviderState((current) => ({
        ...current,
        [activeProvider]: { configured: false, keyPreview: "" },
      }));
      setApiKeyDraft("");
      setStatusMessage(payload?.message || `${selectedProvider.shortName} removed from your account.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to remove provider key.");
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <div className="flex flex-col justify-between gap-4 border-b border-border/40 pb-5 lg:flex-row lg:items-center">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-bold gradient-text">
            <Settings className="h-8 w-8 text-primary-400" />
            Settings
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
            Profile and runtime preferences are stored on your BEVEL account. Provider keys are validated
            against the provider API, checked with a live LLM call, then encrypted server-side.
          </p>
        </div>

        <Link
          href={"/auth/cli" as Route}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary-500/40 px-4 py-2 text-sm font-semibold text-primary-300 transition hover:bg-primary-500/10"
        >
          <ShieldCheck className="h-4 w-4" />
          Command-line permission
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 rounded-lg border border-border/70 bg-surface/30 px-4 py-6 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading account settings…
        </div>
      ) : (
        <form onSubmit={handleSaveSettings} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            <section
              id="profile"
              className="rounded-lg border border-border/80 bg-surface/30 p-5"
            >
              <h2 className="flex items-center gap-2 border-b border-border/40 pb-3 text-sm font-bold text-text">
                <User className="h-5 w-5 text-primary-400" />
                Profile
                <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-text-faint">
                  h-card · schema.org/Person
                </span>
              </h2>

              <p className="mt-3 text-xs leading-5 text-text-muted">
                Public identity for teammates and agents. Short bio uses the same length as X
                (Twitter) — 280 characters — and is published as microformats2{" "}
                <code className="font-mono text-primary-300">p-note</code> / schema.org{" "}
                <code className="font-mono text-primary-300">description</code>.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-xs font-medium text-text-muted">
                    Display name{" "}
                    <span className="font-mono text-text-faint">(p-name)</span>
                  </span>
                  <input
                    type="text"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text outline-none focus:border-primary-500"
                    required
                    autoComplete="name"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-xs font-medium text-text-muted">
                    Handle{" "}
                    <span className="font-mono text-text-faint">(p-nickname)</span>
                  </span>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-text-faint">
                      @
                    </span>
                    <input
                      type="text"
                      value={profileHandle}
                      onChange={(event) =>
                        setProfileHandle(event.target.value.replace(/^@/, ""))
                      }
                      className="w-full rounded-lg border border-border bg-background py-2 pl-7 pr-3 font-mono text-sm text-text outline-none focus:border-primary-500"
                      required
                      autoComplete="username"
                    />
                  </div>
                </label>
              </div>

              <label id="profile-bio" className="mt-4 block space-y-2 scroll-mt-24">
                <span className="flex items-center justify-between text-xs font-medium text-text-muted">
                  <span>
                    Bio{" "}
                    <span className="font-mono text-text-faint">(p-note)</span>
                  </span>
                  <span
                    className={
                      profileBio.length >= BIO_MAX
                        ? "font-mono text-amber-400"
                        : "font-mono text-text-faint"
                    }
                  >
                    {profileBio.length}/{BIO_MAX}
                  </span>
                </span>
                <textarea
                  value={profileBio}
                  onChange={(event) =>
                    setProfileBio(event.target.value.slice(0, BIO_MAX))
                  }
                  maxLength={BIO_MAX}
                  rows={3}
                  placeholder="One or two lines — who you are, what you ship, how agents should address you."
                  className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm leading-relaxed text-text outline-none focus:border-primary-500"
                />
                <span className="block text-[11px] leading-4 text-text-faint">
                  Same length as an X bio. Shows on your public h-card and feeds agent context.
                </span>
              </label>

              <div className="mt-5">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-faint">
                  Live h-card preview
                </p>
                <HCardProfile
                  displayName={profileName}
                  handle={profileHandle}
                  bio={profileBio}
                  email={session?.user?.email}
                  emailPublic={false}
                  photoUrl={session?.user?.image || undefined}
                  socials={{
                    x: "",
                    instagram: "",
                    tiktok: "",
                    youtube: "",
                  }}
                />
              </div>
            </section>

            <section className="rounded-lg border border-border/80 bg-surface/30 p-5">
              <h2 className="flex items-center gap-2 border-b border-border/40 pb-3 text-sm font-bold text-text">
                <Brain className="h-5 w-5 text-secondary-400" />
                AI providers
              </h2>

              <p className="mt-4 text-xs leading-5 text-text-muted">
                Enter a key and save. bevel validates it with the provider, runs a short LLM request, then
                stores it encrypted on your account. After saving, run{" "}
                <code className="font-mono text-primary-300">bevel auth sync --pull</code> in your terminal
                to use the key with <code className="font-mono text-primary-300">bevel ai ask</code>.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5">
                {PROVIDERS.map((provider) => {
                  const isActive = provider.id === activeProvider;
                  const isConfigured = providerState[provider.id].configured;
                  return (
                    <button
                      type="button"
                      key={provider.id}
                      onClick={() => setActiveProvider(provider.id)}
                      className={`min-h-36 rounded-lg border p-4 text-left transition ${
                        isActive
                          ? "border-primary-500/50 bg-primary-500/10"
                          : "border-border/70 bg-background/60 hover:border-border hover:bg-surface"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Sparkles className={isActive ? "h-5 w-5 text-primary-400" : "h-5 w-5 text-text-faint"} />
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                            isConfigured ? "bg-success/10 text-success" : "bg-surface text-text-faint"
                          }`}
                        >
                          {isConfigured ? "Configured" : "Missing"}
                        </span>
                      </div>
                      <div className="mt-4 text-sm font-bold text-text">{provider.name}</div>
                      <div className="mt-2 text-xs leading-5 text-text-muted">{provider.description}</div>
                    </button>
                  );
                })}
              </div>

              {selectedProvider.signupUrl ? (
                <p className="mt-4 text-xs text-text-muted">
                  Need a {selectedProvider.shortName} key?{" "}
                  <a
                    href={selectedProvider.signupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-primary-400 hover:underline"
                  >
                    Open {selectedProvider.signupUrl.replace(/^https?:\/\//, "")}
                  </a>
                </p>
              ) : null}

              <label className="mt-5 block space-y-2">
                <span className="text-xs font-medium text-text-muted">{selectedProvider.shortName} API key</span>
                <div className="relative">
                  <input
                    type={revealAiKey ? "text" : "password"}
                    value={apiKeyDraft}
                    onChange={(event) => setApiKeyDraft(event.target.value)}
                    placeholder={providerState[activeProvider].keyPreview || selectedProvider.keyHint}
                    className="w-full rounded-lg border border-border bg-background py-2 pl-3 pr-10 font-mono text-sm text-text outline-none focus:border-primary-500"
                  />
                  <button
                    type="button"
                    onClick={() => setRevealAiKey(!revealAiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-faint hover:text-text"
                    aria-label={revealAiKey ? "Hide API key" : "Reveal API key"}
                  >
                    {revealAiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {providerState[activeProvider].configured && !apiKeyDraft && (
                  <p className="text-xs text-text-muted">
                    Stored key: <span className="font-mono">{providerState[activeProvider].keyPreview}</span>
                  </p>
                )}
              </label>

              {providerState[activeProvider].configured && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleTestProvider}
                    disabled={isTesting || isRemoving}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-text-muted transition hover:border-primary-500/40 hover:text-text disabled:opacity-50"
                  >
                    {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 text-primary-400" />}
                    {isTesting ? "Testing…" : "Test connection"}
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveProvider}
                    disabled={isTesting || isRemoving}
                    className="inline-flex items-center gap-2 rounded-lg border border-error/30 px-3 py-2 text-xs font-semibold text-error transition hover:bg-error/10 disabled:opacity-50"
                  >
                    {isRemoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    {isRemoving ? "Removing…" : "Remove key"}
                  </button>
                </div>
              )}
            </section>

            <section className="rounded-lg border border-border/80 bg-surface/30 p-5">
              <h2 className="flex items-center gap-2 border-b border-border/40 pb-3 text-sm font-bold text-text">
                <Sliders className="h-5 w-5 text-accent-500" />
                Runtime flags
              </h2>

              <div className="mt-4 divide-y divide-border/30">
                <ToggleRow
                  label="Natural language dispatch"
                  description="Route plain English prompts through provider-aware command matching."
                  enabled={naturalLanguage}
                  onClick={() => setNaturalLanguage(!naturalLanguage)}
                />
                <ToggleRow
                  label="Verbose terminal logs"
                  description="Show command matching and provider resolution details in local runs."
                  enabled={debugLogs}
                  onClick={() => setDebugLogs(!debugLogs)}
                />
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-lg border border-border/80 bg-surface/30 p-5">
              <h2 className="flex items-center gap-2 text-sm font-bold text-text">
                <KeyRound className="h-5 w-5 text-primary-400" />
                Account
              </h2>

              <div className="mt-4 rounded-lg border border-border/70 bg-background p-4">
                {session?.user?.email ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-success">
                      <Check className="h-4 w-4" />
                      Signed in
                    </div>
                    <div className="space-y-1 text-xs text-text-muted">
                      <div>{session.user.email}</div>
                      <div>{session.user.name || "No display name"}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm font-semibold text-warning">Not signed in</div>
                )}
              </div>
            </section>

            <section className="rounded-lg border border-border/80 bg-surface/30 p-5">
              <h2 className="text-sm font-bold text-text">Provider order</h2>
              <div className="mt-4 space-y-2">
                {PROVIDERS.map((provider, index) => (
                  <div
                    key={provider.id}
                    className="flex items-center justify-between rounded-md border border-border/60 bg-background px-3 py-2"
                  >
                    <span className="text-xs text-text-muted">
                      {index + 1}. {provider.name}
                    </span>
                    <span className="font-mono text-[10px] text-text-faint">{provider.id}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <div className="flex flex-wrap items-center gap-4 border-t border-border/30 pt-5 lg:col-span-2">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-5 py-2.5 text-sm font-bold text-background transition hover:bg-primary-400 disabled:opacity-50"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : success ? (
                <Check className="h-4 w-4" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {isSaving
                ? savePhase === "validating"
                  ? "Validating key…"
                  : "Saving…"
                : success
                  ? "Saved"
                  : "Save settings"}
            </button>

            {success && <span className="text-xs font-medium text-success">Saved to your BEVEL account.</span>}
            {statusMessage && <span className="text-xs font-medium text-text-muted">{statusMessage}</span>}
            {errorMessage && <span className="text-xs font-medium text-error">{errorMessage}</span>}
          </div>
        </form>
      )}
    </div>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  onClick,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <div className="text-sm font-semibold text-text">{label}</div>
        <div className="mt-1 text-xs leading-5 text-text-muted">{description}</div>
      </div>
      <button
        type="button"
        onClick={onClick}
        className={`relative h-6 w-11 rounded-full border p-0.5 transition ${
          enabled ? "border-primary-500 bg-primary-500/20" : "border-border bg-background"
        }`}
        aria-label={label}
      >
        <span
          className={`block h-4 w-4 rounded-full transition ${
            enabled ? "translate-x-5 bg-primary-400" : "bg-text-muted"
          }`}
        />
      </button>
    </div>
  );
}