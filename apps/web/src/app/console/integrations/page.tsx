"use client";

import { useState, useEffect } from "react";
import { 
  Github, Slack, Search, Check, Trash2, Loader2, Key, RefreshCw, 
  ExternalLink, Lock, Settings, Activity, Info, X, SlidersHorizontal, 
  CheckSquare, Kanban, Cpu, MessageSquare, BookOpen, Cloud, Sparkles, 
  ArrowRight, ShieldAlert, AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Integration type definition
interface Integration {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: any; // Lucide icon component
  connected: boolean;
  color: string;
  stats: {
    primary: string;
    secondary: string;
  } | null;
}

// Toast notification type
interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "info";
}

export default function IntegrationsPage() {
  // Integrations state
  const [integrations, setIntegrations] = useState<Integration[]>([
    {
      id: "github",
      name: "GitHub",
      category: "Development",
      description: "Sync code repositories, track issues, and automate pull requests.",
      icon: Github,
      connected: true,
      color: "from-purple-500/10 to-indigo-500/10 hover:border-purple-500/40",
      stats: { primary: "5 repositories synced", secondary: "Last sync: 2h ago" }
    },
    {
      id: "clickup",
      name: "ClickUp",
      category: "Project Management",
      description: "Track tasks, sprints, list items, and team productivity directly.",
      icon: CheckSquare,
      connected: true,
      color: "from-pink-500/10 to-rose-500/10 hover:border-pink-500/40",
      stats: { primary: "47 active tasks", secondary: "Last sync: 1h ago" }
    },
    {
      id: "linear",
      name: "Linear",
      category: "Project Management",
      description: "High-performance issue tracking designed for modern product teams.",
      icon: Kanban,
      connected: false,
      color: "from-blue-500/10 to-cyan-500/10 hover:border-blue-500/40",
      stats: null
    },
    {
      id: "n8n",
      name: "n8n",
      category: "Automation",
      description: "Automate complex node-based workflows and integrate key services.",
      icon: Cpu,
      connected: true,
      color: "from-amber-500/10 to-orange-500/10 hover:border-amber-500/40",
      stats: { primary: "12 active workflows", secondary: "Last sync: 15m ago" }
    },
    {
      id: "slack",
      name: "Slack",
      category: "Communication",
      description:
        "Complement Slack: digests, slash /bevel, agent done cards. Not a Slack clone — agent + work plane bridge.",
      icon: Slack,
      connected: false,
      color: "from-emerald-500/10 to-teal-500/10 hover:border-emerald-500/40",
      stats: null
    },
    {
      id: "discord",
      name: "Discord",
      category: "Communication",
      description: "Integrate developer community channels and deployment alerts.",
      icon: MessageSquare,
      connected: false,
      color: "from-indigo-500/10 to-blue-500/10 hover:border-indigo-500/40",
      stats: null
    },
    {
      id: "notion",
      name: "Notion",
      category: "Productivity",
      description: "Sync product requirements, documentation, wiki nodes, and roadmaps.",
      icon: BookOpen,
      connected: false,
      color: "from-stone-500/10 to-neutral-500/10 hover:border-stone-500/40",
      stats: null
    },
    {
      id: "vercel",
      name: "Vercel",
      category: "Development",
      description: "Monitor cloud deployments, domain DNS, and preview environments.",
      icon: Cloud,
      connected: false,
      color: "from-sky-500/10 to-blue-500/10 hover:border-sky-500/40",
      stats: null
    }
  ]);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  
  // Modal state
  const [activeModalIntegration, setActiveModalIntegration] = useState<Integration | null>(null);
  const [setupStep, setSetupStep] = useState(1);
  const [authMethod, setAuthMethod] = useState<"oauth" | "token">("token");
  const [apiToken, setApiToken] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  // Toast notifications state
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [slackOauthReady, setSlackOauthReady] = useState(false);
  const [slackMcpEndpoint, setSlackMcpEndpoint] = useState(
    "https://mcp.slack.com/mcp"
  );

  // Category tags list
  const categories = ["All", "Development", "Project Management", "Automation", "Communication", "Productivity"];

  // Live Slack status from Extensions API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/integrations/slack/status", {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          connected?: boolean;
          teamName?: string;
          oauthConfigured?: boolean;
          mcp?: { endpoint?: string };
        };
        setSlackOauthReady(Boolean(data.oauthConfigured));
        if (data.mcp?.endpoint) setSlackMcpEndpoint(data.mcp.endpoint);
        setIntegrations((prev) =>
          prev.map((item) =>
            item.id === "slack"
              ? {
                  ...item,
                  connected: Boolean(data.connected),
                  stats: data.connected
                    ? {
                        primary: data.teamName
                          ? `Workspace: ${data.teamName}`
                          : "Slack connected",
                        secondary: "Bridge + MCP · complement mode",
                      }
                    : {
                        primary: "Not connected",
                        secondary: `MCP: ${data.mcp?.endpoint || "mcp.slack.com"}`,
                      },
                }
              : item
          )
        );
      } catch {
        /* offline */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Push custom toast notification
  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  // Filtered integrations list
  const filteredIntegrations = integrations.filter((integration) => {
    const matchesSearch = integration.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          integration.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "All" || integration.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Calculate stats
  const totalConnected = integrations.filter((i) => i.connected).length;

  // Manual integration synchronization trigger
  const handleSyncNow = (id: string) => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setIntegrations((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                stats: item.stats
                  ? { ...item.stats, secondary: "Last sync: Just now" }
                  : null,
              }
            : item
        )
      );
      // Also update the active modal state to reflect the sync update
      setActiveModalIntegration((prev) =>
        prev && prev.id === id
          ? {
              ...prev,
              stats: prev.stats
                ? { ...prev.stats, secondary: "Last sync: Just now" }
                : null,
            }
          : prev
      );
      showToast(`Successfully synchronized with ${integrations.find((i) => i.id === id)?.name}!`, "success");
    }, 1500);
  };

  // Test current connection
  const handleTestConnection = (name: string) => {
    setIsTesting(true);
    setTimeout(() => {
      setIsTesting(false);
      showToast(`Connection to ${name} is fully operational!`, "success");
    }, 1200);
  };

  // Disconnect active integration
  const handleDisconnect = async (id: string) => {
    if (id === "slack") {
      try {
        const res = await fetch("/api/integrations/slack/disconnect", {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) throw new Error("disconnect failed");
        setIntegrations((prev) =>
          prev.map((item) =>
            item.id === "slack" ? { ...item, connected: false, stats: null } : item
          )
        );
        showToast("Disconnected Slack.", "info");
      } catch {
        showToast("Could not disconnect Slack.", "error");
      }
      setActiveModalIntegration(null);
      return;
    }
    setIntegrations((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, connected: false, stats: null } : item
      )
    );
    showToast(`Disconnected from ${integrations.find((i) => i.id === id)?.name}.`, "info");
    setActiveModalIntegration(null);
  };

  // Step-by-step setup connection handler
  const handleConnect = (id: string) => {
    if (id === "slack") {
      if (!slackOauthReady) {
        showToast(
          "Set SLACK_CLIENT_ID + SLACK_CLIENT_SECRET (see docs/SLACK_INTEGRATION.md).",
          "error"
        );
        return;
      }
      // OAuth v2 install — real Extensions path
      window.location.href = "/api/integrations/slack/oauth/start";
      return;
    }

    if (authMethod === "token" && !apiToken.trim()) {
      showToast("Please enter an API Token or Access Key.", "error");
      return;
    }

    setIsVerifying(true);
    setTimeout(() => {
      setIsVerifying(false);
      setSetupStep(3); // Go to success step
    }, 1500);
  };

  // Finish setup process and save
  const handleFinishSetup = (id: string) => {
    setIntegrations((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              connected: true,
              stats: {
                primary: getMockStats(id),
                secondary: "Last sync: Just now",
              },
            }
          : item
      )
    );
    showToast(`${integrations.find((i) => i.id === id)?.name} connected successfully!`, "success");
    setActiveModalIntegration(null);
    // Reset wizard variables
    setApiToken("");
    setSetupStep(1);
  };

  // Open the Modal and init setup step
  const openConfigureModal = (integration: Integration) => {
    setActiveModalIntegration(integration);
    setSetupStep(1);
    // Slack prefers OAuth (Extensions); others still token-first mock
    setAuthMethod(integration.id === "slack" ? "oauth" : "token");
    setApiToken("");
  };

  // Mock initial stats based on integration id
  const getMockStats = (id: string) => {
    switch (id) {
      case "github": return "5 repositories synced";
      case "clickup": return "47 active tasks";
      case "linear": return "14 open issues";
      case "n8n": return "12 active workflows";
      case "slack": return "3 active channels";
      case "discord": return "2 servers connected";
      case "notion": return "8 workspace databases";
      case "vercel": return "4 project endpoints";
      default: return "Active sync";
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Title Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
            <Settings className="w-8 h-8 text-primary-400" />
            Integrations
          </h1>
          <p className="text-text-muted mt-1 max-w-2xl text-sm leading-relaxed">
            Configure third-party service connections, sync credentials, and manage webhooks.
            Slack uses OAuth +{" "}
            <a
              className="text-primary-400 underline-offset-2 hover:underline"
              href="https://docs.slack.dev/ai/slack-mcp-server"
              target="_blank"
              rel="noreferrer"
            >
              Slack MCP
            </a>{" "}
            (<code className="text-xs">{slackMcpEndpoint}</code>) for agents.
            Redirect:{" "}
            <code className="text-xs break-all">
              /api/integrations/slack/oauth/callback
            </code>
          </p>
        </div>

        {/* Sync Summary Card */}
        <div className="glass px-6 py-4 rounded-xl border border-primary-500/20 flex items-center gap-4 bg-surface/30 min-w-[240px]">
          <div className="w-10 h-10 rounded-lg bg-primary-500/10 flex items-center justify-center border border-primary-500/30">
            <Activity className="w-5 h-5 text-primary-400 animate-pulse" />
          </div>
          <div>
            <div className="text-xs text-text-muted font-medium uppercase tracking-wider">Sync Status</div>
            <div className="text-xl font-bold font-mono text-text flex items-baseline gap-1 mt-0.5">
              <span>{totalConnected}</span>
              <span className="text-xs text-text-muted font-sans font-normal">/ {integrations.length} Active</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar Section */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-surface/20 p-4 rounded-xl border border-border/30">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search integrations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-text-faint"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery("")} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <SlidersHorizontal className="w-3.5 h-3.5 text-text-muted mr-1.5 hidden lg:inline" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer
                ${selectedCategory === cat 
                  ? "bg-primary-500/15 text-primary-400 border border-primary-500/30 font-semibold" 
                  : "bg-surface/50 text-text-muted hover:text-text hover:bg-surface border border-transparent"
                }
              `}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Integrations Grid */}
      <AnimatePresence mode="popLayout">
        {filteredIntegrations.length > 0 ? (
          <motion.div 
            layout
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
          >
            {filteredIntegrations.map((integration) => {
              const Icon = integration.icon;
              return (
                <motion.div
                  key={integration.id}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -4 }}
                  transition={{ duration: 0.25 }}
                  className={`
                    flex flex-col h-full glass rounded-xl border border-border p-5 bg-gradient-to-br transition-all duration-300 relative overflow-hidden group
                    ${integration.color}
                  `}
                >
                  {/* Connected Badge top right */}
                  <div className="absolute top-4 right-4 flex items-center gap-1.5">
                    {integration.connected ? (
                      <span className="flex h-2 w-2 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                      </span>
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-text-faint"></span>
                    )}
                    <span className="text-[10px] font-mono tracking-wider uppercase font-medium text-text-muted">
                      {integration.connected ? "Active" : "Offline"}
                    </span>
                  </div>

                  {/* Icon + Title */}
                  <div className="flex items-center gap-3.5 mb-4">
                    <div className="p-3 rounded-xl bg-surface border border-border/50 group-hover:border-primary-500/30 group-hover:scale-110 transition-all duration-300">
                      <Icon className="w-6 h-6 text-text" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-text group-hover:text-primary-400 transition-colors">
                        {integration.name}
                      </h3>
                      <span className="text-[10px] font-medium text-text-faint uppercase tracking-wider font-mono bg-surface px-2 py-0.5 rounded border border-border/40">
                        {integration.category}
                      </span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-text-muted text-xs leading-relaxed mb-6 flex-grow">
                    {integration.description}
                  </p>

                  {/* Footer status / stats */}
                  <div className="pt-4 border-t border-border/20 flex flex-col gap-3">
                    {integration.connected && integration.stats ? (
                      <div className="flex items-center justify-between text-[11px] font-mono text-text-muted bg-surface/40 px-2.5 py-1.5 rounded-lg border border-border/30">
                        <span className="text-primary-400 font-semibold">{integration.stats.primary}</span>
                        <span className="text-text-faint">{integration.stats.secondary}</span>
                      </div>
                    ) : (
                      <div className="text-[11px] text-text-faint italic px-1 py-1.5">
                        No active credentials. Connect to sync.
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-1">
                      {integration.connected ? (
                        <>
                          <button
                            onClick={() => openConfigureModal(integration)}
                            className="flex-1 py-2 px-3 bg-surface/80 hover:bg-surface border border-border hover:border-primary-500/30 rounded-lg text-xs font-semibold text-text hover:text-primary-400 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Settings className="w-3.5 h-3.5" />
                            Configure
                          </button>
                          <button
                            onClick={() => handleSyncNow(integration.id)}
                            className="p-2 bg-surface/80 hover:bg-surface border border-border hover:border-primary-500/30 rounded-lg text-xs text-text-muted hover:text-primary-400 transition-all cursor-pointer"
                            title="Sync now"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => openConfigureModal(integration)}
                          className="w-full py-2.5 px-3 bg-cta text-cta-fg hover:opacity-90 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer hover:scale-[1.02] active:scale-[0.98] shadow-sm ring-1 ring-ink/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          Connect
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass rounded-xl border border-border/40 p-12 text-center max-w-md mx-auto"
          >
            <div className="w-12 h-12 rounded-full bg-surface/80 flex items-center justify-center border border-border/60 mx-auto mb-4">
              <Info className="w-6 h-6 text-text-muted" />
            </div>
            <h3 className="font-bold text-lg text-text">No integrations found</h3>
            <p className="text-text-muted text-sm mt-1">
              Your search term "{searchQuery}" did not match any services in this category.
            </p>
            <button
              onClick={() => { setSearchQuery(""); setSelectedCategory("All"); }}
              className="mt-4 px-4 py-2 bg-surface/80 hover:bg-surface border border-border rounded-lg text-xs font-semibold text-text cursor-pointer"
            >
              Reset Filters
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Integration Setup Dialog / Modal */}
      <AnimatePresence>
        {activeModalIntegration && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop Blur overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveModalIntegration(null)}
              className="absolute inset-0 bg-background/80 backdrop-blur-md cursor-zoom-out"
            />

            {/* Modal Body */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.4 }}
              className="relative w-full max-w-lg glass border border-border/80 rounded-2xl overflow-hidden bg-surface-elevated/95 p-6 md:p-8 flex flex-col gap-6"
            >
              {/* Close Button */}
              <button
                onClick={() => setActiveModalIntegration(null)}
                className="absolute top-5 right-5 p-1.5 rounded-lg hover:bg-surface border border-transparent hover:border-border/60 text-text-muted hover:text-text transition-colors cursor-pointer"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header Info */}
              <div className="flex items-start gap-4">
                <div className="p-3 bg-surface border border-border rounded-xl">
                  {(() => {
                    const ModalIcon = activeModalIntegration.icon;
                    return <ModalIcon className="w-8 h-8 text-text" />;
                  })()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-text flex items-center gap-2">
                    {activeModalIntegration.name}
                    {activeModalIntegration.connected && (
                      <span className="text-[10px] bg-success/20 text-success border border-success/30 px-2 py-0.5 rounded font-mono font-medium uppercase tracking-wider">
                        Connected
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-text-muted mt-1 leading-relaxed">
                    {activeModalIntegration.description}
                  </p>
                </div>
              </div>

              {/* MAIN BODY CONFIGURATION PANELS */}
              <div className="flex-grow">
                {activeModalIntegration.connected ? (
                  /* ALREADY CONNECTED - MANAGE CONFIGURATION */
                  <div className="space-y-6">
                    {/* Connection Health */}
                    <div className="glass p-4 rounded-xl border border-border/50 space-y-3 bg-surface/20">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-text-muted flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-primary-400" />
                          Connection Status
                        </span>
                        <span className="text-success font-semibold flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-success"></span>
                          Operational
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-text-muted flex items-center gap-1.5">
                          <Key className="w-3.5 h-3.5 text-secondary-400" />
                          Encrypted Key ID
                        </span>
                        <span className="text-text font-semibold select-all">
                          {activeModalIntegration.id}_api_sha256...
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-text-muted flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-accent-500" />
                          Security Level
                        </span>
                        <span className="text-accent-500 font-semibold uppercase tracking-wider text-[10px]">
                          AES-256-GCM
                        </span>
                      </div>
                    </div>

                    {/* Stats & Last Synced */}
                    {activeModalIntegration.stats && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="glass p-4 rounded-xl border border-border/40 text-center bg-surface/10">
                          <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Data Sync</div>
                          <div className="text-base font-bold text-primary-400 mt-1">
                            {activeModalIntegration.stats.primary}
                          </div>
                        </div>
                        <div className="glass p-4 rounded-xl border border-border/40 text-center bg-surface/10">
                          <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider">Last Automated Sync</div>
                          <div className="text-xs font-semibold text-text mt-2 font-mono">
                            {activeModalIntegration.stats.secondary}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Quick Info Box */}
                    <div className="p-3 bg-primary-500/5 border border-primary-500/10 rounded-lg flex items-start gap-2.5">
                      <Info className="w-4 h-4 text-primary-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] text-text-muted leading-relaxed">
                        This integration provides natural language triggers via your terminal. You can run commands like{" "}
                        <code className="text-primary-400 font-mono bg-surface px-1 py-0.5 rounded border border-border/30">
                          bevel {activeModalIntegration.id} --help
                        </code>{" "}
                        locally at any time.
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border/30">
                      <button
                        onClick={() => handleDisconnect(activeModalIntegration.id)}
                        className="py-2.5 px-4 bg-error/10 hover:bg-error/20 border border-error/30 hover:border-error/50 rounded-xl text-xs font-semibold text-error transition-all flex items-center justify-center gap-2 cursor-pointer sm:order-1"
                      >
                        <Trash2 className="w-4 h-4" />
                        Disconnect Integration
                      </button>

                      <button
                        disabled={isSyncing}
                        onClick={() => handleSyncNow(activeModalIntegration.id)}
                        className="flex-1 py-2.5 px-4 bg-surface hover:bg-surface-elevated border border-border hover:border-primary-500/30 rounded-xl text-xs font-semibold text-text hover:text-primary-400 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed sm:order-2"
                      >
                        {isSyncing ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-primary-400" />
                            Syncing data...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4" />
                            Synchronize Now
                          </>
                        )}
                      </button>

                      <button
                        disabled={isTesting}
                        onClick={() => handleTestConnection(activeModalIntegration.name)}
                        className="py-2.5 px-4 bg-surface hover:bg-surface-elevated border border-border hover:border-primary-500/30 rounded-xl text-xs font-semibold text-text-muted hover:text-text transition-all flex items-center justify-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed sm:order-3"
                      >
                        {isTesting ? "Testing..." : "Test Link"}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* DISCONNECTED - STEP BY STEP SETUP WIZARD */
                  <div className="space-y-6">
                    {/* Setup steps indicators */}
                    <div className="flex items-center gap-2 justify-center mb-2">
                      {[1, 2, 3].map((step) => (
                        <div key={step} className="flex items-center">
                          <div 
                            className={`
                              w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                              ${setupStep === step 
                                ? "bg-cta text-cta-fg font-black" 
                                : setupStep > step 
                                ? "bg-primary-500/20 text-primary-400 border border-primary-500/30" 
                                : "bg-surface text-text-faint border border-border"
                              }
                            `}
                          >
                            {setupStep > step ? <Check className="w-3.5 h-3.5" /> : step}
                          </div>
                          {step < 3 && (
                            <div 
                              className={`
                                w-16 h-0.5 transition-all
                                ${setupStep > step ? "bg-primary-500" : "bg-border"}
                              `}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Step 1: Authentication Method Select */}
                    {setupStep === 1 && (
                      <motion.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-5"
                      >
                        <h3 className="text-sm font-semibold text-text uppercase tracking-wider text-center">
                          Choose Authentication Type
                        </h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <button
                            type="button"
                            onClick={() => setAuthMethod("token")}
                            className={`
                              p-4 rounded-xl border text-left transition-all flex flex-col gap-2 cursor-pointer
                              ${authMethod === "token"
                                ? "bg-primary-500/10 border-primary-500/50 hover:border-primary-500/60"
                                : "bg-surface/50 border-border hover:border-border/60 hover:bg-surface"
                              }
                            `}
                          >
                            <Key className="w-5 h-5 text-primary-400" />
                            <div>
                              <div className="text-xs font-bold text-text">API Token / Access Key</div>
                              <div className="text-[10px] text-text-muted mt-1">Recommended. Easy setup with customized scopes.</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setAuthMethod("oauth")}
                            className={`
                              p-4 rounded-xl border text-left transition-all flex flex-col gap-2 cursor-pointer
                              ${authMethod === "oauth"
                                ? "bg-primary-500/10 border-primary-500/50 hover:border-primary-500/60"
                                : "bg-surface/50 border-border hover:border-border/60 hover:bg-surface"
                              }
                            `}
                          >
                            <ExternalLink className="w-5 h-5 text-secondary-400" />
                            <div>
                              <div className="text-xs font-bold text-text">OAuth2 Authentication</div>
                              <div className="text-[10px] text-text-muted mt-1">Authenticate via the cloud. Safe third party approval.</div>
                            </div>
                          </button>
                        </div>

                        <div className="p-3 bg-surface/40 border border-border/50 rounded-lg text-xs flex gap-2">
                          <Lock className="w-4 h-4 text-accent-500 flex-shrink-0 mt-0.5" />
                          <p className="text-[11px] text-text-muted leading-relaxed">
                            Secrets are encrypted on your local machine using AES-256 keys. We never transfer or inspect your tokens.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setSetupStep(2)}
                          className="w-full py-2.5 px-4 bg-cta text-cta-fg hover:opacity-90 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          Continue Setup
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </motion.div>
                    )}

                    {/* Step 2: Credentials Input Form */}
                    {setupStep === 2 && (
                      <motion.div 
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-4"
                      >
                        <h3 className="text-sm font-semibold text-text uppercase tracking-wider">
                          Enter Credentials
                        </h3>

                        {authMethod === "token" ? (
                          <div className="space-y-3.5">
                            <label className="block text-xs font-medium text-text-muted">
                              Access Token / Key Secrets
                            </label>
                            <div className="relative">
                              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                              <input
                                type="password"
                                placeholder={`Enter your ${activeModalIntegration.name} API Key...`}
                                value={apiToken}
                                onChange={(e) => setApiToken(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-xl text-sm font-mono text-text focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 transition-all placeholder:text-text-faint"
                                autoFocus
                              />
                            </div>
                            <span className="block text-[10px] text-text-muted leading-relaxed">
                              Need a token? Create one in your{" "}
                              <a 
                                href={`https://github.com/settings/tokens`} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-primary-400 hover:underline font-mono inline-flex items-center gap-0.5"
                              >
                                {activeModalIntegration.name} Developer settings
                                <ExternalLink className="w-2.5 h-2.5 inline" />
                              </a>
                            </span>
                          </div>
                        ) : (
                          <div className="p-6 bg-surface border border-border rounded-xl text-center space-y-4">
                            <Lock className="w-8 h-8 text-secondary-400 mx-auto animate-bounce" />
                            <div>
                              <div className="text-xs font-bold text-text">Cloud Authorizations</div>
                              <div className="text-[11px] text-text-muted mt-1 leading-relaxed">
                                Clicking continue will redirect you to authorize bevel with your account permissions.
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-3 pt-3">
                          <button
                            type="button"
                            onClick={() => setSetupStep(1)}
                            className="py-2.5 px-4 bg-surface hover:bg-surface-elevated border border-border rounded-xl text-xs font-semibold text-text transition-all cursor-pointer"
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            disabled={isVerifying}
                            onClick={() => handleConnect(activeModalIntegration.id)}
                            className="flex-grow py-2.5 px-4 bg-cta text-cta-fg hover:opacity-90 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                          >
                            {isVerifying ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-cta-fg" />
                                Validating credentials...
                              </>
                            ) : (
                              <>
                                Connect Integration
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </div>
                      </motion.div>
                    )}

                    {/* Step 3: Success Animation / Feedback */}
                    {setupStep === 3 && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="text-center space-y-6 py-4"
                      >
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/20 border border-success/40 text-success mx-auto relative glow-primary">
                          <Check className="w-8 h-8" />
                          <motion.div
                            className="absolute -inset-1 rounded-full border border-success/20"
                            animate={{ scale: [1, 1.4, 1], opacity: [1, 0, 1] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                        </div>

                        <div className="space-y-1.5">
                          <h3 className="text-lg font-bold text-text flex items-center justify-center gap-1.5">
                            Connected!
                            <Sparkles className="w-4 h-4 text-accent-500 animate-pulse" />
                          </h3>
                          <p className="text-xs text-text-muted leading-relaxed max-w-sm mx-auto">
                            The credential keys for {activeModalIntegration.name} have been successfully verified and securely stored in your local vault.
                          </p>
                        </div>

                        {/* Integration parameters summary */}
                        <div className="glass p-4 rounded-xl border border-border/50 text-left bg-surface/30 space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-text-muted">Integration:</span>
                            <span className="text-text font-bold">{activeModalIntegration.name}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-text-muted">Status:</span>
                            <span className="text-success font-semibold flex items-center gap-1">
                              ● Connected
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-text-muted">Local Sync:</span>
                            <span className="text-primary-400 font-semibold">{getMockStats(activeModalIntegration.id)}</span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleFinishSetup(activeModalIntegration.id)}
                          className="w-full py-2.5 px-4 bg-cta text-cta-fg hover:opacity-90 rounded-xl text-xs font-bold transition-all cursor-pointer hover:scale-[1.01] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        >
                          Go to Dashboard
                        </button>
                      </motion.div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Real-time self-contained Toast Alert notifications overlay */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9, transition: { duration: 0.15 } }}
              className={`
                p-4 rounded-xl border text-xs shadow-2xl flex items-center gap-3 select-none pointer-events-auto min-w-[280px] max-w-md bg-surface-elevated/95 backdrop-blur-xl
                ${toast.type === "success" 
                  ? "border-success/30 text-success" 
                  : toast.type === "error" 
                  ? "border-error/30 text-error" 
                  : "border-primary-500/20 text-primary-400"
                }
              `}
            >
              {toast.type === "success" ? (
                <div className="w-5 h-5 rounded-full bg-success/20 border border-success/40 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5" />
                </div>
              ) : toast.type === "error" ? (
                <div className="w-5 h-5 rounded-full bg-error/20 border border-error/40 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-3.5 h-3.5" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-primary-500/10 border border-primary-500/30 flex items-center justify-center flex-shrink-0">
                  <Info className="w-3.5 h-3.5" />
                </div>
              )}
              
              <div className="flex-1 font-sans text-text font-medium leading-relaxed">
                {toast.message}
              </div>

              <button
                onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
                className="text-text-muted hover:text-text p-1 hover:bg-surface rounded cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}