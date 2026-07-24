"use client";

import { useState } from "react";
import { 
  Key, Plus, Trash2, Copy, Check, ShieldAlert, Clock, Eye, 
  EyeOff, Info, Lock, AlertCircle, Sparkles, Server, Calendar 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface APIKey {
  id: string;
  name: string;
  value: string;
  scopes: string[];
  created: string;
  lastUsed: string;
}

export default function DashboardApiKeysPage() {
  const [keys, setKeys] = useState<APIKey[]>([
    {
      id: "key_1",
      name: "Local Terminal Client",
      value: "bevel_live_9f82d7a8e2b10947c6d8",
      scopes: ["read:status", "write:workflows", "read:integrations"],
      created: "2026-06-01",
      lastUsed: "2 hours ago",
    },
    {
      id: "key_2",
      name: "GitHub Actions CI Sync",
      value: "bevel_live_3c21a8d0f4e61029b8c0",
      scopes: ["read:status", "read:workflows"],
      created: "2026-06-12",
      lastUsed: "1 day ago",
    },
  ]);

  const [newKeyName, setNewKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["read:status"]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revealKeyId, setRevealKeyId] = useState<string | null>(null);

  // Available scopes
  const availableScopes = [
    { id: "read:status", name: "Read Status", desc: "View FastAPI health & status logs." },
    { id: "write:workflows", name: "Write Workflows", desc: "Create, edit & trigger swim lane pipelines." },
    { id: "read:integrations", name: "Read Integrations", desc: "Query connected service profiles." },
    { id: "admin:all", name: "Full Admin Access", desc: "Allows full configurations & settings edits." },
  ];

  const handleToggleScope = (scopeId: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scopeId) ? prev.filter((s) => s !== scopeId) : [...prev, scopeId]
    );
  };

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;

    setIsGenerating(true);
    setTimeout(() => {
      const secureRandomHex = Array.from({ length: 20 }, () =>
        Math.floor(Math.random() * 16).toString(16)
      ).join("");
      const keyValue = `bevel_live_${secureRandomHex}`;
      
      const newKey: APIKey = {
        id: Math.random().toString(36).substring(2, 9),
        name: newKeyName,
        value: keyValue,
        scopes: [...selectedScopes],
        created: new Date().toISOString().split("T")[0],
        lastUsed: "Never used",
      };

      setKeys((prev) => [newKey, ...prev]);
      setGeneratedKey(keyValue);
      setIsGenerating(false);
      setNewKeyName("");
      setSelectedScopes(["read:status"]);
    }, 1200);
  };

  const handleRevokeKey = (id: string) => {
    setKeys((prev) => prev.filter((k) => k.id !== id));
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Title Header */}
      <div className="border-b border-border/40 pb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
            <Key className="w-8 h-8 text-primary-400" />
            API Keys
          </h1>
          <p className="text-text-muted mt-1 text-sm max-w-2xl leading-relaxed">
            Generate and manage access tokens for securing communication between local scripts, automated pipelines, and your bevel portal dashboard.
          </p>
        </div>

        {/* Total stats */}
        <div className="glass px-5 py-2.5 rounded-xl border border-primary-500/15 text-xs font-mono flex items-center gap-2 bg-surface/10 self-start">
          <Server className="w-4 h-4 text-primary-400" />
          <span>Active Credentials:</span>
          <span className="text-primary-400 font-bold">{keys.length}</span>
        </div>
      </div>

      {/* Main Grid: Form Left, List Right */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        
        {/* Form panel - Generate Key */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-xl border border-border p-6 bg-surface/15 space-y-5">
            <h3 className="font-bold text-base text-text flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary-400" />
              Generate API Key
            </h3>

            <form onSubmit={handleGenerateKey} className="space-y-4">
              {/* Name Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-text-muted">Key Identifier Name</label>
                <input
                  type="text"
                  placeholder="e.g. Deploy Server Bot, Terminal script"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-xs text-text focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder:text-text-faint"
                  required
                />
              </div>

              {/* Scope selectors checkboxes */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-text-muted">Access Permission Scopes</label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                  {availableScopes.map((scope) => {
                    const active = selectedScopes.includes(scope.id);
                    return (
                      <button
                        type="button"
                        key={scope.id}
                        onClick={() => handleToggleScope(scope.id)}
                        className={`
                          w-full p-2.5 rounded-lg border text-left text-xs flex gap-3 cursor-pointer transition-all
                          ${active 
                            ? "bg-primary-500/10 border-primary-500/30 hover:border-primary-500/40" 
                            : "bg-surface/50 border-border/60 hover:bg-surface"
                          }
                        `}
                      >
                        <div className="mt-0.5">
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${active ? "bg-primary-500 border-primary-500" : "border-border"}`}>
                            {active && <Check className="w-2.5 h-2.5 text-background font-black" />}
                          </div>
                        </div>
                        <div>
                          <div className="font-bold text-text">{scope.name}</div>
                          <div className="text-[10px] text-text-muted mt-0.5 leading-normal">{scope.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={isGenerating || !newKeyName.trim()}
                className="w-full py-2.5 px-4 bg-primary-500 hover:bg-primary-400 text-background rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                {isGenerating ? "Generating..." : "Generate Key Secret"}
              </button>
            </form>
          </div>

          {/* Secure details warning */}
          <div className="p-3 bg-primary-500/5 border border-primary-500/10 rounded-lg flex items-start gap-2.5 text-xs text-text-muted">
            <Lock className="w-4 h-4 text-primary-400 mt-0.5 flex-shrink-0" />
            <p className="text-[11px] leading-relaxed">
              API Keys allow full pipeline automation controls. Protect generated secrets. Revoke any key immediately if its environment is compromised.
            </p>
          </div>
        </div>

        {/* List Panel - Current Active Keys */}
        <div className="lg:col-span-3 space-y-6">
          {/* Key Secret generated review container */}
          <AnimatePresence>
            {generatedKey && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, y: -20 }}
                className="glass rounded-xl border border-success/30 p-5 bg-success/5 space-y-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-success/20 border border-success/40 flex items-center justify-center text-success flex-shrink-0">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-text">API Key Created successfully!</h4>
                    <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                      Copy this secret key now. For your security, we do not store this plain secret key on our database. You will not be able to view it again.
                    </p>
                  </div>
                </div>

                <div className="bg-background border border-border rounded-lg p-3 flex items-center justify-between gap-4 font-mono text-xs">
                  <span className="text-primary-400 font-bold select-all overflow-x-auto whitespace-nowrap scrollbar-none py-1">
                    {generatedKey}
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleCopy(generatedKey)}
                      className={`p-1.5 rounded border border-border hover:border-primary-500/40 text-text-muted hover:text-primary-400 transition-all cursor-pointer ${copiedKey ? "border-success/30 text-success bg-success/10" : ""}`}
                    >
                      {copiedKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setGeneratedKey(null)}
                      className="p-1.5 rounded border border-border hover:bg-surface text-text-muted hover:text-text transition-all cursor-pointer text-[10px] font-sans font-bold"
                    >
                      Done
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Active Keys List */}
          <div className="glass rounded-xl border border-border/80 bg-surface/5 overflow-hidden">
            <div className="px-5 py-3 border-b border-border/40 bg-surface/30 select-none">
              <h3 className="font-bold text-sm text-text">Active API credentials</h3>
            </div>

            <div className="divide-y divide-border/30">
              {keys.length > 0 ? (
                keys.map((key) => {
                  const revealed = revealKeyId === key.id;
                  return (
                    <div key={key.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 group">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-text group-hover:text-primary-400 transition-colors">
                            {key.name}
                          </h4>
                        </div>

                        {/* Masked Key Display */}
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <span className="text-text-faint select-none">KEY:</span>
                          <span className="text-text-muted select-all">
                            {revealed ? key.value : `${key.value.slice(0, 10)}********************`}
                          </span>
                          <button
                            onClick={() => setRevealKeyId(revealed ? null : key.id)}
                            className="text-text-faint hover:text-text p-0.5 cursor-pointer"
                            title={revealed ? "Hide key" : "Show key"}
                          >
                            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>

                        {/* Scope tags */}
                        <div className="flex flex-wrap gap-1">
                          {key.scopes.map((scope) => (
                            <span 
                              key={scope} 
                              className="text-[9px] font-mono bg-surface px-1.5 py-0.5 rounded border border-border/40 text-text-faint"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Info & Revoke */}
                      <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-start gap-4 border-t md:border-0 border-border/20 pt-3 md:pt-0">
                        <div className="space-y-1 text-right text-[10px] font-mono text-text-faint">
                          <div className="flex items-center gap-1.5 justify-end">
                            <Calendar className="w-3 h-3" /> Created: {key.created}
                          </div>
                          <div className="flex items-center gap-1.5 justify-end mt-1">
                            <Clock className="w-3 h-3" /> Used: {key.lastUsed}
                          </div>
                        </div>

                        <button
                          onClick={() => handleRevokeKey(key.id)}
                          className="py-1.5 px-2.5 bg-error/10 hover:bg-error/20 border border-error/30 hover:border-error/50 rounded-lg text-[11px] font-bold text-error transition-all flex items-center gap-1 cursor-pointer"
                          title="Revoke key instantly"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Revoke
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center text-text-muted text-sm space-y-3">
                  <AlertCircle className="w-10 h-10 text-text-faint mx-auto" />
                  <div>No API keys generated yet.</div>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}