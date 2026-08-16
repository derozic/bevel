"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Command } from 'cmdk';
import {
  Activity,
  BookOpen,
  Command as CommandIcon,
  Download,
  ExternalLink,
  FileText,
  Gauge,
  GitBranch,
  Home,
  KeyRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageSquare,
  Moon,
  Package,
  Play,
  Search,
  Settings,
  Sparkles,
  Sun,
  Sunrise,
  Terminal,
  TimerReset,
  Users,
  Zap,
} from "lucide-react";

import { useDaypart } from "@/components/console/daypart-provider";
import { daypartOrder, type Daypart } from "@/components/console/daypart";
import { trackWebEvent } from "@/components/console/track";
import { bevelUrls } from "@/components/console/bevel-urls";

type PaletteItem = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  keywords?: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  run: () => void;
};

type PaletteContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

const PaletteContext = createContext<PaletteContextValue | null>(null);

const RECENT_KEY = "bevel.command-palette.recent";
const MAX_RECENT = 6;

export function useCommandPalette() {
  const ctx = useContext(PaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  }
  return ctx;
}

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    setOpen((v) => !v);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K — always toggle (capture phase so nothing steals it)
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        e.stopPropagation();
        setOpen((v) => !v);
        return;
      }
      // Escape closes when open
      if (e.key === "Escape" && open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const value = useMemo(
    () => ({ open, setOpen, toggle }),
    [open, toggle],
  );

  return (
    <PaletteContext.Provider value={value}>
      {children}
      <CommandPalette />
    </PaletteContext.Provider>
  );
}

