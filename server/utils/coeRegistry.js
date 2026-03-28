/**
 * Registry + timeline builder so COE data survives setup (semester + optional recovery PDF meta).
 */

const COE_REGISTRY = {
  'First Sem': {
    iat1: 'April 13-16, 2026',
    iat2: 'May 29-June 01, 2026',
    lastDay: 'June 25, 2026',
    iat1Iso: '2026-04-13',
    iat1EndIso: '2026-04-16',
    iat2Iso: '2026-05-29',
    iat2EndIso: '2026-06-01',
    lastDayIso: '2026-06-25',
  },
  'Second Sem': {
    iat1: 'April 13-16, 2026',
    iat2: 'May 29-June 01, 2026',
    lastDay: 'June 25, 2026',
    iat1Iso: '2026-04-13',
    iat1EndIso: '2026-04-16',
    iat2Iso: '2026-05-29',
    iat2EndIso: '2026-06-01',
    lastDayIso: '2026-06-25',
  },
  'Third Sem': {
    iat1: 'April 13-16, 2026',
    iat2: 'May 29-June 01, 2026',
    lastDay: 'June 25, 2026',
    iat1Iso: '2026-04-13',
    iat1EndIso: '2026-04-16',
    iat2Iso: '2026-05-29',
    iat2EndIso: '2026-06-01',
    lastDayIso: '2026-06-25',
  },
  'Fourth Sem': {
    iat1: 'April 13-16, 2026',
    iat2: 'May 29-June 01, 2026',
    lastDay: 'June 25, 2026',
    iat1Iso: '2026-04-13',
    iat1EndIso: '2026-04-16',
    iat2Iso: '2026-05-29',
    iat2EndIso: '2026-06-01',
    lastDayIso: '2026-06-25',
  },
  'Fifth Sem': {
    iat1: 'March 02-05, 2026',
    iat2: 'May 04-07, 2026',
    lastDay: 'May 16, 2026',
    iat1Iso: '2026-03-02',
    iat1EndIso: '2026-03-05',
    iat2Iso: '2026-05-04',
    iat2EndIso: '2026-05-07',
    lastDayIso: '2026-05-16',
  },
  'Sixth Sem': {
    iat1: 'March 02-05, 2026',
    iat2: 'May 04-07, 2026',
    lastDay: 'May 16, 2026',
    iat1Iso: '2026-03-02',
    iat1EndIso: '2026-03-05',
    iat2Iso: '2026-05-04',
    iat2EndIso: '2026-05-07',
    lastDayIso: '2026-05-16',
  },
  'Seventh Sem': {
    iat1: 'Jan 27 (Commencement), 2026',
    iat2: 'Sync pending',
    lastDay: 'May 09, 2026',
    iat1Iso: '2026-01-27',
    iat1EndIso: '2026-01-27',
    iat2Iso: null,
    iat2EndIso: null,
    lastDayIso: '2026-05-09',
  },
  'Eighth Sem': {
    iat1: 'Jan 27 (Commencement), 2026',
    iat2: 'Sync pending',
    lastDay: 'May 09, 2026',
    iat1Iso: '2026-01-27',
    iat1EndIso: '2026-01-27',
    iat2Iso: null,
    iat2EndIso: null,
    lastDayIso: '2026-05-09',
  },
};

/** Instructional-off anchors for BE-VI Even window (verify against official COE PDF) */
const REGISTRY_ANCHOR_HOLIDAYS_BE_VI = [
  { name: 'Republic Day', date: 'January 26, 2026', type: 'Holiday', isoDate: '2026-01-26', source: 'registry-anchor' },
  { name: 'Maha Shivaratri (confirm in COE)', date: 'February 15, 2026', type: 'Holiday', isoDate: '2026-02-15', source: 'registry-anchor' },
  { name: 'Holi (confirm in COE)', date: 'March 14, 2026', type: 'Holiday', isoDate: '2026-03-14', source: 'registry-anchor' },
  { name: 'Ugadi', date: 'March 19, 2026', type: 'Holiday', isoDate: '2026-03-19', source: 'registry-anchor' },
  { name: 'Good Friday', date: 'April 03, 2026', type: 'Holiday', isoDate: '2026-04-03', source: 'registry-anchor' },
  { name: 'Dr. Ambedkar Jayanti', date: 'April 14, 2026', type: 'Holiday', isoDate: '2026-04-14', source: 'registry-anchor' },
  { name: 'May Day / Leisure holiday', date: 'May 01, 2026', type: 'Holiday', isoDate: '2026-05-01', source: 'registry-anchor' },
];

function parseIsoFromMeta(meta) {
  if (!meta?.lastWorkingDay) return null;
  const d = new Date(meta.lastWorkingDay);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * @param {string} semester
 * @param {object|null} recoveryMetadata from setup (optional overrides)
 * @returns {Array<{name:string,date:string,type:string,isoDate:string|null}>}
 */
function buildCoeTimeline(semester, recoveryMetadata) {
  const semKey = String(semester ?? '').trim();
  const reg = COE_REGISTRY[semKey] || COE_REGISTRY['Sixth Sem'];
  const endIso = parseIsoFromMeta(recoveryMetadata) || reg.lastDayIso;
  const endLabel = recoveryMetadata?.lastWorkingDay || reg.lastDay;

  const rows = [
    {
      name: 'IAT-1',
      date: reg.iat1,
      type: 'IAT',
      isoDate: reg.iat1Iso,
      isoEndDate: reg.iat1EndIso || reg.iat1Iso,
      source: 'registry',
    },
    ...(reg.iat2Iso
      ? [
          {
            name: 'IAT-2',
            date: reg.iat2,
            type: 'IAT',
            isoDate: reg.iat2Iso,
            isoEndDate: reg.iat2EndIso || reg.iat2Iso,
            source: 'registry',
          },
        ]
      : []),
    { name: 'Semester end (working day target)', date: endLabel, type: 'Milestone', isoDate: endIso, source: 'registry' },
  ];

  if (recoveryMetadata?.cxTest) {
    const cx = new Date(recoveryMetadata.cxTest);
    rows.push({
      name: 'CX / assessment window (from setup)',
      date: recoveryMetadata.cxTest,
      type: 'Exam',
      isoDate: Number.isNaN(cx.getTime()) ? null : cx.toISOString().slice(0, 10),
    });
  }

  const useBeViAnchors =
    reg.lastDayIso && reg.iat1Iso === '2026-03-02' && reg.lastDayIso === '2026-05-16';
  if (useBeViAnchors) {
    for (const h of REGISTRY_ANCHOR_HOLIDAYS_BE_VI) {
      if (h.isoDate <= reg.lastDayIso) rows.push({ ...h, isoEndDate: h.isoDate });
    }
  }

  return rows;
}

module.exports = { COE_REGISTRY, buildCoeTimeline };
