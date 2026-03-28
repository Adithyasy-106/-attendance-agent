/** Mirrors server semester windows — used to merge registry rows with PDF OCR hits */

export type RegistrySem = {
  name: string;
  lastDay: string;
  iat1: string;
  iat2: string;
  iat1Iso: string;
  iat1EndIso: string;
  iat2Iso: string | null;
  iat2EndIso: string | null;
  lastDayIso: string;
};

export const COE_SEMESTER_REGISTRY: Record<string, RegistrySem> = {
  "First Sem": {
    name: "BE-II",
    lastDay: "June 25, 2026",
    iat1: "April 13-16, 2026",
    iat2: "May 29-June 01, 2026",
    iat1Iso: "2026-04-13",
    iat1EndIso: "2026-04-16",
    iat2Iso: "2026-05-29",
    iat2EndIso: "2026-06-01",
    lastDayIso: "2026-06-25",
  },
  "Second Sem": {
    name: "BE-II",
    lastDay: "June 25, 2026",
    iat1: "April 13-16, 2026",
    iat2: "May 29-June 01, 2026",
    iat1Iso: "2026-04-13",
    iat1EndIso: "2026-04-16",
    iat2Iso: "2026-05-29",
    iat2EndIso: "2026-06-01",
    lastDayIso: "2026-06-25",
  },
  "Third Sem": {
    name: "BE-IV",
    lastDay: "June 25, 2026",
    iat1: "April 13-16, 2026",
    iat2: "May 29-June 01, 2026",
    iat1Iso: "2026-04-13",
    iat1EndIso: "2026-04-16",
    iat2Iso: "2026-05-29",
    iat2EndIso: "2026-06-01",
    lastDayIso: "2026-06-25",
  },
  "Fourth Sem": {
    name: "BE-IV",
    lastDay: "June 25, 2026",
    iat1: "April 13-16, 2026",
    iat2: "May 29-June 01, 2026",
    iat1Iso: "2026-04-13",
    iat1EndIso: "2026-04-16",
    iat2Iso: "2026-05-29",
    iat2EndIso: "2026-06-01",
    lastDayIso: "2026-06-25",
  },
  "Fifth Sem": {
    name: "BE-VI",
    lastDay: "May 16, 2026",
    iat1: "March 02-05, 2026",
    iat2: "May 04-07, 2026",
    iat1Iso: "2026-03-02",
    iat1EndIso: "2026-03-05",
    iat2Iso: "2026-05-04",
    iat2EndIso: "2026-05-07",
    lastDayIso: "2026-05-16",
  },
  "Sixth Sem": {
    name: "BE-VI",
    lastDay: "May 16, 2026",
    iat1: "March 02-05, 2026",
    iat2: "May 04-07, 2026",
    iat1Iso: "2026-03-02",
    iat1EndIso: "2026-03-05",
    iat2Iso: "2026-05-04",
    iat2EndIso: "2026-05-07",
    lastDayIso: "2026-05-16",
  },
  "Seventh Sem": {
    name: "BE-VIII",
    lastDay: "May 09, 2026",
    iat1: "Jan 27 (Commencement), 2026",
    iat2: "Sync pending",
    iat1Iso: "2026-01-27",
    iat1EndIso: "2026-01-27",
    iat2Iso: null,
    iat2EndIso: null,
    lastDayIso: "2026-05-09",
  },
  "Eighth Sem": {
    name: "BE-VIII",
    lastDay: "May 09, 2026",
    iat1: "Jan 27 (Commencement), 2026",
    iat2: "Sync pending",
    iat1Iso: "2026-01-27",
    iat1EndIso: "2026-01-27",
    iat2Iso: null,
    iat2EndIso: null,
    lastDayIso: "2026-05-09",
  },
};

export type CoeTimelineEvent = {
  name: string;
  date: string;
  type: string;
  isoDate: string | null;
  isoEndDate?: string | null;
  source?: string;
};

/** Match server / chat holiday heuristics — count rows that behave like holidays in merged COE */
export function countHolidayLikeEvents(events: CoeTimelineEvent[]): number {
  return events.filter((e) => {
    if (e.type === "Holiday") return true;
    if (e.source === "registry-anchor") return true;
    const n = (e.name || "").toLowerCase();
    return /holiday|no\s*instruction|holi|diwali|republic|independence|gandhi|christmas|eid|bakrid|ambedkar|may\s*day|labou?r\s*day|good\s*friday|ugadi|pongal|ganesh|mahashiv|shivaratri|dussehra|ramzan|ramadan|national|public\s*holiday|second\s*saturday/i.test(
      n
    );
  }).length;
}