function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function pushRecent(id: string) {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, MAX_RECENT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

const daypartIcons: Record<Daypart, typeof Sun> = {
  dawn: Sunrise,
  day: Sun,
  dusk: Sparkles,
  night: Moon,
};

function CommandPalette() {
  const { open, setOpen } = useCommandPalette();
  const { setDaypart, setUseAuto } = useDaypart();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setRecent(readRecent());
      // Focus after paint
      const t = window.setTimeout(() => inputRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
  }, [open]);

  const go = useCallback(
    (path: string) => {
      // Soft client navigation only — never window.location (that caused partial reloads)
      setOpen(false);
      setQuery("");
      // Navigate after React paints the closed state (avoids partial-refresh thrash)
      window.setTimeout(() => {
        router.push(path as never);
      }, 0);
    },
    [router, setOpen],
  );

  const openExternal = useCallback(
    (url: string) => {
      setOpen(false);
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [setOpen],
  );

  const items = useMemo((): PaletteItem[] => {
    const authed = Boolean(session?.user?.email);
    const list: PaletteItem[] = [
      {
        id: "home",
        label: "Home",
        group: "Navigate",
        icon: Home,
        keywords: "landing marketing",
        run: () => go("/"),
      },
      {
        id: "playground",
        label: "Playground",
        group: "Navigate",
        icon: Play,
        keywords: "demo terminal try",
        run: () => go("/playground"),
      },
      {
        id: "docs",
        label: "Docs",
        group: "Navigate",
        icon: BookOpen,
        keywords: "documentation help guide",
        run: () => go("/docs"),
      },
      {
        id: "docs-cli",
        label: "CLI reference",
        group: "Navigate",
        icon: Terminal,
        keywords: "commands bevel go auth desk",
        run: () => go("/docs/cli"),
      },
      {
        id: "docs-desk",
        label: "Desk pack & recover",
        group: "Navigate",
        icon: Package,
        keywords: "backup wipe rebuild",
        run: () => go("/docs/desk"),
      },
      {
        id: "docs-bridge",
        label: "CLI bridge & auth",
        group: "Navigate",
        icon: Zap,
        keywords: "pro bridge oauth token",
        run: () => go("/docs/bridge"),
      },
      {
        id: "pricing",
        label: "Pricing",
        group: "Navigate",
        icon: Sparkles,
        keywords: "plans billing",
        run: () => go("/pricing"),
      },
      {
        id: "download",
        label: "Download / install",
        group: "Navigate",
        icon: Download,
        keywords: "install brew macos app silicon arm64 zip menu bar",
        run: () => go("/download"),
      },
      {
        id: "download-mac-app",
        label: "Download Mac app (Apple Silicon)",
        group: "Navigate",
        icon: Download,
        keywords: "bevel.app menu bar silicon m1 m2 m3 arm64",
        run: () => {
          window.location.href = "/downloads/BEVEL-macos-arm64.zip";
        },
      },
      {
        id: "start",
        label: "Get started",
        group: "Navigate",
        icon: Zap,
        keywords: "onboarding setup",
        run: () => go("/start"),
      },
      {
        id: "workspace-chat",
        label: "Back to chat",
        group: "Workspace",
        icon: MessageSquare,
        keywords: "channel general fleet conversation leave console",
        hint: "⌘H",
        run: () => {
          setOpen(false);
          window.location.assign(bevelUrls.workspaceChat());
        },
      },
      {
        id: "dashboard",
        label: "Terminal",
        group: "Workspace",
        icon: Terminal,
        keywords: "dashboard console shell",
        hint: "⌘T",
        run: () => go("/console"),
      },
      {
        id: "workflows",
        label: "Workflows",
        group: "Workspace",
        icon: GitBranch,
        keywords: "pipeline automation",
        run: () => go("/console/workflows"),
      },
      {
        id: "org",
        label: "Agent org",
        group: "Workspace",
        icon: Users,
        keywords: "org chart hierarchy diamond fleet agents",
        run: () => go("/console/org"),
      },
      {
        id: "status",
        label: "Status",
        group: "Workspace",
        icon: Activity,
        keywords: "health uptime metrics",
        hint: "⌘S",
        run: () => go("/console/status"),
      },
      {
        id: "commands",
        label: "Command catalog",
        group: "Workspace",
        icon: CommandIcon,
        keywords: "list registry",
        run: () => go("/console/commands"),
      },
      {
        id: "integrations",
        label: "Integrations",
        group: "Workspace",
        icon: Package,
        keywords: "plugins connect",
        hint: "⌘I",
        run: () => go("/console/integrations"),
      },
      {
        id: "api-keys",
        label: "API keys & providers",
        group: "Workspace",
        icon: KeyRound,
        keywords: "secrets openai anthropic",
        hint: "⌘A",
        run: () => go("/console/api-keys"),
      },
      {
        id: "settings",
        label: "Settings",
        group: "Workspace",
        icon: Settings,
        keywords: "preferences account",
        shortcut: "⌘,",
        run: () => go("/console/settings"),
      },
      {
        id: "console",
        label: "Console (legacy)",
        group: "Workspace",
        icon: LayoutDashboard,
        keywords: "console signup",
        run: () => go("/console"),
      },
      {
        id: "cli-health",
        label: "CLI: go health",
        group: "Execution",
        hint: "bevel go health",
        icon: Gauge,
        keywords: "caddy postgres colyseus green stack",
        run: () => openExternal("https://api.bevel.is/docs/docs/cli#go"),
      },
      {
        id: "cli-auth",
        label: "CLI: auth login",
        group: "Execution",
        hint: "bevel auth login",
        icon: LogIn,
        keywords: "workspace google oauth",
        run: () => go("/auth/cli"),
      },
      {
        id: "cli-desk",
        label: "CLI: desk pack",
        group: "Execution",
        hint: "bevel desk pack",
        icon: Package,
        keywords: "backup encrypt recover",
        run: () => openExternal("https://api.bevel.is/docs/docs/desk"),
      },
      {
        id: "api-health",
        label: "API health",
        group: "Execution",
        icon: ExternalLink,
        keywords: "api.bevel.dev ping",
        run: () => openExternal("https://api.bevel.dev/api/health"),
      },
      {
        id: "api-docs",
        label: "OpenAPI docs",
        group: "Execution",
        icon: FileText,
        keywords: "swagger redoc",
        run: () => openExternal("https://api.bevel.dev/api/docs"),
      },
      {
        id: "storybook",
        label: "Storybook",
        group: "Execution",
        icon: Sparkles,
        keywords: "ui components",
        run: () => openExternal("https://storybook.bevel.dev"),
      },
      {
        id: "metrics",
        label: "Metrics",
        group: "Execution",
        icon: Gauge,
        keywords: "observability prometheus",
        run: () => openExternal("https://metrics.bevel.dev"),
      },
      ...daypartOrder.map((part) => ({
        id: `daypart-${part}`,
        label: `Theme: ${part}`,
        group: "Appearance",
        icon: daypartIcons[part],
        keywords: `daypart day night dusk dawn theme ${part}`,
        run: () => {
          setOpen(false);
          setDaypart(part);
        },
      })),
      {
        id: "daypart-auto",
        label: "Theme: Auto (clock)",
        group: "Appearance",
        icon: TimerReset,
        keywords: "daypart auto clock follow",
        run: () => {
          setOpen(false);
          setUseAuto(true);
        },
      },
    ];

    if (status !== "loading") {
      if (authed) {
        list.push({
          id: "signout",
          label: `Sign out${session?.user?.email ? ` (${session.user.email})` : ""}`,
          group: "Account",
          icon: LogOut,
          run: () => {
            setOpen(false);
            void signOut({ callbackUrl: "https://bevel.is/login" });
          },
        });
      } else {
        list.push({
          id: "signin",
          label: "Sign in with Google Workspace",
          group: "Account",
          icon: LogIn,
          keywords: "login oauth",
          run: () => {
            setOpen(false);
            const returnTo = new URL("/console", window.location.origin).href;
            // Direct Workspace OAuth — skip NextAuth interstitial / sign-in page.
            window.location.href = `/auth/google?return_to=${encodeURIComponent(returnTo)}`;
          },
        });
      }
    }

    return list;
  }, [
    go,
    openExternal,
    session?.user?.email,
    setDaypart,
    setUseAuto,
    setOpen,
    status,
  ]);

  const byId = useMemo(() => {
    const m = new Map<string, PaletteItem>();
    for (const item of items) m.set(item.id, item);
    return m;
  }, [items]);

  const recentItems = recent
    .map((id) => byId.get(id))
    .filter((x): x is PaletteItem => Boolean(x));

  const groups = useMemo(() => {
    const order = [
      "Navigate",
      "Workspace",
      "Execution",
      "Appearance",
      "Account",
    ];
    const map = new Map<string, PaletteItem[]>();
    for (const item of items) {
      const arr = map.get(item.group) ?? [];
      arr.push(item);
      map.set(item.group, arr);
    }
    return order
      .filter((g) => map.has(g))
      .map((g) => ({ name: g, items: map.get(g)! }));
  }, [items]);

  const runItem = (item: PaletteItem) => {
    // Close first so UI never sticks open across soft navigations
    setOpen(false);
    pushRecent(item.id);
    setRecent(readRecent());
    trackWebEvent("playground_command_run", {
      source: "command_palette",
      command_id: item.id,
    });
    // Defer action one tick so close commit lands before route change
    window.setTimeout(() => {
      item.run();
    }, 0);
  };

  // Hide full-group duplicates when showing Recent (items still searchable via query)
  const showRecent = !query && recentItems.length > 0;

  // When closed, unmount immediately (no exit linger) so soft-nav never fights a ghost overlay
  if (!open) {
    return null;
  }

  return (
        <div
          key="command-palette-root"
          className="fixed inset-0 z-[200] flex items-start justify-center bg-[#05050a]/75 px-4 pt-[12vh] backdrop-blur-md animate-in fade-in duration-100"
          onClick={() => setOpen(false)}
          role="presentation"
          data-testid="command-palette-overlay"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            data-testid="command-palette"
            className="w-full max-w-xl overflow-hidden rounded-2xl border border-[#2a2a3a] bg-[#0c0c14] shadow-[0_24px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(0,200,255,0.06)]"
            style={{
              animation: "bevel-palette-in 140ms cubic-bezier(0.16, 1, 0.3, 1)",
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                setOpen(false);
              }
            }}
          >
            <Command
              label="Command palette"
              className="flex flex-col font-mono"
              loop
              shouldFilter
              // cmdk filters by value on items
            >
              {/* chrome titlebar */}
              <div className="flex items-center gap-2 border-b border-[#2a2a3a] px-3 py-2">
                <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
                <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
                <span className="h-2 w-2 rounded-full bg-[#28c840]" />
                <span className="ml-1.5 text-[10px] text-[#6b6b80]">
                  bevel — command palette
                </span>
              </div>

              <div className="flex items-center gap-3 border-b border-[#2a2a3a] px-4 py-3">
                <Search className="h-4 w-4 shrink-0 text-cyan-400/80" />
                <Command.Input
                  ref={inputRef as never}
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Type a command, page, or intent…"
                  className="w-full bg-transparent text-[15px] text-[#e8e8f0] outline-none placeholder:text-[#5a5a70]"
                  data-testid="command-palette-input"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      e.preventDefault();
                      e.stopPropagation();
                      setOpen(false);
                    }
                  }}
                />
                <button
                  type="button"
                  className="rounded border border-[#2a2a3a] bg-[#12121c] px-1.5 py-0.5 text-[10px] text-[#6b6b80] hover:border-cyan-500/40 hover:text-cyan-300"
                  onClick={() => setOpen(false)}
                  aria-label="Close command palette"
                  data-testid="command-palette-close"
                >
                  esc
                </button>
              </div>

              <Command.List
                className="max-h-[min(420px,55vh)] overflow-y-auto overscroll-contain p-2"
                data-testid="command-palette-list"
              >
                <Command.Empty className="px-4 py-8 text-center text-sm text-[#6b6b80]">
                  No matches for{" "}
                  <span className="text-cyan-400/90">&quot;{query}&quot;</span>
                  <p className="mt-2 text-xs text-[#4a4a5c]">
                    Try dashboard, docs, health, or sign in
                  </p>
                </Command.Empty>

                {showRecent ? (
                  <Command.Group
                    heading="Recent"
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[#5a5a70]"
                  >
                    {recentItems.map((item) => (
                      <PaletteRow
                        key={`recent-${item.id}`}
                        item={item}
                        valuePrefix="recent"
                        onSelect={() => runItem(item)}
                      />
                    ))}
                  </Command.Group>
                ) : null}

                {groups.map((group) => (
                  <Command.Group
                    key={group.name}
                    heading={group.name}
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[#5a5a70]"
                  >
                    {group.items
                      .filter((item) =>
                        showRecent ? !recent.includes(item.id) : true,
                      )
                      .map((item) => (
                        <PaletteRow
                          key={item.id}
                          item={item}
                          onSelect={() => runItem(item)}
                        />
                      ))}
                  </Command.Group>
                ))}
              </Command.List>

              <div className="flex items-center justify-between border-t border-[#2a2a3a] px-4 py-2 text-[10px] text-[#5a5a70]">
                <span className="flex items-center gap-2">
                  <Terminal className="h-3 w-3 text-cyan-500/70" />
                  soft navigate · no full reload
                </span>
                <span className="flex items-center gap-2">
                  <kbd className="rounded bg-[#12121c] px-1 py-0.5">↑↓</kbd>
                  move
                  <kbd className="rounded bg-[#12121c] px-1 py-0.5">↵</kbd>
                  run
                  <kbd className="rounded bg-[#12121c] px-1 py-0.5">⌘K</kbd>
                  toggle
                </span>
              </div>
            </Command>
          </div>
          <style
            dangerouslySetInnerHTML={{
              __html: `@keyframes bevel-palette-in{from{opacity:0;transform:translateY(8px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}`,
            }}
          />
        </div>
  );
}

