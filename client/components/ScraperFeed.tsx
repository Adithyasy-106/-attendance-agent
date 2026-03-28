"use client";

import {
  Search,
  Globe,
  Lock,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  TerminalBox
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

export type ErpPreviewRow = { name: string; attended: number; total: number };

type ScraperFeedProps = {
  isSyncing: boolean;
  userId: string;
  rows: ErpPreviewRow[];
  mode: "demo" | "live" | null;
  error: string | null;
};

export default function ScraperFeed({ isSyncing, userId, rows, mode, error }: ScraperFeedProps) {
  const showTable = rows.length > 0 && !isSyncing;
  const [terminalLines, setTerminalLines] = useState<string[]>([]);

  useEffect(() => {
    if (!isSyncing) {
      setTerminalLines([]);
      return;
    }

    const script = [
      "> Initiating secure TLS handshake with target server...",
      "> Bypassing frontend gateway protection...",
      "> Injecting authentication token for user...",
      "> Verification success. Accessing Attendance Module...",
      "> Scrutinizing DOM hierarchy for subject nodes...",
      "> Extracting attendance logic arrays...",
      "> Performing cross-validation on totals...",
      "> Real-time extraction complete. Finalizing..."
    ];

    let currentIndex = 0;
    setTerminalLines([script[0]]);

    const interval = setInterval(() => {
      currentIndex++;
      if (currentIndex < script.length) {
        setTerminalLines(prev => [...prev, script[currentIndex]]);
      } else {
        clearInterval(interval);
      }
    }, 1800); // 1.8 seconds per line for maximum dramatic effect

    return () => clearInterval(interval);
  }, [isSyncing]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-[#fafafa] shadow-2xl">
      <div className="flex h-10 shrink-0 items-center gap-3 border-b border-zinc-200 bg-zinc-100 px-4">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex h-6 flex-1 items-center gap-2 rounded border border-zinc-200 bg-white px-3">
          <Lock className="h-2.5 w-2.5 text-emerald-500" />
          <span className="truncate font-mono text-[9px] lowercase text-zinc-400">
            https://erp.cmrit.ac.in/
          </span>
        </div>
        <Globe className="h-3.5 w-3.5 text-zinc-300" />
      </div>

      <div className="relative z-10 flex h-14 shrink-0 items-center justify-between bg-[#800000] px-6 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/20 font-bold text-xs text-white backdrop-blur-sm">
            J
          </div>
          <div className="text-[10px] font-bold uppercase leading-none tracking-widest text-white">
            Campus Management
            <br />
            <span className="text-[8px] font-medium text-white/60">System Portal</span>
          </div>
        </div>
        <div className="text-[9px] font-bold uppercase text-white/40">
          Portal ID: <span className="text-white">{userId || "—"}</span>
        </div>
      </div>

      <div className="custom-scrollbar relative flex-1 overflow-y-auto overflow-x-hidden p-4 pr-2 bg-zinc-50">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div
              key="err"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-800">ERP sync failed</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-zinc-600">{error}</p>
                </div>
              </div>
            </motion.div>
          )}

          {isSyncing && (
            <motion.div
              key="terminal"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex h-full min-h-[250px] flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-4 shadow-inner"
            >
              <div className="mb-4 flex items-center gap-2 border-b border-zinc-800 pb-3">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">
                  Live Extraction Feed
                </span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto font-mono text-[10px] text-emerald-400">
                {terminalLines.map((line, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    {line}
                  </motion.div>
                ))}
                <motion.div
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="mt-1 inline-block h-3 w-2 bg-emerald-400"
                />
              </div>
            </motion.div>
          )}

          {!isSyncing && !error && !showTable && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex h-full flex-col items-center justify-center gap-3 py-16 text-zinc-300 bg-white rounded-xl border border-zinc-200"
            >
              <Search className="h-10 w-10 opacity-20" />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Ready to sync</p>
            </motion.div>
          )}

          {showTable && (
            <motion.div
              key="table"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">
                  Attendance snapshot
                </span>
                <span
                  className={`rounded px-2 py-0.5 font-mono text-[8px] font-bold uppercase ${
                    mode === "live" ? "bg-emerald-500/15 text-emerald-700" : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {mode === "live" ? "LIVE_ERP" : mode === "demo" ? "DEMO_MATRIX" : "—"}
                </span>
              </div>

              {mode === "demo" && (
                <p className="text-[9px] leading-relaxed text-zinc-500">
                  Demo mode: set <span className="font-mono">ERP_SCRAPER_MODE=live</span> on the API for real portal
                  scraping (plus Chrome / selectors).
                </p>
              )}

              <div className="overflow-hidden rounded-lg border border-zinc-200">
                <table className="w-full border-collapse text-[9px]">
                  <thead>
                    <tr className="border-b border-zinc-200 bg-zinc-50">
                      <th className="p-2.5 text-left font-bold uppercase tracking-widest text-zinc-500">Subject</th>
                      <th className="p-2.5 text-center font-bold uppercase tracking-widest text-zinc-500">Present</th>
                      <th className="p-2.5 text-center font-bold uppercase tracking-widest text-zinc-500">%</th>
                      <th className="p-2.5 text-center font-bold uppercase tracking-widest text-zinc-500">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((s, i) => {
                      const pct = s.total > 0 ? Math.round((s.attended / s.total) * 100) : 0;
                      return (
                        <tr key={`${s.name}-${i}`} className="border-b border-zinc-100 transition-colors hover:bg-zinc-50">
                          <td className="p-2.5 font-medium text-zinc-700">{s.name}</td>
                          <td className="p-2.5 text-center font-mono text-zinc-500">
                            {s.attended}/{s.total}
                          </td>
                          <td className="p-2.5 text-center font-black text-zinc-700">{pct}%</td>
                          <td className="p-2.5 text-center">
                            {pct < 75 ? (
                              <AlertTriangle className="mx-auto h-3.5 w-3.5 text-amber-500" />
                            ) : (
                              <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-emerald-500" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex h-8 shrink-0 select-none items-center justify-between border-t border-zinc-200 bg-zinc-50 px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 opacity-40 grayscale">
            <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            <span className="text-[8px] font-bold uppercase tracking-tighter text-zinc-600">CLIENT_PREVIEW</span>
          </div>
        </div>
        <div className="font-mono text-[8px] text-zinc-300">ERP_SYNC</div>
      </div>
    </div>
  );
}
