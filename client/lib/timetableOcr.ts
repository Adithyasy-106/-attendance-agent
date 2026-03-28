import Tesseract from "tesseract.js";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export type TimetableStringGrid = Record<(typeof DAYS)[number], string[]>;

export function emptyTimetableGrid(): TimetableStringGrid {
  const free = "Free / Break";
  return {
    Monday: Array(7).fill(free),
    Tuesday: Array(7).fill(free),
    Wednesday: Array(7).fill(free),
    Thursday: Array(7).fill(free),
    Friday: Array(7).fill(free),
    Saturday: Array(7).fill(free),
  };
}

function padSlots(slots: string[]): string[] {
  const free = "Free / Break";
  const out = slots.map((s) => (s && s.length > 0 ? s : free));
  while (out.length < 7) out.push(free);
  return out.slice(0, 7);
}

function splitSlots(line: string): string[] {
  const parts = line
    .split(/\s{2,}|\t|\|/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length > 1) return parts;
  return line
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function resolveDayToken(raw: string): (typeof DAYS)[number] | null {
  const t = raw.replace(/[:.,]/g, " ").trim().toLowerCase();
  const map: Record<string, (typeof DAYS)[number]> = {
    monday: "Monday",
    mon: "Monday",
    tuesday: "Tuesday",
    tue: "Tuesday",
    wednesday: "Wednesday",
    wed: "Wednesday",
    thursday: "Thursday",
    thu: "Thursday",
    thur: "Thursday",
    friday: "Friday",
    fri: "Friday",
    saturday: "Saturday",
    sat: "Saturday",
  };
  const first = t.split(/\s+/)[0] ?? "";
  return map[first] ?? map[t] ?? null;
}

/** Heuristic parse of OCR text into Mon–Sat × 7 slots (best-effort; user edits on the grid). */
export function parseTimetableFromOcrText(text: string): TimetableStringGrid {
  const grid = emptyTimetableGrid();
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let currentDay: (typeof DAYS)[number] | null = null;
  const buf: string[] = [];

  const flush = () => {
    if (currentDay && buf.length) {
      grid[currentDay] = padSlots(buf.splice(0, 999));
    }
  };

  for (const line of lines) {
    const day = resolveDayToken(line.split(/\s+/)[0] || "") || resolveDayToken(line);
    if (day) {
      flush();
      currentDay = day;
      buf.length = 0;
      const rest = line.replace(/^\s*\S+\s*/, "").trim();
      if (rest) buf.push(...splitSlots(rest));
      continue;
    }
    if (currentDay) buf.push(...splitSlots(line));
  }
  flush();

  const anyDay = DAYS.some((d) => grid[d].some((c) => c !== "Free / Break"));
  if (!anyDay) {
    const tokens = lines.flatMap((l) => splitSlots(l)).filter((t) => !resolveDayToken(t));
    let i = 0;
    for (const day of DAYS) {
      const slice = tokens.slice(i, i + 7);
      if (slice.length) grid[day] = padSlots(slice);
      i += 7;
      if (i >= tokens.length) break;
    }
  }

  return grid;
}

export async function runTimetableOcrFromCanvas(canvas: HTMLCanvasElement): Promise<TimetableStringGrid> {
  const {
    data: { text },
  } = await Tesseract.recognize(canvas, "eng", {
    logger: () => {},
  });
  return parseTimetableFromOcrText(text);
}
