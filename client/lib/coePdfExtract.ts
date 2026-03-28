import type { CoeTimelineEvent } from "./coeRegistryData";
import { configurePdfWorker } from "./pdfjsConfig";

export type CoeOcrMeta = {
  pages: number;
  chars: number;
  lineHits: number;
  holidayHits: number;
  confidence: number;
  sampleLines: string[];
};

const MONTHS: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function toIso(y: number, m0: number, d: number): string {
  return `${y}-${pad(m0 + 1)}-${pad(d)}`;
}

function classifyLine(line: string): string {
  const s = line.toLowerCase();
  if (/iat|internal\s+assessment|ia\s*[-]?\s*1|ia\s*[-]?\s*2/i.test(s)) return "IAT";
  if (
    /holiday|no\s*instruction|instructional\s*off|inst\.?\s*holiday|nh\s*\/|national\s*holiday|public\s*holiday|restricted\s*holiday|optional\s*holiday|\bholi\b|diwali|deepavali|republic|independence|gandhi\s*jayanti|christmas|xmas|eid|bakrid|ambedkar|may\s*day|labou?r\s*day|ugadi|yugadi|pongal|dussehra|good\s*friday|ganesh|shivaratri|shivaji|kannada\s*rajyotsava|rajyotsava|vijayadashami|mahashivratri|maha\s*shivaratri|ramzan|ramadan|christ\s*mas|second\s*saturday|non-?\s*instruction|break|vacation/i.test(
      s
    )
  )
    return "Holiday";
  if (/last\s*day|instructional\s*end|end\s*of\s*(class|sem)|semester\s*end|last\s*working/i.test(s)) return "Milestone";
  if (/commence|re-?open|registration/i.test(s)) return "Milestone";
  if (/see|cee|semester\s+exam|model\s+practical|lab\s+exam/i.test(s)) return "Exam";
  return "Academic";
}

/** If PDF line has a date but weak typography, still tag obvious break days as Holiday */
function refineEventType(line: string, type: string): string {
  if (type === "Holiday" || type === "IAT" || type === "Exam") return type;
  const s = line.toLowerCase();
  if (
    /\b(holiday|holi|diwali|republic|independence|ugadi|yugadi|ambedkar|good\s*friday|may\s*day|labou?r|ganesh|shivaratri|dussehra|eid|bakrid|national|public)\s*(day|\b)/i.test(s) ||
    /no\s*instruction|instructional\s*off|non-?\s*instruction|second\s*saturday/i.test(s)
  ) {
    return "Holiday";
  }
  return type;
}

/** Many COE PDFs stream text into one line per page — split into date-sized chunks */
function expandTextIntoLineCandidates(raw: string): string[] {
  const normalized = raw.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (!normalized) return [];
  const monthHead =
    /(?=\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b)/i;
  const byMonthHead = normalized.split(monthHead).map((s) => s.trim()).filter((s) => s.length >= 8);
  const pieces =
    byMonthHead.length > 1
      ? byMonthHead
      : normalized.split(/\s*(?:;|\u2022|\.)\s+/).map((s) => s.trim()).filter((s) => s.length >= 8);
  const out: string[] = [];
  for (const p of pieces) {
    out.push(...p.split(/\s{2,}/g).map((s) => s.trim()).filter((s) => s.length >= 6));
  }
  return [...new Set(out)];
}

/** DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY — assume day-first (Indian calendars) when both ≤12 */
function parseNumericDateParts(a: number, b: number, y: number): { d: number; m0: number; y: number } {
  let day: number;
  let month: number;
  if (a > 12) {
    day = a;
    month = b - 1;
  } else if (b > 12) {
    month = a - 1;
    day = b;
  } else {
    day = a;
    month = b - 1;
  }
  return { d: day, m0: month, y };
}