function PaletteRow({
  item,
  onSelect,
  valuePrefix,
}: {
  item: PaletteItem;
  onSelect: () => void;
  valuePrefix?: string;
}) {
  const Icon = item.icon;
  // Unique value for cmdk (recent rows share labels with group rows)
  const value = [
    valuePrefix,
    item.id,
    item.label,
    item.hint ?? "",
    item.keywords ?? "",
    item.group,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-[#c8c8d8] outline-none aria-selected:bg-cyan-500/10 aria-selected:text-[#e8e8f0] data-[selected=true]:bg-cyan-500/10 data-[selected=true]:text-[#e8e8f0]"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#2a2a3a] bg-[#12121c] text-[#8a8aa0] group-data-[selected=true]:border-cyan-500/30 group-data-[selected=true]:text-cyan-300 group-aria-selected:border-cyan-500/30 group-aria-selected:text-cyan-300">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{item.label}</span>
        {item.hint ? (
          <span className="block truncate font-mono text-[11px] text-[#5a5a70]">
            {item.hint}
          </span>
        ) : null}
      </span>
      {item.shortcut ? (
        <kbd className="rounded border border-[#2a2a3a] bg-[#12121c] px-1.5 py-0.5 text-[10px] text-[#6b6b80]">
          {item.shortcut}
        </kbd>
      ) : (
        <kbd className="rounded border border-transparent px-1.5 py-0.5 text-[10px] text-[#4a4a5c] opacity-0 group-data-[selected=true]:opacity-100 group-aria-selected:opacity-100">
          ↵
        </kbd>
      )}
    </Command.Item>
  );
}
