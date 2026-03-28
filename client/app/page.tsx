"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SetupFlow from "../components/SetupFlow";
import ChatInterface from "../components/ChatInterface";
import { motion, AnimatePresence } from "framer-motion";
import { User, GraduationCap, BarChart3, ShieldCheck, Zap, Loader2, Activity } from "lucide-react";
import { getApiBase } from "../lib/api";

export default function Home() {
  const [sessionId, setSessionId] = useState("");
  const [setupData, setSetupData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [logs, setLogs] = useState<any[]>([
    { id: 1, text: "Initializing agent…", type: "info" },
    { id: 2, text: "Logic engine ready", type: "success" },
    { id: 3, text: "Awaiting sign-in", type: "warning" },
  ]);
  const logIdRef = useRef(3);

  const apiBase = useMemo(() => getApiBase(), []);

  useEffect(() => {
    let id = sessionStorage.getItem("attendance-agent-session");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("attendance-agent-session", id);
    }
    setSessionId(id);
  }, []);

  const addLog = useCallback((text: string, type: "info" | "success" | "warning" | "error" = "info") => {
    const id = ++logIdRef.current;
    setLogs((prev) => [...prev.slice(-10), { id, text, type }]);
  }, []);

  const handleSetupComplete = async (data: any) => {
    if (!sessionId) {
      addLog("Session not ready — wait a moment and try again.", "warning");
      return;
    }
    setIsLoading(true);
    addLog(`Finishing setup for ${data.userId}…`, "info");

    try {
      const response = await fetch(`${apiBase}/api/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          semester: data.semester,
          batch: data.batch,
          userId: data.userId,
          finalGrid: data.finalGrid,
          recoveryMetadata: data.recoveryMetadata,
          coeEvents: data.coeEvents ?? [],
          coeOcrSummary: data.coeOcrSummary ?? null,
          attendance: data.attendanceRecord ?? undefined,
          credentials: { userId: data.userId, password: data.password },
        }),
      });

      if (response.ok) {
        addLog("ERP sync complete", "success");
        setSetupData(data);
      } else {
        addLog("Authentication failed", "error");
      }
    } catch {
      addLog("Server connection error", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main
      className={`app-bg-mesh relative flex flex-col overflow-x-hidden text-zinc-100 antialiased selection:bg-indigo-500/25 ${
        setupData ? "h-[100dvh] max-h-[100dvh] overflow-hidden" : "min-h-[100dvh]"
      }`}
    >
      <div
        className="pointer-events-none fixed inset-0 z-[1] opacity-[0.035]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[2] h-px bg-gradient-to-r from-transparent via-indigo-400/35 to-transparent" />

      <div
        className={`relative z-10 flex min-h-0 flex-1 px-3 pb-[max(0.75rem,var(--safe-bottom))] pt-[max(0.75rem,var(--safe-top))] sm:px-5 sm:py-6 lg:px-10 lg:py-10 ${
          setupData ? "flex-col overflow-hidden" : "items-center justify-center"
        }`}
      >
        <AnimatePresence mode="wait">
          {!setupData ? (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(6px)" }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-5xl"
            >
              <SetupFlow onComplete={handleSetupComplete} isLoading={isLoading} onLog={addLog} />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0, y: 28, scale: 0.985, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              transition={{ type: "spring", damping: 32, stiffness: 260, mass: 0.85 }}
              className="grid min-h-0 w-full max-w-7xl flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden sm:gap-4 lg:grid-cols-12 lg:grid-rows-1 lg:gap-8"
            >
              {/* Mobile profile strip */}
              <div className="flex min-h-0 flex-col overflow-hidden lg:col-span-4 lg:h-full">
                <div className="mb-2 flex min-h-[3.25rem] items-center gap-3 rounded-2xl border border-white/[0.08] bg-zinc-900/55 px-3 py-2.5 shadow-lg shadow-black/20 backdrop-blur-xl sm:px-4 lg:mb-0 lg:hidden">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md ring-1 ring-white/15">
                    <GraduationCap className="h-5 w-5 text-white" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold tracking-tight text-white">{setupData.userId}</p>
                    <p className="text-[11px] text-zinc-500">
                      {setupData.semester} · Batch {setupData.batch}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-400">
                    Synced
                  </span>
                </div>

                {/* Desktop sidebar */}
                <div className="group relative hidden min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-white/[0.07] bg-zinc-900/40 p-6 shadow-2xl backdrop-blur-2xl sm:p-8 lg:flex lg:h-full">
                  <div className="pointer-events-none absolute right-6 top-6 opacity-[0.06] transition-opacity group-hover:opacity-[0.12]">
                    <ShieldCheck className="h-14 w-14 text-indigo-400" aria-hidden />
                  </div>

                  <div className="flex items-center gap-4 border-b border-white/[0.06] pb-8">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25 ring-1 ring-white/15">
                      <GraduationCap className="h-7 w-7 text-white" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-bold tracking-tight text-white">{setupData.userId}</h2>
                      <div className="mt-1.5 inline-flex items-center gap-2 rounded-full border border-emerald-500/15 bg-emerald-500/[0.07] px-2.5 py-0.5">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        </span>
                        <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-400/90">
                          {setupData.semester} · live
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-3">
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.1] hover:bg-white/[0.03]">
                      <div className="mb-2 flex items-center gap-2 text-zinc-500">
                        <User className="h-4 w-4 text-indigo-400/90" aria-hidden />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Profile</span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-base font-semibold text-zinc-100">Batch {setupData.batch}</span>
                        <span className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                          Verified
                        </span>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 transition-colors hover:border-white/[0.1] hover:bg-white/[0.03]">
                      <div className="mb-2 flex items-center gap-2 text-zinc-500">
                        <BarChart3 className="h-4 w-4 text-sky-400/90" aria-hidden />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Data link</span>
                      </div>
                      <div className="flex items-center gap-2 text-base font-semibold text-zinc-100">
                        <Zap className="h-4 w-4 text-amber-400" aria-hidden />
                        ERP metrics active
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex min-h-0 flex-1 flex-col">
                    <div className="mb-3 flex items-center justify-between px-1">
                      <div className="flex items-center gap-2">
                        <Activity className="h-3.5 w-3.5 text-indigo-400" aria-hidden />
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Activity</span>
                      </div>
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-600" aria-hidden />
                    </div>
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5 no-scrollbar">
                      <AnimatePresence mode="popLayout">
                        {logs
                          .slice()
                          .reverse()
                          .map((log) => (
                            <motion.div
                              key={log.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              className="flex items-start gap-3 rounded-xl border border-white/[0.04] bg-black/25 px-3 py-2.5 transition-colors hover:border-white/[0.08]"
                            >
                              <div
                                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                                  log.type === "error"
                                    ? "bg-red-400"
                                    : log.type === "success"
                                      ? "bg-emerald-400"
                                      : log.type === "warning"
                                        ? "bg-amber-400"
                                        : "bg-indigo-400"
                                }`}
                              />
                              <span className="text-[11px] leading-snug text-zinc-500">{log.text}</span>
                            </motion.div>
                          ))}
                      </AnimatePresence>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-col items-center gap-2 border-t border-white/[0.06] pt-5">
                    <div className="flex items-center gap-2 text-[11px] font-medium text-zinc-600">
                      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                      Session isolated
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 w-full min-w-0 flex-col overflow-hidden lg:col-span-8 lg:h-full">
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[var(--background-elevated)]/95 shadow-[0_24px_64px_-16px_rgba(0,0,0,0.65)] ring-1 ring-white/[0.04] backdrop-blur-xl sm:rounded-3xl">
                  <ChatInterface sessionId={sessionId} apiBase={apiBase} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