function parseLineForRange(line: string, defaultYear: number): { start: string; end: string; raw: string } | null {
  const clean = line.replace(/\s+/g, " ").trim();
  // 12-14 March 2026 or 12 – 14 March 2026
  const rangeMonth = clean.match(
    /(\d{1,2})\s*[-–]\s*(\d{1,2})\s+([A-Za-z]+)\s*,?\s*(\d{4})?/i
  );
  if (rangeMonth) {
    const d1 = parseInt(rangeMonth[1], 10);
    const d2 = parseInt(rangeMonth[2], 10);
    const mon = MONTHS[rangeMonth[3].toLowerCase()];
    if (mon === undefined) return null;
    const y = rangeMonth[4] ? parseInt(rangeMonth[4], 10) : defaultYear;
    return { start: toIso(y, mon, d1), end: toIso(y, mon, d2), raw: clean.slice(0, 80) };
  }

  // 02/03/2026 or 02-03-2026
  const num3 = clean.match(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b/);
  if (num3) {
    let y = parseInt(num3[3], 10);
    if (y < 100) y += 2000;
    const { d, m0, y: yy } = parseNumericDateParts(parseInt(num3[1], 10), parseInt(num3[2], 10), y);
    const iso = toIso(yy, m0, d);
    return { start: iso, end: iso, raw: clean.slice(0, 80) };
  }

  // 15 March 2026
  const dmy = clean.match(/\b(\d{1,2})\s+([A-Za-z]+)\s*,?\s*(\d{4})\b/);
  if (dmy) {
    const day = parseInt(dmy[1], 10);
    const mon = MONTHS[dmy[2].toLowerCase()];
    if (mon === undefined) return null;
    const y = parseInt(dmy[3], 10);
    const iso = toIso(y, mon, day);
    return { start: iso, end: iso, raw: clean.slice(0, 80) };
  }

  return null;
}

function shortenLabel(line: string, max = 72): string {
  const t = line.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

/**
 * Extract timeline rows from an academic-calendar PDF using pdf.js text layer.
 */
export async function extractCoeEventsFromPdf(
  file: File,
  semesterYear: number
): Promise<{ events: CoeTimelineEvent[]; meta: CoeOcrMeta }> {
  const pdfjs = await import("pdfjs-dist");
  configurePdfWorker(pdfjs);

  const buf = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: buf }).promise;
  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const chunk = (content.items as { str: string }[])
      .map((it) => it.str)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (chunk) pageTexts.push(chunk);
  }

  const raw = pageTexts.join("\n\n");
  const newlineLines = raw
    .split(/\n+/)
    .flatMap((block) => block.split(/\s{2,}|(?<=[.;])\s+/))
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 6);
  const bulletSplit = raw
    .split(/[\u2022\u2023\u25CF\u25CB\u00B7|]+/g)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length >= 6);
  const expanded = expandTextIntoLineCandidates(raw);
  const lines = [...new Set([...newlineLines, ...bulletSplit, ...expanded])];

  const events: CoeTimelineEvent[] = [];
  const seen = new Set<string>();
  let holidayHits = 0;

  for (const line of lines) {
    if (line.length < 6) continue;
    const range = parseLineForRange(line, semesterYear);
    if (!range) continue;
    const type = refineEventType(line, classifyLine(line));
    if (type === "Holiday") holidayHits++;
    const name = shortenLabel(line);
    const key = `${range.start}|${range.end}|${name.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({
      name,
      date: range.raw,
      type,
      isoDate: range.start,
      isoEndDate: range.end === range.start ? null : range.end,
      source: "pdf",
    });
  }

  const chars = lines.join(" ").length;
  const confidence = events.length === 0 ? 40 : Math.min(98, 72 + Math.min(26, events.length * 2));

  const meta: CoeOcrMeta = {
    pages: pdf.numPages,
    chars,
    lineHits: events.length,
    holidayHits,
    confidence,
    sampleLines: lines.filter((l) => parseLineForRange(l, semesterYear)).slice(0, 5),
  };

  return { events, meta };
}
