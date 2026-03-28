"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  User2,
  Sparkles,
  TrendingUp,
  Calendar,
  AlertCircle,
  BarChart3,
  Clock,
  Shield,
  BookOpen,
  HelpCircle,
  Zap,
} from "lucide-react";
import { getApiBase } from "../lib/api";

type Message = {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: string;
  type?: "info" | "warning" | "safe" | "recovery";
};

type ChatInterfaceProps = {
  sessionId?: string;
  apiBase?: string;
};

const QUICK_ACTIONS = [
  { text: "Attendance summary", icon: BarChart3, accent: "border-sky-500/25 bg-sky-500/[0.08] text-sky-300" },
  { text: "Can I skip today?", icon: AlertCircle, accent: "border-amber-500/25 bg-amber-500/[0.08] text-amber-300" },
  { text: "Overall max budget", icon: TrendingUp, accent: "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300" },
  { text: "What classes today?", icon: Clock, accent: "border-violet-500/25 bg-violet-500/[0.08] text-violet-300" },
  { text: "Friday timetable", icon: Calendar, accent: "border-fuchsia-500/25 bg-fuchsia-500/[0.08] text-fuchsia-300" },
  { text: "Predict potential %", icon: TrendingUp, accent: "border-cyan-500/25 bg-cyan-500/[0.08] text-cyan-300" },
  { text: "Days until IAT", icon: Calendar, accent: "border-rose-500/25 bg-rose-500/[0.08] text-rose-300" },
  { text: "Am I at risk?", icon: Shield, accent: "border-red-500/25 bg-red-500/[0.08] text-red-300" },
  { text: "Weekly highlights", icon: BookOpen, accent: "border-indigo-500/25 bg-indigo-500/[0.08] text-indigo-300" },
  { text: "COE today", icon: Calendar, accent: "border-sky-500/25 bg-sky-500/[0.08] text-sky-300" },
  { text: "This month COE", icon: Calendar, accent: "border-teal-500/25 bg-teal-500/[0.08] text-teal-300" },
  { text: "Next holiday", icon: Clock, accent: "border-orange-500/25 bg-orange-500/[0.08] text-orange-300" },
  { text: "Upcoming events", icon: Calendar, accent: "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300" },
  { text: "Can I bunk OE?", icon: Zap, accent: "border-yellow-500/25 bg-yellow-500/[0.08] text-yellow-300" },
  { text: "Recovery path", icon: TrendingUp, accent: "border-blue-500/25 bg-blue-500/[0.08] text-blue-300" },
  { text: "Holidays list", icon: Calendar, accent: "border-lime-500/25 bg-lime-500/[0.08] text-lime-300" },
  { text: "How to use", icon: HelpCircle, accent: "border-zinc-500/30 bg-zinc-500/[0.08] text-zinc-300" },
];

const formatMessagePart = (text: string) => {
  return text.split("\n").map((line, i, arr) => {
    const parts = line.split(/(\*\*.*?\*\*|_.*?_)/g);
    return (
      <span key={i}>
        {parts.map((part, j) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            return (
              <strong key={j} className="font-semibold text-zinc-50">
                {part.slice(2, -2)}
              </strong>
            );
          }
          if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
            return (
              <em key={j} className="text-[12px] not-italic text-zinc-500">
                {part.slice(1, -1)}
              </em>
            );
          }
          return <span key={j}>{part}</span>;
        })}
        {i < arr.length - 1 && <br />}
      </span>
    );
  });
};

