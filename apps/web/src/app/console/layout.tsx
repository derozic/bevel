"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Terminal,
  Settings,
  Activity,
  Package,
  Key,
  Command,
  Menu,
  Search,
  GitBranch,
  BookOpen,
  MessageSquare,
  ArrowLeft,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";

import { UserAvatar } from "@/components/console/user-avatar";
import { useCommandPalette } from "@/components/console/command-palette";
import { DayNightBadge } from "@/components/console/day-night-badge";
import { bevelUrls } from "@/components/console/bevel-urls";

interface NavigationItem {
  name: string;
  href: string;
  icon: typeof Terminal;
  shortcut: string;
}

const navigation: NavigationItem[] = [
  { name: "Overview", href: "/console", icon: Terminal, shortcut: "⌘T" },
  { name: "Settings", href: "/console/settings", icon: Settings, shortcut: "⌘," },
  { name: "Integrations", href: "/console/integrations", icon: Package, shortcut: "⌘I" },
  { name: "API Keys", href: "/console/api-keys", icon: Key, shortcut: "⌘A" },
  { name: "Workflows", href: "/console/workflows", icon: GitBranch, shortcut: "⌘W" },
  { name: "Status", href: "/console/status", icon: Activity, shortcut: "⌘S" },
  { name: "Commands", href: "/console/commands", icon: Command, shortcut: "⌘C" },
  { name: "API Docs", href: "/console/docs", icon: BookOpen, shortcut: "⌘D" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const { setOpen: setPaletteOpen } = useCommandPalette();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chatHref = useMemo(() => bevelUrls.workspaceChat(), []);

  const user = session?.user?.email
    ? {
        email: session.user.email,
        name: session.user.name ?? undefined,
        picture: session.user.image ?? undefined,
      }
    : undefined;

  const softGo = useCallback(
    (path: string) => {
      router.push(path);
    },
    [router],
  );

  const goToChat = useCallback(() => {
    // Full navigation so cross-host (bevel.is → bevel.2x4m.cc) always works.
    window.location.assign(chatHref);
  }, [chatHref]);

  // Dashboard-only shortcuts (⌘B sidebar, nav keys). ⌘K is owned by CommandPaletteProvider.
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;

      // Let the global palette own ⌘K / Ctrl+K
      if (e.key === "k" || e.key === "K") return;

      if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        setSidebarOpen((v) => !v);
        return;
      }

      // ⌘H / Ctrl+H → leave console for workspace chat
      if (e.key === "h" || e.key === "H") {
        e.preventDefault();
        goToChat();
        return;
      }

      switch (e.key) {
        case "t":
        case "T":
          e.preventDefault();
          softGo("/console");
          break;
        case "s":
        case "S":
          e.preventDefault();
          softGo("/console/status");
          break;
        case "i":
        case "I":
          e.preventDefault();
          softGo("/console/integrations");
          break;
        case "a":
        case "A":
          e.preventDefault();
          softGo("/console/api-keys");
          break;
        case ",":
          e.preventDefault();
          softGo("/console/settings");
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [softGo, goToChat]);

  return (
    <div className="min-h-screen bg-background text-text">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 glass border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-surface transition-colors"
              aria-label="Toggle sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link href="/console" className="flex items-center gap-2">
              <Terminal className="w-6 h-6 text-accent" />
              <span className="font-bold text-lg text-accent">BEVEL</span>
            </Link>

            <a
              href={chatHref}
              onClick={(e) => {
                e.preventDefault();
                goToChat();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-accent/90 sm:gap-2 sm:px-3 sm:text-sm"
              data-testid="console-back-to-chat"
              title="Leave console and open workspace chat (~general)"
            >
              <ArrowLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
              <MessageSquare className="hidden h-4 w-4 sm:inline" aria-hidden />
              <span className="hidden sm:inline">Back to chat</span>
              <span className="sm:hidden">Chat</span>
            </a>
          </div>

          <div className="flex items-center gap-3">
            <DayNightBadge />

            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg glass text-sm hover:bg-surface transition-colors"
              data-testid="dashboard-command-palette"
              aria-label="Open command palette"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Search...</span>
              <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs rounded bg-surface">
                ⌘K
              </kbd>
            </button>

            {user ? <UserAvatar user={user} /> : null}
          </div>
        </div>
      </header>

      <div className="flex pt-14">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.aside
              initial={{ x: -250 }}
              animate={{ x: 0 }}
              exit={{ x: -250 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-14 bottom-0 w-64 glass border-r border-border z-30 overflow-y-auto"
            >
              <div className="p-4 pb-2">
                <a
                  href={chatHref}
                  onClick={(e) => {
                    e.preventDefault();
                    goToChat();
                  }}
                  className="flex items-center justify-between rounded-lg border border-accent/40 bg-accent/15 px-3 py-2.5 text-accent transition hover:bg-accent/25"
                  data-testid="console-sidebar-back-to-chat"
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="h-5 w-5" />
                    <span className="font-semibold">Back to chat</span>
                  </div>
                  <kbd className="px-1.5 py-0.5 text-xs rounded bg-surface text-text-muted">
                    ⌘H
                  </kbd>
                </a>
                <p className="mt-2 px-1 text-[11px] leading-snug text-text-muted">
                  Open ~general in your workspace. Console is settings only.
                </p>
              </div>

              <nav className="p-4 pt-2 space-y-1">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`
                        flex items-center justify-between px-3 py-2 rounded-lg transition-all
                        ${
                          isActive
                            ? "bg-accent/20 text-accent border border-accent/30"
                            : "hover:bg-surface text-text-muted hover:text-text"
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <item.icon className="w-5 h-5" />
                        <span className="font-medium">{item.name}</span>
                      </div>
                      <kbd className="px-1.5 py-0.5 text-xs rounded bg-surface">
                        {item.shortcut}
                      </kbd>
                    </Link>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-border">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Quick Stats
                </h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-muted">Commands Run</span>
                    <span className="text-sm font-mono text-accent">1,337</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-muted">API Calls</span>
                    <span className="text-sm font-mono text-secondary-400">42,069</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-muted">Uptime</span>
                    <span className="text-sm font-mono text-success">99.9%</span>
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-border">
                <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                  Shortcuts
                </h3>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Back to chat</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-surface">⌘H</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Toggle Sidebar</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-surface">⌘B</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Command Palette</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-surface">⌘K</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Settings</span>
                    <kbd className="px-1.5 py-0.5 rounded bg-surface">⌘,</kbd>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        <main className={`flex-1 transition-all ${sidebarOpen ? "ml-64" : "ml-0"}`}>
          <div className="p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
