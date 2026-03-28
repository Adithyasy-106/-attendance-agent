"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Shield, Activity, Wifi } from "lucide-react";

interface Log {
  id: number;
  text: string;
  type: "info" | "success" | "warning" | "error";
}

interface CameraHUDProps {
  logs: Log[];
}

export default function CameraHUD({ logs }: CameraHUDProps) {
  return (
    <div className="fixed inset-0 pointer-events-none z-30 overflow-hidden select-none">
      {/* HUD Corners */}
      <div className="absolute top-8 left-8 w-32 h-32 border-l-2 border-t-2 border-white/10 rounded-tl-3xl" />
      <div className="absolute top-8 right-8 w-32 h-32 border-r-2 border-t-2 border-white/10 rounded-tr-3xl" />
      <div className="absolute bottom-8 left-8 w-32 h-32 border-l-2 border-b-2 border-white/10 rounded-bl-3xl" />
      <div className="absolute bottom-8 right-8 w-32 h-32 border-r-2 border-b-2 border-white/10 rounded-br-3xl" />

      {/* Top Bar Status */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 flex items-center gap-8 bg-black/40 backdrop-blur-md border border-white/5 px-6 py-2 rounded-full">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">System Active</span>
        </div>
        <div className="w-px h-4 bg-white/10" />
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
             <Activity className="w-3 h-3 text-blue-500" /> 
             Logic Core v4.0
           </div>
           <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">
             <Shield className="w-3 h-3 text-emerald-500" /> 
             AES-256 Enabled
           </div>
        </div>
      </div>

      {/* Floating Log HUD */}
      <div className="absolute bottom-12 left-12 max-w-xs space-y-2">
        <div className="flex items-center gap-2 text-zinc-500 mb-4 px-2">
          <Terminal className="w-4 h-4" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em]">Agent Telemetry</span>
        </div>
        <div className="space-y-1.5">
          <AnimatePresence mode="popLayout">
            {logs.map((log) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -20, filter: "blur(10px)" }}
                animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                exit={{ opacity: 0, x: -20, filter: "blur(10px)" }}
                className={`flex items-start gap-3 p-3 rounded-xl border backdrop-blur-md transition-all ${
                  log.type === "error" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                  log.type === "success" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                  log.type === "warning" ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                  "bg-white/5 border-white/10 text-zinc-400"
                }`}
              >
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                  log.type === "error" ? "bg-red-500" :
                  log.type === "success" ? "bg-emerald-500" :
                  log.type === "warning" ? "bg-amber-500" :
                  "bg-blue-500"
                }`} />
                <span className="text-[11px] font-bold leading-tight uppercase tracking-tight">{log.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Data Visualization Elements */}
      <div className="absolute bottom-12 right-12 flex flex-col items-end gap-4">
        {/* Signal Strength */}
        <div className="flex items-end gap-1 h-8 px-4 bg-white/5 border border-white/5 rounded-xl items-center">
            <Wifi className="w-4 h-4 text-zinc-500 mr-2" />
            {[0.4, 0.7, 0.5, 0.9, 0.6].map((h, i) => (
              <motion.div
                key={i}
                animate={{ height: [`${h * 40}%`, `${h * 100}%`, `${h * 60}%`] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                className="w-1 bg-blue-500/30 rounded-full"
              />
            ))}
        </div>
        <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest px-2">
          Subspace Uplink: Est.
        </div>
      </div>
    </div>
  );
}
