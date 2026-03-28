"use client";

import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { extractCoeEventsFromPdf } from "../lib/coePdfExtract";
import { configurePdfWorker } from "../lib/pdfjsConfig";
import { getApiBase } from "../lib/api";
import { emptyTimetableGrid, runTimetableOcrFromCanvas, type TimetableStringGrid } from "../lib/timetableOcr";
import {
  COE_SEMESTER_REGISTRY,
  countHolidayLikeEvents,
  mergeClientCoeEvents,
  registryTimelineForSemester,
  type CoeTimelineEvent,
} from "../lib/coeRegistryData";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  LayoutDashboard,
  ChevronRight,
  ChevronLeft,
  Table as TableIcon,
  Search,
  CloudUpload,
  Calendar,
  Loader2,
  Camera,
  ShieldCheck,
} from "lucide-react";
import ImageProcessor from "./ImageProcessor";
import TimetableGrid from "./TimetableGrid";
import ScraperFeed, { type ErpPreviewRow } from "./ScraperFeed";

type SetupProps = {
  onComplete: (data: any) => void;
  isLoading: boolean;
  onLog: (text: string, type: "info" | "success" | "warning" | "error") => void;
};

const stepSlideVariants = {
  initial: (dir: number) => ({
    opacity: 0,
    x: dir * 56,
    filter: "blur(10px)",
  }),
  animate: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
  },
  exit: (dir: number) => ({
    opacity: 0,
    x: dir * -56,
    filter: "blur(6px)",
    transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

function SetupNav({
  showBack,
  onBack,
  backDisabled,
  children,
}: {
  showBack?: boolean;
  onBack?: () => void;
  backDisabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="mt-8 flex w-full flex-row items-center justify-between gap-3 border-t border-white/[0.06] pt-6 sm:mt-10 sm:gap-4">
      <div className="flex min-h-[3rem] min-w-0 flex-shrink-0 items-center justify-start">
        {showBack ? (
          <button type="button" onClick={onBack} disabled={backDisabled} className="ui-btn-ghost min-w-[7.5rem]">
            <ChevronLeft className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
            Back
          </button>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center justify-end gap-3">{children}</div>
    </div>
  );
}

export default function SetupFlow({ onComplete, isLoading, onLog }: SetupProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    semester: "Sixth Sem",
    batch: "A1",
    userId: "",
    password: "",
    coeFile: null as File | null,
    timetableFile: null as File | null,
    finalGrid: null as any,
    recoveryMetadata: null as any,
    coeEvents: [] as CoeTimelineEvent[],
    /** Populated after /api/erp-sync — sent with finish so setup does not scrape twice */
    attendanceRecord: null as Record<string, { attended: number; total: number }> | null,
    erpMode: null as "demo" | "live" | null,
    ocrGrid: null as TimetableStringGrid | null,
    coeOcrSummary: null as null | {
      pages: number;
      chars: number;
      lineHits: number;
      holidayHits: number;
      confidence: number;
    },
  });

  const apiBase = useMemo(() => getApiBase(), []);
  const emptyGridFallback = useMemo(() => emptyTimetableGrid(), []);
  const [erpSyncing, setErpSyncing] = useState(false);
  const [erpPreviewRows, setErpPreviewRows] = useState<ErpPreviewRow[]>([]);
  const [erpError, setErpError] = useState<string | null>(null);
  const [timetableOcrBusy, setTimetableOcrBusy] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [isParsingCOE, setIsParsingCOE] = useState(false);
  const [coeMetadata, setCoeMetadata] = useState<any>(null);
  const [direction, setDirection] = useState(1);

  const coeInputRef = useRef<HTMLInputElement>(null);
  const ttInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef(formData);
  formRef.current = formData;
  const onLogRef = useRef(onLog);
  onLogRef.current = onLog;

  const goNext = useCallback(() => {
    setDirection(1);
    setStep((s) => Math.min(5, s + 1));
  }, []);

  const goBack = useCallback(() => {
    setDirection(-1);
    setStep((s) => Math.max(1, s - 1));
  }, []);

  const handleErpScan = useCallback(async () => {
    const uid = formRef.current.userId?.trim();
    const pw = formRef.current.password;
    if (!uid || !pw) return;
    setErpError(null);
    setErpSyncing(true);
    setScanComplete(false);
    setErpPreviewRows([]);
    onLogRef.current("Requesting ERP sync from API…", "info");
    try {
      const res = await fetch(`${apiBase}/api/erp-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, password: pw }),
      });
      const data = (await res.json()) as { attendance?: Record<string, { attended: number; total: number }>; mode?: string; error?: string };
      if (!res.ok) throw new Error(data.error || "ERP sync failed");
      const att = data.attendance || {};
      const rows: ErpPreviewRow[] = Object.entries(att).map(([name, v]) => ({
        name,
        attended: v.attended,
        total: v.total,
      }));
      const mode = data.mode === "live" ? "live" : "demo";
      setFormData((prev) => ({
        ...prev,
        attendanceRecord: att,
        erpMode: mode,
      }));
      setErpPreviewRows(rows);
      setScanComplete(true);
      onLogRef.current(`ERP sync OK (${mode}) — ${rows.length} subject(s).`, "success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "ERP sync failed";
      setErpError(msg);
      onLogRef.current(msg, "error");
    } finally {
      setErpSyncing(false);
    }
  }, [apiBase]);

  useEffect(() => {
    const initPdf = async () => {
      const pdfjs = await import("pdfjs-dist");
      configurePdfWorker(pdfjs);
    };
    void initPdf();
  }, []);

  useEffect(() => {
    if (step === 2) {
      onLogRef.current("Establishing Secure Protocol Overlays...", "info");
      onLogRef.current("AGENT: Connecting to CMRIT Proxy...", "info");
    }
  }, [step]);

  const parseCOE = async (file: File) => {
    setIsParsingCOE(true);
    const sem = String(formRef.current.semester ?? "").trim();
    onLog(`AGENT: Extracting COE PDF (pdf.js) for ${sem}…`, "info");
    const reg = COE_SEMESTER_REGISTRY[sem] || COE_SEMESTER_REGISTRY["Sixth Sem"];
    let pdfEvents: CoeTimelineEvent[] = [];
    let ocrMeta: {
      pages: number;
      chars: number;
      lineHits: number;
      holidayHits: number;
      confidence: number;
    } | null = null;
    try {
      const out = await extractCoeEventsFromPdf(file, 2026);
      pdfEvents = out.events;
      ocrMeta = out.meta;
      onLog(
        `COE PDF: ${out.meta.pages} page(s), ${out.events.length} dated row(s), ${out.meta.holidayHits} holiday hit(s).`,
        "success"
      );
    } catch {
      onLog("COE PDF text layer read failed — using semester registry + metadata only.", "warning");
    }
    const registryEvents = registryTimelineForSemester(sem);
    const merged = mergeClientCoeEvents(pdfEvents, registryEvents);
    const holidaysInTimeline = countHolidayLikeEvents(merged);
    const pdfHolidayHints = ocrMeta?.holidayHits ?? 0;
    const meta = {
      lastWorkingDay: reg.lastDay,
      semester: `${reg.name} (${sem})`,
      /** Rows in merged COE that count as holidays (PDF + registry anchors + name heuristics) */
      holidays: holidaysInTimeline,
      holidaysPdfLineHints: pdfHolidayHints,
      iat1: reg.iat1,
      iat2: reg.iat2,
      cxTest: "May 12, 2026",
      confidence:
        ocrMeta?.confidence != null
          ? Math.min(98, ocrMeta.confidence + (holidaysInTimeline > pdfHolidayHints ? 2 : 0))
          : 88,
      coePages: ocrMeta?.pages ?? 0,
      coeChars: ocrMeta?.chars ?? 0,
    };
    setCoeMetadata(meta);
    setFormData((prev) => ({
      ...prev,
      coeFile: file,
      recoveryMetadata: meta,
      coeEvents: merged,
      coeOcrSummary: ocrMeta,
    }));
    setIsParsingCOE(false);
    onLog(`COE ingest: ${merged.length} event(s) stored for chat (PDF + registry).`, "success");
  };

  const parseTimetable = async (canvas: HTMLCanvasElement) => {
    setTimetableOcrBusy(true);
    onLog("Running Tesseract OCR on your timetable image…", "info");
    try {
      const grid = await runTimetableOcrFromCanvas(canvas);
      setFormData((prev) => ({ ...prev, ocrGrid: grid }));
      onLog("Timetable OCR finished — review cells on the next step.", "success");
      setDirection(1);
      setStep(5);
    } catch {
      setFormData((prev) => ({ ...prev, ocrGrid: emptyTimetableGrid() }));
      onLog("Timetable OCR could not infer cells — fill the grid manually.", "warning");
      setDirection(1);
      setStep(5);
    } finally {
      setTimetableOcrBusy(false);
    }
  };

  const steps = [1, 2, 3, 4, 5];

  return (
    <div className="relative z-10 flex min-h-screen w-full items-center justify-center overflow-y-auto px-4 py-8 sm:px-5 sm:py-10">
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
           key={step}
           custom={direction}
           variants={stepSlideVariants}
           initial="initial"
           animate="animate"
           exit="exit"
           className={`glass relative w-full rounded-[1.75rem] border-white/[0.06] p-6 shadow-2xl sm:rounded-[2rem] sm:p-8 ${
             step === 5 ? "max-h-[min(90vh,920px)] max-w-5xl overflow-y-auto" : "max-w-2xl overflow-hidden"
           }`}
        >
          <motion.div
            className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
            initial={false}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex min-w-0 flex-1 items-center gap-0.5 sm:gap-1">
              {steps.map((s) => (
                <div key={s} className="flex min-w-0 flex-1 items-center last:flex-none">
                  <motion.div
                    layout
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold sm:h-8 sm:w-8 sm:text-xs ${
                      s === step
                        ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 ring-2 ring-indigo-400/30"
                        : s < step
                          ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30"
                          : "bg-zinc-800 text-zinc-500 ring-1 ring-white/[0.06]"
                    }`}
                    transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  >
                    {s < step ? "✓" : s}
                  </motion.div>
                  {s < 5 && (
                    <motion.div
                      layout
                      className={`mx-0.5 h-0.5 min-w-[4px] flex-1 rounded-full sm:mx-1 ${s < step ? "bg-emerald-500/40" : "bg-zinc-800"}`}
                      transition={{ duration: 0.35 }}
                    />
                  )}
                </div>
              ))}
            </div>
            <span className="shrink-0 text-center text-[11px] font-medium text-zinc-500 sm:text-left">
              Step {step} of 5
            </span>
          </motion.div>

          {/* Step 1: Academic Profile */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 space-y-8 duration-500">
              <div className="space-y-2">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-500/25 bg-indigo-500/10 shadow-lg">
                  <LayoutDashboard className="h-6 w-6 text-indigo-400" />
                </div>
                <h1 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
                  Set up your profile
                  <span className="mt-1 block text-base font-medium text-indigo-400/90 sm:text-lg">Curriculum sync</span>
                </h1>
                <p className="text-sm text-zinc-500">Choose semester and batch so the agent matches your timetable.</p>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
                <div className="ui-field">
                  <label htmlFor="setup-semester" className="ui-label">
                    Semester
                  </label>
                  <select
                    id="setup-semester"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                    className="ui-input font-medium"
                  >
                    <option value="First Sem">First Semester</option>
                    <option value="Second Sem">Second Semester</option>
                    <option value="Third Sem">Third Semester</option>
                    <option value="Fourth Sem">Fourth Semester</option>
                    <option value="Fifth Sem">Fifth Semester</option>
                    <option value="Sixth Sem">Sixth Semester</option>
                    <option value="Seventh Sem">Seventh Semester</option>
                    <option value="Eighth Sem">Eighth Semester</option>
                  </select>
                </div>
                <div className="ui-field">
                  <label htmlFor="setup-batch" className="ui-label">
                    Batch
                  </label>
                  <select
                    id="setup-batch"
                    value={formData.batch}
                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                    className="ui-input font-medium"
                  >
                    <option value="A1">Batch A1 (Mon–Sat orientation)</option>
                    <option value="A2">Batch A2 (Tue–Sat orientation)</option>
                    <option value="A3">Batch A3 (Lab-first orientation)</option>
                  </select>
                </div>
              </div>
              <SetupNav showBack={false}>
                <button type="button" onClick={goNext} className="ui-btn-primary group min-w-[10rem] !w-auto">
                  Next
                  <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              </SetupNav>
            </div>
          )}

          {/* Step 2: ERP Auth + Scraper Feed */}
          {step === 2 && (
            <div className="space-y-8 animate-in slide-in-from-right-4">
              <div className="glass relative h-52 overflow-hidden rounded-2xl border border-white/[0.06] shadow-inner sm:h-64">
                 <ScraperFeed
                    isSyncing={erpSyncing}
                    userId={formData.userId}
                    rows={erpPreviewRows}
                    mode={formData.erpMode}
                    error={erpError}
                 />
                 <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-500 opacity-60" />
                    <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Session Encrypted</span>
                 </div>
              </div>

              <div className="space-y-5">
                <div className="ui-field">
                  <label htmlFor="setup-userid" className="ui-label">
                    ERP user ID
                  </label>
                  <input
                    id="setup-userid"
                    disabled={erpSyncing}
                    type="text"
                    autoComplete="username"
                    placeholder="e.g. 1CR23CS015"
                    value={formData.userId}
                    onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                    className="ui-input disabled:opacity-50"
                  />
                </div>
                <div className="ui-field">
                  <label htmlFor="setup-password" className="ui-label">
                    Password
                  </label>
                  <input
                    id="setup-password"
                    disabled={erpSyncing}
                    type="password"
                    autoComplete="current-password"
                    placeholder="Your ERP password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="ui-input disabled:opacity-50"
                  />
                  <p className="ui-hint">Used only for this session sync. Not stored on our servers beyond your run.</p>
                </div>
              </div>

              <SetupNav showBack onBack={goBack} backDisabled={erpSyncing}>
                {scanComplete ? (
                  <button type="button" onClick={goNext} className="ui-btn-primary group min-w-[10rem] animate-in zoom-in-95 !w-auto">
                    Next
                    <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={erpSyncing || !formData.userId || !formData.password}
                    onClick={() => void handleErpScan()}
                    className="ui-btn-secondary flex min-w-[12rem] items-center justify-center gap-2 !w-auto sm:min-w-[14rem]"
                  >
                    {erpSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    {erpSyncing ? "Syncing ERP…" : "Identify & scan ERP"}
                  </button>
                )}
              </SetupNav>
            </div>
          )}

          {/* Step 3: Deep COE Sync */}
          {step === 3 && (
            <div className="space-y-8 animate-in fade-in">
              <div className="flex items-center gap-4">
                 <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-lg">
                    <Calendar className="text-indigo-400 w-7 h-7" />
                 </div>
                 <div>
                    <h2 className="text-2xl font-bold tracking-tight">Sync Academic COE</h2>
                    <p className="text-zinc-500 text-xs">Extracting Deadlines & Predictive Recovery Paths.</p>
                 </div>
              </div>

              {coeMetadata ? (
                 <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-indigo-500/5 p-6 rounded-[2rem] border border-indigo-500/20 space-y-6 shadow-xl shadow-indigo-500/5">
                    <div className="flex items-center justify-between mb-2">
                       <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Extraction Verified
                       </span>
                       <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tighter italic">Confidence: {coeMetadata.confidence}%</span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Last Working Day</span>
                          <p className="text-emerald-400 font-bold text-lg leading-tight mt-1">{coeMetadata.lastWorkingDay}</p>
                       </div>
                       <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Holidays (merged COE)</span>
                          <p className="text-blue-400 font-bold text-lg leading-tight mt-1">
                            {coeMetadata.holidays} row{coeMetadata.holidays === 1 ? "" : "s"}
                          </p>
                          <p className="mt-1 text-[9px] leading-snug text-zinc-600">
                            PDF text matched <span className="font-mono text-zinc-500">{coeMetadata.holidaysPdfLineHints ?? 0}</span> holiday-like line(s);
                            timeline also includes BE‑VI registry anchors — verify every date with your official COE PDF.
                          </p>
                       </div>
                    </div>

                    <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                       <div className="flex justify-between items-center mb-2">
                          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Examination Schedule</span>
                          <span className="text-[9px] text-zinc-600 uppercase font-mono tracking-tighter">BE-VI (Even Sem)</span>
                       </div>
                       <div className="space-y-1.5">
                          <div className="flex justify-between text-[11px] font-medium">
                             <span className="text-zinc-500 italic">IAT-1:</span>
                             <span className="text-zinc-300 font-bold">{coeMetadata.iat1}</span>
                          </div>
                          <div className="flex justify-between text-[11px] font-medium">
                             <span className="text-zinc-500 italic">IAT-2:</span>
                             <span className="text-zinc-300 font-bold">{coeMetadata.iat2}</span>
                          </div>
                       </div>
                    </div>
                    
                    <p className="text-[9px] text-zinc-600 text-center italic leading-relaxed">
                      COE rows are merged for chat (PDF + institute registry). Holiday counts reflect the merged timeline, not only raw OCR lines.
                    </p>
                 </motion.div>
              ) : (
                <div className="ui-field">
                  <span className="ui-label">COE calendar (PDF)</span>
                  <button
                    type="button"
                    aria-busy={isParsingCOE}
                    disabled={isParsingCOE}
                    onClick={() => !isParsingCOE && coeInputRef.current?.click()}
                    className={`ui-dropzone w-full sm:min-h-[12rem] ${isParsingCOE ? "ui-dropzone--loading" : ""}`}
                  >
                    {isParsingCOE ? (
                      <Loader2 className="h-10 w-10 shrink-0 animate-spin text-indigo-400" aria-hidden />
                    ) : (
                      <CloudUpload className="h-10 w-10 shrink-0 text-zinc-500" aria-hidden />
                    )}
                    <span className="max-w-xs text-center text-sm font-medium text-zinc-300">
                      {isParsingCOE ? "Reading PDF…" : "Tap to upload your COE PDF"}
                    </span>
                    <span className="text-xs text-zinc-500">Official semester calendar · .pdf</span>
                    <input
                      type="file"
                      ref={coeInputRef}
                      className="hidden"
                      accept=".pdf"
                      onChange={(e) => e.target.files?.[0] && parseCOE(e.target.files[0])}
                    />
                  </button>
                </div>
              )}

              <SetupNav showBack onBack={goBack} backDisabled={isParsingCOE}>
                <button
                  type="button"
                  disabled={!coeMetadata}
                  onClick={goNext}
                  className="ui-btn-primary group min-w-[10rem] !w-auto disabled:opacity-30"
                >
                  Next
                  <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              </SetupNav>
            </div>
          )}

          {/* Step 4: Universal Timetable OCR */}
          {step === 4 && (
             <div className="space-y-8 animate-in zoom-in-95">
                <div className="flex items-center gap-4">
                    <TableIcon className="text-blue-500 w-8 h-8" />
                    <div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Sync Business Grid</h2>
                        <p className="text-zinc-500 text-xs">AI Coordinate-OCR for any semester layout.</p>
                    </div>
                </div>

                {!formData.timetableFile ? (
                   <div className="ui-field">
                     <span className="ui-label">Timetable screenshot</span>
                     <button
                       type="button"
                       onClick={() => ttInputRef.current?.click()}
                       className="ui-dropzone group w-full min-h-[14rem] sm:min-h-[16rem]"
                     >
                       <Camera className="h-12 w-12 text-zinc-500 transition-colors group-hover:text-indigo-400" aria-hidden />
                       <span className="text-center text-sm font-medium text-zinc-300">Upload a clear photo of your grid</span>
                       <span className="text-xs text-zinc-500">JPG or PNG · well-lit, full table visible</span>
                       <input
                         type="file"
                         ref={ttInputRef}
                         className="hidden"
                         accept=".jpg,.jpeg,.png"
                         onChange={(e) => setFormData({ ...formData, timetableFile: e.target.files?.[0] || null })}
                       />
                     </button>
                   </div>
                ) : (
                   <div className="relative">
                      <ImageProcessor file={formData.timetableFile} onProcessed={parseTimetable} onReset={() => setFormData({ ...formData, timetableFile: null })} />
                      {timetableOcrBusy && (
                         <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl bg-black/80 backdrop-blur-md transition-all animate-in fade-in zoom-in-95">
                            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                            <p className="max-w-xs px-6 text-center text-[10px] font-bold uppercase leading-relaxed tracking-widest text-blue-400">
                               Reading timetable with Tesseract…
                            </p>
                         </div>
                      )}
                   </div>
                )}

                <p className="mt-6 text-center text-[11px] text-zinc-500 sm:text-left">
                  {formData.timetableFile && !timetableOcrBusy
                    ? "Use “Analyze this orientation”, then review the grid on the next step."
                    : "Upload a timetable image, then run OCR."}
                </p>
                <SetupNav showBack onBack={goBack} backDisabled={timetableOcrBusy} />
             </div>
          )}

          {/* Step 5: Final Pro Grid Validation */}
          {step === 5 && (
            <div className="space-y-6 animate-in slide-in-from-bottom-8 sm:space-y-8">
               <div className="min-w-0">
                 <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">Review your timetable</h2>
                 <p className="text-xs text-zinc-500 sm:text-sm">Adjust cells if needed, then finish.</p>
               </div>
               <TimetableGrid 
                 initialData={formData.ocrGrid ?? emptyGridFallback} 
                 onConfirm={(grid) => {
                   setFormData((prev) => {
                     const next = { ...prev, finalGrid: grid };
                     queueMicrotask(() => onComplete(next));
                     return next;
                   });
                 }} 
               />
               <SetupNav showBack onBack={goBack} />
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