/**
 * Typical instructional-off / public-holiday anchors for BE-VI Even (AY 2025–26 window → May 2026).
 * Always cross-check with the official COE PDF; PDF text rows override/merge via dedupe keys.
 */
const REGISTRY_ANCHOR_HOLIDAYS_BE_VI_EVEN: CoeTimelineEvent[] = [
  {
    name: "Republic Day",
    date: "January 26, 2026",
    type: "Holiday",
    isoDate: "2026-01-26",
    source: "registry-anchor",
  },
  {
    name: "Maha Shivaratri (typical — confirm in COE)",
    date: "February 15, 2026",
    type: "Holiday",
    isoDate: "2026-02-15",
    source: "registry-anchor",
  },
  {
    name: "Holi (typical Institute holiday — confirm in COE)",
    date: "March 14, 2026",
    type: "Holiday",
    isoDate: "2026-03-14",
    source: "registry-anchor",
  },
  {
    name: "Ugadi",
    date: "March 19, 2026",
    type: "Holiday",
    isoDate: "2026-03-19",
    source: "registry-anchor",
  },
  {
    name: "Good Friday",
    date: "April 03, 2026",
    type: "Holiday",
    isoDate: "2026-04-03",
    source: "registry-anchor",
  },
  {
    name: "Dr. Ambedkar Jayanti",
    date: "April 14, 2026",
    type: "Holiday",
    isoDate: "2026-04-14",
    source: "registry-anchor",
  },
  {
    name: "May Day / Labour Day",
    date: "May 01, 2026",
    type: "Holiday",
    isoDate: "2026-05-01",
    source: "registry-anchor",
  },
];

const BE_VI_SEMESTERS = new Set(["Fifth Sem", "Sixth Sem"]);

/** Resolved registry row is BE-VI Even window (Mar–May 2026) — use for anchors even if semester key has whitespace/typo. */
export function isBeViEvenRegistryRow(reg: RegistrySem): boolean {
  return reg.iat1Iso === "2026-03-02" && reg.lastDayIso === "2026-05-16";
}

/** PDF rows first; registry fills gaps. Dedupes on iso + type + title prefix. */
export function mergeClientCoeEvents(
  pdfEvents: CoeTimelineEvent[],
  registryEvents: CoeTimelineEvent[]
): CoeTimelineEvent[] {
  const seen = new Set<string>();
  const out: CoeTimelineEvent[] = [];
  const key = (e: CoeTimelineEvent) =>
    `${e.isoDate}|${e.isoEndDate || ""}|${e.type}|${e.name.slice(0, 42).toLowerCase()}`;
  for (const e of pdfEvents) {
    const k = key(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  for (const e of registryEvents) {
    const k = key(e);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out.sort((a, b) => (a.isoDate || "").localeCompare(b.isoDate || ""));
}

export function registryTimelineForSemester(semester: string): CoeTimelineEvent[] {
  const semKey = String(semester ?? "").trim();
  const reg = COE_SEMESTER_REGISTRY[semKey] || COE_SEMESTER_REGISTRY["Sixth Sem"];
  const rows: CoeTimelineEvent[] = [
    {
      name: "IAT-1",
      date: reg.iat1,
      type: "IAT",
      isoDate: reg.iat1Iso,
      isoEndDate: reg.iat1EndIso,
      source: "registry",
    },
    {
      name: "IAT-2",
      date: reg.iat2,
      type: "IAT",
      isoDate: reg.iat2Iso,
      isoEndDate: reg.iat2EndIso || undefined,
      source: "registry",
    },
    {
      name: "Semester end (working day target)",
      date: reg.lastDay,
      type: "Milestone",
      isoDate: reg.lastDayIso,
      source: "registry",
    },
  ];
  const lastIso = reg.lastDayIso;
  const useBeViAnchors =
    lastIso &&
    (BE_VI_SEMESTERS.has(semKey) || isBeViEvenRegistryRow(reg));
  const holidays = useBeViAnchors
    ? REGISTRY_ANCHOR_HOLIDAYS_BE_VI_EVEN.filter((h) => h.isoDate && h.isoDate <= lastIso!)
    : [];
  return [...rows, ...holidays].filter((e) => e.isoDate);
}
