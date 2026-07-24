"use client";

import { useState } from "react";
import { 
  Command, Search, Copy, Check, Terminal, Code2, Shield, 
  GitBranch, Sparkles, HelpCircle, ChevronRight, Play 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface CLICommand {
  syntax: string;
  category: string;
  description: string;
  example: string;
  options: { flag: string; desc: string }[];
}

export default function DashboardCommandsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  const categories = ["All", "Execution", "Core", "Authentication", "Integrations", "Workflows", "Server"];

  const commandsList: CLICommand[] = [
    {
      syntax: "bevel",
      category: "Execution",
      description: "PRO bridge for non-developers and light developers. Focus on outcomes: setup, health, work, pack, recover, share.",
      example: "bevel health",
      options: [
        { flag: "setup", desc: "Adopt PRO local layout (dirs, agents, playbook)." },
        { flag: "health", desc: "Plain-English green / amber / red checks." },
        { flag: "work", desc: "Open product URLs and start shipping." },
        { flag: "pack / recover / share", desc: "Machine continuity and team Developer Config." },
      ]
    },
    {
      syntax: "bevel [query]",
      category: "Core",
      description: "Primary natural language query trigger. Evaluates your plain English query and routes to the matching action.",
      example: 'bevel "get me set up"',
      options: [
        { flag: "[query]", desc: "The natural language instruction you want to run." },
        { flag: "--help", desc: "Display general command usage information." }
      ]
    },
    {
      syntax: "bevel auth login",
      category: "Authentication",
      description: "Initiate Google login, or create a browser approval request for command-line authentication.",
      example: "bevel auth login --provider web",
      options: [
        { flag: "--provider <name>", desc: "Auth provider: google or web." },
        { flag: "--no-open", desc: "Print the web approval URL without opening a browser." }
      ]
    },
    {
      syntax: "bevel auth grant [request] [code]",
      category: "Authentication",
      description: "Complete a web permission request after approving it in the dashboard.",
      example: "bevel auth grant req_123 code_456 --email you@example.com",
      options: [
        { flag: "[request]", desc: "The local request ID printed by auth login --provider web." },
        { flag: "[code]", desc: "The one-time permission code from the web approval URL." },
        { flag: "--email <email>", desc: "The approved dashboard identity." },
        { flag: "--name <name>", desc: "Optional display name for auth status." }
      ]
    },
    {
      syntax: "bevel auth status",
      category: "Authentication",
      description: "Display the active profile, auth provider, sync state, configured AI providers, and integrations.",
      example: "bevel auth status",
      options: []
    },
    {
      syntax: "bevel auth configure [provider]",
      category: "Authentication",
      description: "Store an AI provider key in the encrypted local credential vault.",
      example: "bevel auth configure gemini",
      options: [
        { flag: "[provider]", desc: "One of claude, openai, gemini, grok, or kimi (Kimi3)." }
      ]
    },
    {
      syntax: "bevel auth logout",
      category: "Authentication",
      description: "Sign out of your active bevel profile and purge local session keys.",
      example: "bevel auth logout",
      options: []
    },
    {
      syntax: "bevel ai ask [question]",
      category: "Core",
      description: "Ask the configured AI provider, or route to a specific provider.",
      example: 'bevel ai ask --provider openai "summarize this repo"',
      options: [
        { flag: "--provider <name>", desc: "Provider: claude, openai, gemini, grok, kimi (Kimi3), or auto." },
        { flag: "--model <id>", desc: "Use a specific model ID." },
        { flag: "--temperature <num>", desc: "Adjust response creativity." }
      ]
    },
    {
      syntax: "bevel ai models",
      category: "Core",
      description: "List models exposed by configured AI providers.",
      example: "bevel ai models --provider claude",
      options: [
        { flag: "--provider <name>", desc: "Filter to one configured provider." }
      ]
    },
    {
      syntax: "bevel clickup tasks",
      category: "Integrations",
      description: "Fetch and list active tasks from connected ClickUp workspaces.",
      example: "bevel clickup tasks --status in-progress",
      options: [
        { flag: "--status <name>", desc: "Filter tasks by status (to-do, in-progress, completed)." },
        { flag: "--limit <num>", desc: "Maximum number of tasks to return (default 10)." }
      ]
    },
    {
      syntax: "bevel github repos",
      category: "Integrations",
      description: "List connected GitHub repositories, including stars, forks, and sync states.",
      example: "bevel github repos --limit 5",
      options: [
        { flag: "--limit <num>", desc: "Maximum number of repositories to list." },
        { flag: "--sync", desc: "Force complete index sync prior to printing." }
      ]
    },
    {
      syntax: "bevel workflow trigger [id]",
      category: "Workflows",
      description: "Trigger a specified local or cloud automated swim lane pipeline workflow.",
      example: "bevel workflow trigger pr_review",
      options: [
        { flag: "[id]", desc: "The unique identifier ID of the workflow to run." },
        { flag: "--dry-run", desc: "Simulate executing workflow nodes without hitting API endpoints." }
      ]
    },
    {
      syntax: "bevel workflow list",
      category: "Workflows",
      description: "Print a list of all locally registered workflow pipelines and templates.",
      example: "bevel workflow list",
      options: []
    },
    {
      syntax: "bevel server start",
      category: "Server",
      description: "Launch the local FastAPI server background daemon supporting Next.js web dashboard controls.",
      example: "bevel server start --port 43003",
      options: [
        { flag: "--port <number>", desc: "Specify port to listen on (default 43003)." },
        { flag: "--host <ip>", desc: "Force listen IP bind (default 127.0.0.1)." },
        { flag: "--reload", desc: "Enable hot-reloading for local FastAPI dev work." }
      ]
    },
    {
      syntax: "bevel server status",
      category: "Server",
      description: "Check diagnostic connection health and process ID of the background server daemon.",
      example: "bevel server status",
      options: []
    }
  ];

  const handleCopy = (text: string, index: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1800);
  };

  const filteredCommands = commandsList.filter((cmd) => {
    const matchesSearch = cmd.syntax.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          cmd.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "All" || cmd.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Title Header */}
      <div className="border-b border-border/40 pb-6">
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <Terminal className="w-8 h-8 text-primary-400" />
          Command Reference
        </h1>
        <p className="text-text-muted mt-1 text-sm max-w-3xl leading-relaxed">
          Comprehensive cheat-sheet for all bevel terminal commands. You can trigger any command below directly, or type them as natural language instructions inside your terminal or the Web Terminal page.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between bg-surface/20 p-4 rounded-xl border border-border/30">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Search commands, syntax, keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-lg text-sm text-text focus:outline-none focus:ring-1 focus:ring-primary-500 transition-all placeholder:text-text-faint"
          />
        </div>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer
                ${activeCategory === cat 
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

      {/* Commands List Display */}
      <div className="space-y-6">
        <AnimatePresence mode="popLayout">
          {filteredCommands.length > 0 ? (
            filteredCommands.map((cmd, idx) => (
              <motion.div
                key={cmd.syntax}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.25 }}
                className="glass rounded-xl border border-border/60 bg-gradient-to-r from-surface/30 to-transparent overflow-hidden group"
              >
                {/* Header Syntax strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 bg-surface/40 border-b border-border/20">
                  <div className="flex items-center gap-3">
                    <Code2 className="w-4.5 h-4.5 text-primary-400" />
                    <span className="text-sm font-bold font-mono text-text select-all group-hover:text-primary-400 transition-colors">
                      {cmd.syntax}
                    </span>
                    <span className="text-[9px] font-mono bg-surface px-2 py-0.5 rounded border border-border/50 uppercase tracking-wider text-text-faint">
                      {cmd.category}
                    </span>
                  </div>

                  {/* Copy command snippet button */}
                  <button
                    onClick={() => handleCopy(cmd.syntax, cmd.syntax)}
                    className={`
                      self-start sm:self-center p-1.5 rounded-lg border border-border/60 hover:border-primary-500/40 hover:bg-surface text-text-muted hover:text-primary-400 flex items-center gap-1.5 transition-all text-[11px] font-semibold cursor-pointer
                      ${copiedIndex === cmd.syntax ? "border-success/30 text-success bg-success/10" : ""}
                    `}
                  >
                    {copiedIndex === cmd.syntax ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>

                {/* Command body details */}
                <div className="p-5 space-y-4">
                  <p className="text-text-muted text-xs leading-relaxed max-w-3xl">
                    {cmd.description}
                  </p>

                  {/* CLI Options flags list */}
                  {cmd.options.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider font-semibold">Options Flags:</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs font-mono">
                        {cmd.options.map((opt) => (
                          <div key={opt.flag} className="flex gap-4 p-2 bg-background/50 rounded-lg border border-border/30">
                            <span className="text-primary-400 font-bold flex-shrink-0 select-all">{opt.flag}</span>
                            <span className="text-text-muted font-sans font-medium leading-normal">{opt.desc}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Interactive Example Tryout box */}
                  <div className="bg-background border border-border/50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-accent-500 select-none">▶</span>
                      <span className="text-text-muted">Example:</span>
                      <code className="text-text font-bold select-all">{cmd.example}</code>
                    </div>
                    <button
                      onClick={() => handleCopy(cmd.example, `${cmd.syntax}-example`)}
                      className="self-end sm:self-center text-[10px] text-primary-400 hover:underline flex items-center gap-1 font-sans font-semibold cursor-pointer"
                    >
                      {copiedIndex === `${cmd.syntax}-example` ? "Copied Example!" : "Copy Example"}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))
          ) : (
            <div className="glass rounded-xl border border-border/40 p-12 text-center max-w-md mx-auto">
              <HelpCircle className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <h3 className="font-bold text-lg text-text">No matches found</h3>
              <p className="text-text-muted text-sm mt-1">Your query "{searchQuery}" did not yield any CLI commands.</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