const formatMessage = (text: string) => {
  if (text.includes("```")) {
    const parts = text.split(/```/g);
    return (
      <div className="space-y-3">
        {parts.map((part, i) => {
          if (i % 2 === 1) {
            return (
              <div
                key={i}
                className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-zinc-950/90 shadow-inner ring-1 ring-white/[0.04]"
              >
                <pre
                  className="max-h-[min(50vh,360px)] overflow-x-auto overflow-y-auto p-3 font-[family-name:var(--font-mono)] text-[10px] leading-relaxed text-emerald-300/95 tabular-nums sm:p-4 sm:text-[11px]"
                >
                  {part.trim()}
                </pre>
              </div>
            );
          }
          return (
            <div key={i} className="text-[13px] leading-relaxed text-zinc-300/95 sm:text-[14px] sm:leading-relaxed">
              {formatMessagePart(part)}
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="text-[13px] leading-relaxed text-zinc-300/95 sm:text-[14px] sm:leading-relaxed">{formatMessagePart(text)}</div>
  );
};

export default function ChatInterface({ sessionId = "demo-session", apiBase }: ChatInterfaceProps) {
  const base = apiBase ?? getApiBase();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "bot",
      content:
        "Hi — I’m synced with your session data. Ask for an **attendance summary**, **skip budget**, a **weekday timetable**, or **recovery** outlook.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageIdRef = useRef(1);
  const nextMessageId = useCallback(() => {
    messageIdRef.current += 1;
    return String(messageIdRef.current);
  }, []);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSend = useCallback(
    async (text?: string) => {
      const msgText = text || input;
      if (!msgText.trim()) return;

      const userMsg: Message = {
        id: nextMessageId(),
        role: "user",
        content: msgText,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsTyping(true);
      inputRef.current?.focus();

      try {
        const response = await fetch(`${base}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message: msgText }),
        });
        const data = await response.json();

        setTimeout(() => {
          const botMsg: Message = {
            id: nextMessageId(),
            role: "bot",
            content: data.text || data.error || "Something went wrong.",
            type: data.type,
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          };
          setMessages((prev) => [...prev, botMsg]);
          setIsTyping(false);
        }, 380 + Math.random() * 220);
      } catch {
        setTimeout(() => {
          setIsTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              id: nextMessageId(),
              role: "bot",
              content: `**Connection error** — start the API on \`${base}\` or set **NEXT_PUBLIC_API_URL**.`,
              type: "warning",
              timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            },
          ]);
        }, 400);
      }
    },
    [base, input, sessionId, nextMessageId]
  );

  const getBubbleStyle = (msg: Message) => {
    if (msg.role === "user") {
      return "rounded-[1.15rem] rounded-tr-md border border-white/10 bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-950/30";
    }
    const shell = "rounded-[1.15rem] rounded-tl-md border shadow-sm";
    switch (msg.type) {
      case "warning":
        return `${shell} border-amber-500/30 bg-amber-950/40 text-zinc-100`;
      case "safe":
        return `${shell} border-emerald-500/25 bg-emerald-950/35 text-zinc-100`;
      default:
        return `${shell} border-white/[0.07] bg-zinc-900/90 text-zinc-100`;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-[var(--background)]">
      <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] bg-zinc-950/80 px-3 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/60 sm:px-5 sm:py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-indigo-500/25 bg-gradient-to-br from-indigo-500/20 to-violet-600/20 shadow-inner">
            <Sparkles className="h-5 w-5 text-indigo-300" aria-hidden />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold tracking-tight text-white sm:text-base">Attendance agent</h2>
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                Live
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-500 sm:text-xs">Rules + ERP snapshot · advisory only</p>
          </div>
        </div>
      </header>

      <div
        ref={listRef}
        className="min-h-[42vh] flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 py-3 sm:px-6 sm:py-5 lg:min-h-0"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-2 sm:gap-6 lg:max-w-[42rem]">
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex w-full max-w-[min(100%,26rem)] gap-2.5 sm:max-w-[min(100%,30rem)] sm:gap-3 lg:max-w-[min(100%,40rem)] ${
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl shadow-sm ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white ring-1 ring-white/10"
                        : "border border-white/[0.08] bg-zinc-900 text-indigo-300"
                    }`}
                  >
                    {msg.role === "user" ? <User2 className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  </div>
                  <div className={`min-w-0 px-3.5 py-3 sm:px-4 sm:py-3.5 ${getBubbleStyle(msg)}`}>
                    {msg.role === "bot" ? formatMessage(msg.content) : <p className="text-[13px] leading-relaxed sm:text-[14px]">{msg.content}</p>}
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2 opacity-70">
                      <time className="text-[10px] tabular-nums text-zinc-400">{msg.timestamp}</time>
                      {msg.role === "bot" && <span className="text-[10px] font-medium text-zinc-500">Advisory</span>}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isTyping && (
            <div className="flex justify-start">
              <div className="flex gap-2.5 sm:gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-zinc-900">
                  <Sparkles className="h-4 w-4 text-indigo-300" />
                </div>
                <div className="flex items-center gap-1.5 rounded-[1.15rem] rounded-tl-md border border-white/[0.07] bg-zinc-900/85 px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      animate={{ opacity: [0.35, 1, 0.35] }}
                      transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }}
                      className="h-1.5 w-1.5 rounded-full bg-indigo-400"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/[0.06] bg-zinc-950/90 px-3 pb-[max(0.75rem,var(--safe-bottom))] pt-2 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/75 sm:px-6 sm:pb-4 sm:pt-3 lg:pt-3">
        <div className="mx-auto max-w-3xl lg:max-w-[42rem]">
          <div className="mb-1.5 flex items-center justify-between gap-2 px-0.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Quick prompts</p>
            <span className="text-[10px] text-zinc-600 lg:hidden">Swipe</span>
            <span className="hidden text-[10px] text-zinc-600 lg:inline">Scroll sideways — chat stays above</span>
          </div>
          <div
            className="snap-prompts mb-2 flex max-h-[5rem] snap-x snap-mandatory flex-nowrap gap-2 overflow-x-auto overflow-y-hidden pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:max-h-[4.25rem] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/12"
            role="list"
          >
            {QUICK_ACTIONS.map((s, i) => {
              const Icon = s.icon;
              return (
                <button
                  key={i}
                  type="button"
                  role="listitem"
                  onClick={() => handleSend(s.text)}
                  className={`flex min-h-[40px] min-w-[10.25rem] max-w-[13rem] shrink-0 snap-start items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-all duration-200 ease-out hover:brightness-110 active:scale-[0.99] lg:min-h-[2.25rem] lg:min-w-[9rem] lg:max-w-[11rem] lg:px-2 lg:py-1.5 ${s.accent}`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-90 lg:h-3 lg:w-3" aria-hidden />
                  <span className="text-[10px] font-medium leading-snug text-zinc-100 lg:text-[10px]">{s.text}</span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 rounded-2xl border border-white/[0.1] bg-zinc-900/70 p-1.5 pl-3 shadow-inner ring-1 ring-white/[0.03] transition-all duration-200 ease-out focus-within:border-indigo-500/35 focus-within:ring-2 focus-within:ring-indigo-500/15 sm:pl-4">
            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <input
              id="chat-input"
              ref={inputRef}
              type="text"
              enterKeyHint="send"
              autoComplete="off"
              placeholder="Ask about attendance, skips, or timetable…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              className="min-h-11 min-w-0 flex-1 bg-transparent text-[14px] text-zinc-100 outline-none placeholder:text-zinc-600"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim()}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md transition-all duration-200 ease-out hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Send message"
            >
              <Send className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
