/**
 * Decision Engine V4: Premium Intent System with Table Formatting & Fuzzy Correction
 * Handles 20+ intent types with typo tolerance and professional analytics
 */

const {
  calculatePercentage,
  calculateNeededToReachTarget,
  calculateMaxBunkable,
} = require('./attendanceCalculator');

// ====== FUZZY MATCHING & CORRECTION ======
const levenshtein = (a, b) => {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
};

const fuzzyMatch = (input, target, threshold = 0.35) => {
  const a = input.toLowerCase(), b = target.toLowerCase();
  if (a.includes(b) || b.includes(a)) return true;
  const dist = levenshtein(a, b);
  return dist / Math.max(a.length, b.length) <= threshold;
};

/** Typo-only: avoids `classes` matching alias `cl` via substring rules in fuzzyMatch */
const typoMatch = (word, key, threshold = 0.34) => {
  const a = word.toLowerCase();
  const b = key.toLowerCase();
  if (a === b) return true;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return false;
  return levenshtein(a, b) / maxLen <= threshold;
};

// ====== SUBJECT MAP ======
const SUBJECT_MAP = {
  'java': 'Advanced Java', 'advanced java': 'Advanced Java', 'aj': 'Advanced Java',
  'cc': 'Cloud Computing (Open Stack /Google)', 'cloud': 'Cloud Computing (Open Stack /Google)', 'cloud computing': 'Cloud Computing (Open Stack /Google)',
  'cloud lab': 'Cloud computing Lab', 'cl': 'Cloud computing Lab',
  'devops': 'Devops Lab', 'devops lab': 'Devops Lab', 'do': 'Devops Lab',
  'ml': 'Machine Learning', 'machine learning': 'Machine Learning',
  'ml lab': 'Machine learning Lab',
  'ptr': 'Placement Training', 'placement': 'Placement Training', 'placement training': 'Placement Training', 'pt': 'Placement Training',
  'oe': 'Renewable Energy Power plants', 'renewable': 'Renewable Energy Power plants', 'renewable energy': 'Renewable Energy Power plants', 'ree': 'Renewable Energy Power plants', 'open elective': 'Renewable Energy Power plants',
  'pe': 'Advanced Java',
  'technical': 'Technical Training', 'technical training': 'Technical Training', 'tt': 'Technical Training',
  'tyl-aptitude': 'TYL-Aptitude', 'aptitude': 'TYL-Aptitude', 'tyl1': 'TYL-Aptitude',
  'logical': 'TYL-Logical', 'tyl2': 'TYL-Logical',
  'softskill': 'TYL-SoftSkill', 'soft skill': 'TYL-SoftSkill', 'tyl3': 'TYL-SoftSkill',
};

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tokenize = (text) =>
  String(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);

/**
 * Avoid false positives: `cl` must not match inside "**cl**asses".
 * Short aliases (≤4 chars, no space) require a word boundary or exact token.
 */
const keyMatchesInText = (key, t, tokenSet) => {
  const k = key.toLowerCase();
  if (k.includes(' ')) return t.includes(k);
  if (k.length <= 4) {
    if (tokenSet.has(k)) return true;
    return new RegExp(`\\b${escapeRe(k)}\\b`, 'i').test(t);
  }
  return t.includes(k);
};

const findSubject = (text) => {
  const t = text.toLowerCase();
  const tokenSet = new Set(tokenize(text));
  const sortedKeys = Object.keys(SUBJECT_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (keyMatchesInText(key, t, tokenSet)) return SUBJECT_MAP[key];
  }
  const words = t.split(/\s+/);
  for (const word of words) {
    const clean = word.replace(/[^a-z0-9]/g, '');
    if (clean.length < 3) continue;
    for (const key of sortedKeys) {
      if (key.includes(' ') || key.length > 4) continue;
      if (typoMatch(clean, key)) return SUBJECT_MAP[key];
    }
  }
  return null;
};

/** Map timetable / shorthand labels to ERP attendance keys when possible */
const resolveAttendanceKey = (rawLabel, attendance) => {
  if (!rawLabel || !attendance) return null;
  if (attendance[rawLabel]) return rawLabel;
  const tail = String(rawLabel).trim();
  const mapped = findSubject(tail.toLowerCase());
  if (mapped && attendance[mapped]) return mapped;
  const r = tail.toLowerCase();
  for (const key of Object.keys(attendance)) {
    const k = key.toLowerCase();
    if (k === r) return key;
    if (r.length >= 4 && (k.includes(r) || r.includes(k.slice(0, Math.min(6, k.length))))) return key;
  }
  return null;
};

const findMultipleSubjects = (text) => {
  const t = text.toLowerCase();
  const tokenSet = new Set(tokenize(text));
  const sortedKeys = Object.keys(SUBJECT_MAP).sort((a, b) => b.length - a.length);
  const used = new Set();
  const found = [];
  for (const key of sortedKeys) {
    if (!keyMatchesInText(key, t, tokenSet)) continue;
    const canon = SUBJECT_MAP[key];
    if (!used.has(canon)) {
      found.push(canon);
      used.add(canon);
    }
  }
  return found;
};

// ====== INTENT PATTERNS ======
/** Order matters: first match wins — keep specific / attendance before broad “week”. */
const INTENTS = [
  { name: 'NEEDED_CLASSES', patterns: [/how many( more)? classes.*(need|attend|required)|reach\s*75|75\s*%.*(for|in)|target|classes\s+needed|class(es)?\s+to\s+reach|need to attend|needed\s+to\s+reach/i] },
  { name: 'MAX_BUNK_QUERY', patterns: [/how many.*(skip|bunk|miss|absent)|can.*(skip|bunk|miss).*maintain|max.*(bunk|skip)|skip budget|bunk budget|classes.*(skip|bunk)/i] },
  { name: 'MULTI_BUNK_QUERY', patterns: [/bunk.*(all|every)|skip.*(all|every)|can i (skip|bunk).*(and|,)/i] },
  { name: 'BUNK_QUERY', patterns: [/can i skip|can i bunk|should i skip|skip tomorrow|bunk tomorrow|skip today|bunk today|safe to skip|safe to bunk/i] },
  {
    name: 'ATTENDANCE_SUMMARY',
    patterns: [
      /attendance|attnd|attedance|attdence|show my\s+(?:attendance|percentage|pct|erp)|how my\s+(?:attendance|percentage|pct)|overall\s+(?:attendance|pct|percentage)|attendance\s+overall|coe status|percentage|pct|my\s+attendance|attendance\s+summary|summary\s+table|erp\s+(data|sync|summary)|full\s+attendance|breakdown\s+of\s+attendance|status\s+of\s+attendance/i,
    ],
  },
  { name: 'RISK_CHECK', patterns: [/risk|danger|risky|below 75|which subject|critical|low attendance|at risk|am i (at )?risk/i] },
  { name: 'IAT_COUNTDOWN', patterns: [/days?.*(left|until|before|remaining).*(iat|exam|test)|iat.*(days|countdown|how (long|many))/i] },
  { name: 'IAT_QUERY', patterns: [/iat|internal|exam|exm|test date|when.?exam|when.?test|when.?iat/i] },
  { name: 'COE_TODAY', patterns: [/coe.*\bto?day\b|\bto?day\b.*\b(coe|calendar)\b|academic.+?\bto?day\b|calendar.*\bto?day\b|events?\s+(for\s+)?\bto?day\b|\bto?day\b.*(coe\s+)?(events?|summary)/i] },
  { name: 'COE_EVENTS', patterns: [/\bcoe\b|academic\s+calendar|important\s+events?|key\s+dates?|coe\s+summary|what\s+('?s|is)\s+happening|events?\s+(this|next)\s+week|events?\s+tomorrow/i] },
  { name: 'WEEKLY_SUMMARY', patterns: [/\bweekly\b|\bthis week\b|\bnext week\b|week\s*(highlights|summary|snapshot)|\bweek\b.*\b(highlights|snapshot|pulse|coe|calendar)|\bpulse\b.*\bweek/i] },
  { name: 'MONTHLY_EVENTS', patterns: [/\b(this|next)\s+month\b|monthly|month\s+wise|events?\s+.*\bmonth\b|coe.*\bmonth\b|calendar.*\bmonth\b|\bmonth\b.*\b(coe|events|highlights|summary)/i] },
  { name: 'TODAY_SCHEDULE', patterns: [/today|what.*class.*today|today.*schedule|today.*timetable/i] },
  { name: 'TOMORROW_SCHEDULE', patterns: [/tomorrow|what.*class.*tomorrow|tomorrow.*schedule/i] },
  { name: 'SCHEDULE_QUERY', patterns: [/schedule|timetable|what.?(class|subject)|friday|monday|tuesday|wednesday|thursday|saturday/i] },
  { name: 'RECOVERY_QUERY', patterns: [/recovery|reachable|potential|growth|can i reach|will i reach|future|max.*%|until may|till may|classes remaining|classes left|days left.*sem|predict.*%|predict.*attendance|ceiling/i] },
  {
    name: 'HOLIDAY_QUERY',
    patterns: [
      /holiday|vacation|off day|leave|hldy|day off|next holiday|total\s+holidays?|how many\s+holidays?|number\s+of\s+holidays?|holiday\s+count|list\s+(of\s+)?holidays?/i,
    ],
  },
  { name: 'GREETING', patterns: [/^(hi|hello|hey|good morning|good afternoon|sup|yo|hlo|hii|helo)\b/i] },
  { name: 'THANKS', patterns: [/thank|thanks|thx|thnk/i] },
  { name: 'HELP', patterns: [/help|what can you|what do you|how to use|commands|features/i] },
];

const WEEKDAY_TO_NUM = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6,
};

const parseWeekdayFromText = (t) => {
  for (const [name, num] of Object.entries(WEEKDAY_TO_NUM)) {
    if (t.includes(name)) return num;
  }
  return null;
};

const nextCalendarDateForWeekday = (targetDow) => {
  const now = new Date();
  const cur = now.getDay();
  const add = (targetDow - cur + 7) % 7;
  const d = new Date(now);
  d.setDate(d.getDate() + add);
  return d;
};

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const resolveScheduleDate = (analysis) => {
  const { intent, time, scheduleWeekday } = analysis;
  if (intent === 'TOMORROW_SCHEDULE' || time === 'tomorrow') {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d;
  }
  if (intent === 'TODAY_SCHEDULE' || time === 'today') return new Date();
  if (scheduleWeekday != null && scheduleWeekday !== undefined) return nextCalendarDateForWeekday(scheduleWeekday);
  return new Date();
};

const INTENT_KEYWORDS = {
  'ATTENDANCE_SUMMARY': ['attendance', 'percentage', 'status', 'overall', 'attdence', 'attendnce', 'table', 'breakdown'],
  'BUNK_QUERY': ['skip', 'bunk', 'miss', 'absent', 'can', 'skp', 'bnk'],
  'MAX_BUNK_QUERY': ['how', 'many', 'skip', 'bunk', 'maintain', 'budget'],
  'SCHEDULE_QUERY': ['schedule', 'timetable', 'class', 'subject', 'period'],
  'IAT_QUERY': ['iat', 'exam', 'internal', 'test', 'exm', 'iat1', 'iat2'],
  'HOLIDAY_QUERY': ['holiday', 'vacation', 'leave', 'off', 'hoilday'],
  'RISK_CHECK': ['risk', 'danger', 'critical', 'below', 'risky'],
  'RECOVERY_QUERY': ['recovery', 'reachable', 'future', 'growth', 'remaining', 'ceiling', 'predict', 'max'],
  'NEEDED_CLASSES': ['need', 'classes', 'reach', 'target', 'attend', 'required'],
  'IAT_COUNTDOWN': ['days', 'left', 'countdown', 'remaining'],
};

/** Strong routing before regex list — avoids broad patterns stealing narrow asks */
const preClassifyIntent = (t) => {
  if (/\b(attendance|percentage|pct)\b/i.test(t) && /\bfor\b/i.test(t) && findSubject(t)) {
    return 'ATTENDANCE_SUMMARY';
  }
  if (/\bweekly\b|\bthis week\b|\bnext week\b/i.test(t) && /\b(summary|highlights|snapshot|pulse)\b/i.test(t) && !/\b(attendance|attnd|pct|percentage|erp)\b/i.test(t)) {
    return 'WEEKLY_SUMMARY';
  }
  if (/\b(this|next)\s+month\b|monthly/i.test(t) && /\b(events?|coe|highlights|summary)\b/i.test(t) && !/\b(attendance|attnd|pct|percentage)\b/i.test(t)) {
    return 'MONTHLY_EVENTS';
  }
  return null;
};

// ====== CLASSIFY ======
const classifyIntent = (text) => {
  const t = text.toLowerCase().trim();
  const numberMatch = t.match(/\b\d+\b/);
  const number = numberMatch ? parseInt(numberMatch[0]) : 1;
  const timeFuzzy = ['tomorrow', 'tomrow', 'tmrw', 'tmrow', 'tomorow', 'subsequent'];
  const todayFuzzy = ['today', 'tday', 'tody', 'now', 'present'];
  let time = 'general';
  if (timeFuzzy.some(w => t.includes(w))) time = 'tomorrow';
  else if (todayFuzzy.some(w => t.includes(w))) time = 'today';
  
  const subject = findSubject(t);
  const multiSubjects = findMultipleSubjects(t);
  const monthScope = /\bnext month\b/i.test(t) ? 'next' : 'this';

  const pre = preClassifyIntent(t);
  if (pre) {
    const scheduleWeekday = parseWeekdayFromText(t);
    return { intent: pre, number, time, subject, multiSubjects, scheduleWeekday, monthScope };
  }

  for (const intent of INTENTS) {
    if (intent.patterns.some(p => p.test(t))) {
      const scheduleWeekday = parseWeekdayFromText(t);
      return { intent: intent.name, number, time, subject, multiSubjects, scheduleWeekday, monthScope };
    }
  }

  const words = t.split(/\s+/);
  let bestIntent = null; let bestScore = 0;
  for (const [intentName, keywords] of Object.entries(INTENT_KEYWORDS)) {
    let score = 0;
    for (const word of words) { if (word.length < 2) continue; for (const kw of keywords) { if (fuzzyMatch(word, kw, 0.35)) score++; } }
    if (score > bestScore) { bestScore = score; bestIntent = intentName; }
  }
  const scheduleWeekdayFallback = parseWeekdayFromText(t);
  if (bestScore >= 2) {
    return { intent: bestIntent, number, time, subject, multiSubjects, scheduleWeekday: scheduleWeekdayFallback, monthScope };
  }
  return { intent: 'FALLBACK', number, time, subject, multiSubjects, scheduleWeekday: scheduleWeekdayFallback, monthScope };
};

// ====== TABLE FORMATTER ======
const formatTable = (headers, rows) => {
  const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map(r => String(r[i]).length)));
  const pad = (s, w) => String(s).padEnd(w);
  const divider = colWidths.map(w => '-'.repeat(w)).join('-+-');
  const headerRow = headers.map((h, i) => pad(h, colWidths[i])).join(' | ');
  const dataRows = rows.map(r => r.map((c, i) => pad(c, colWidths[i])).join(' | ')).join('\n');
  return `\n\`\`\`\n${headerRow}\n${divider}\n${dataRows}\n\`\`\`\n`;
};

const shortName = (name, max = 18) =>
  (name.length > max ? `${name.slice(0, max - 2)}…` : name);

const sortCoeByDate = (coe) =>
  [...coe].sort((a, b) => {
    const ta = a.isoDate ? new Date(a.isoDate).getTime() : Infinity;
    const tb = b.isoDate ? new Date(b.isoDate).getTime() : Infinity;
    return ta - tb;
  });

const localYmd = (d = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const endIso = (e) => e.isoEndDate || e.isoDate;

const eventActiveOnDay = (e, ymd) => {
  if (!e.isoDate) return false;
  const last = endIso(e);
  return ymd >= e.isoDate && ymd <= last;
};

const eventIntersectsRange = (e, rangeStart, rangeEnd) => {
  if (!e.isoDate) return false;
  const s = new Date(e.isoDate).getTime();
  const t = new Date(endIso(e)).getTime();
  if (Number.isNaN(s) || Number.isNaN(t)) return false;
  return s <= rangeEnd.getTime() && t >= rangeStart.getTime();
};

const filterCoeInWeek = (coe, ref) => {
  const start = new Date(ref);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 59, 999);
  return coe.filter((e) => eventIntersectsRange(e, start, end));
};

const filterCoeInMonth = (coe, ref, scope) => {
  const d = new Date(ref);
  if (scope === 'next') d.setMonth(d.getMonth() + 1);
  const y = d.getFullYear();
  const m = d.getMonth();
  const first = new Date(y, m, 1, 0, 0, 0, 0);
  const last = new Date(y, m + 1, 0, 23, 59, 59, 999);
  return coe.filter((e) => eventIntersectsRange(e, first, last));
};

const coeDigestFooter = (session) => {
  const d = session.coeOcrSummary;
  if (!d) return '';
  const lines = typeof d.lineHits === 'number' ? d.lineHits : d.linehits;
  return `\n_COE PDF ingest: **${d.pages || '?'}** pgs · **${lines ?? 0}** dated rows · **${d.confidence ?? '—'}%** est. confidence._`;
};

const riskBand = (pct, skipBudget) => {
  if (pct < 75) return 'Critical';
  if (pct < 80 || skipBudget <= 1) return 'Tight';
  return 'OK';
};

const isCoeHolidayEvent = (e) => {
  if (!e) return false;
  if (e.type === 'Holiday') return true;
  if (e.source === 'registry-anchor') return true;
  const n = String(e.name || '').toLowerCase();
  return /holiday|holi|national\s*holiday|public\s*holiday|id\s*-?\s*gh|republic|independence|gandhi|christmas|eid|bakrid|ambedkar|may\s*day|labou?r\s*day|good\s*friday|ugadi|pongal|kannada|shivaji|dussehra|diwali|ramzan|ramadan|ganesh/.test(n);
};

/** Upcoming & past-boundary holiday rows from merged COE (PDF + registry), deduped by iso range */
const coeHolidayList = (coe, refDate = new Date()) => {
  const ymd = localYmd(refDate);
  const list = (coe || []).filter(isCoeHolidayEvent).filter((e) => e.isoDate && endIso(e) >= ymd);
  const seen = new Set();
  const out = [];
  for (const e of sortCoeByDate(list)) {
    const k = `${e.isoDate}|${endIso(e)}|${(e.name || '').slice(0, 48)}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
};

// ====== RESPONSE GENERATOR ======
const generateResponse = (data) => {
  const { intent, results, session, time, subject, multiSubjects, scheduleDayLabel, monthScope } = data;
  const today = new Date();
  const todayName = DAY_NAMES[today.getDay()];
  const who = session?.credentials?.userId ? `**${session.credentials.userId}**` : 'there';

  switch (intent) {
    case 'GREETING':
      return {
        text: `Hi ${who} — today is **${todayName}, ${today.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}**. ERP data is synced. Ask for a summary, skip budget, schedule, or recovery outlook.`,
        type: 'info',
      };
    
    case 'THANKS': return { text: "No problem! Stay safe and keep your attendance up! 🛡️", type: 'safe' };
    
    case 'HELP':
      return {
        text:
          '**What you can ask**\n• **Attendance summary** — per-subject %, **skips** (max bunkable before 75%), **To 75** (extra presents needed)\n• **Can I skip today?** / **Can I bunk PE?** — day-wide or **subject-specific** bunk guidance\n• **Friday timetable** (any weekday) — shows slot + mapped ERP %\n• **COE today** · Important **COE events** · **This month COE** · **Holidays list** — from your uploaded COE PDF (+ registry), not live portal\n• **Recovery path** / **Predict potential %** — ratio model only; confirm with notices',
        type: 'info',
      };

    case 'MULTI_BUNK_QUERY':
    case 'MAX_BUNK_QUERY': {
      const att = session.attendance || {};
      // Filter target entries to only include subjects that actually have fetched attendance data
      const targetEntries = (multiSubjects?.length > 0) 
        ? multiSubjects.filter(s => att[s]).map(s => [s, att[s]]) 
        : Object.entries(att);
      
      const rows = targetEntries.map(([name, d]) => {
        const pct = d.total > 0 ? Math.round((d.attended / d.total) * 100) : 100;
        const skip = calculateMaxBunkable(d.attended, d.total);
        return [name.length > 20 ? name.substring(0, 17) + '...' : name, `${pct}%`, `${skip}`];
      });

      if (rows.length === 0) {
        return { text: "⚠️ No attendance data found for the requested subject(s). Make sure the ERP sync was successful.", type: 'warning' };
      }

      return { 
        text: `**Skip budget (per subject)**\n${formatTable(['Subject', '%', 'Skips left'], rows)}\n**Skips left** = max classes you can **miss** and stay **≥ 75%** at the current attended/total ratio (advisory).`,
        type: 'info'
      };
    }

    case 'BUNK_QUERY': {
      if (subject) {
        const d = (session.attendance || {})[subject];
        if (!d || d.total === 0) {
          return { text: `**No ERP row** for **${subject}** — it may be inactive or named differently in Juno. Try the **Attendance summary** to see exact subject titles.`, type: 'warning' };
        }
        const pct = calculatePercentage(d.attended, d.total);
        const skip = calculateMaxBunkable(d.attended, d.total);
        const need = calculateNeededToReachTarget(d.attended, d.total);
        if (skip === 0) {
          return {
            text: `**Subject:** **${subject}** · **Attendance:** **${pct}%** (${d.attended}/${d.total})\n**Bunking / skips:** **0** — you are already at the **75%** ratio floor for this subject; more absences push you **below** 75% in this model.${need > 0 ? `\n**To recover toward 75%:** about **${need}** more **present** classes at the current conducted count (guidance only).` : ''}\n_Check labs, internals, and department rules — not just this ratio._`,
            type: 'warning',
          };
        }
        return {
          text: `**Subject:** **${subject}** · **Attendance:** **${pct}%** (${d.attended}/${d.total})\n**Bunking / skips:** up to **${skip}** more class(es) can be missed **in this subject alone** before the ratio model drops you **below 75%**.\n**Note:** “today / tomorrow” bunk questions blend **all subjects on your timetable** — ask **“can I bunk ${subject}”** for this subject only.`,
          type: 'safe',
        };
      }
      if (!results?.schedule?.length) {
        return { text: `No timetable slots for **${scheduleDayLabel || ( time === 'tomorrow' ? 'tomorrow' : 'today')}** — enjoy the break.`, type: 'safe' };
      }

      const att = session.attendance || {};
      const resolved = results.schedule
        .map((s) => {
          const key = resolveAttendanceKey(s.subject, att);
          return key ? { key, entry: att[key], label: s.subject } : null;
        })
        .filter(Boolean);

      const zeroBudget = resolved.some((r) => calculateMaxBunkable(r.entry.attended, r.entry.total) === 0);
      const under75 = resolved.filter((r) => calculatePercentage(r.entry.attended, r.entry.total) < 75);

      let text = `**${scheduleDayLabel || (time === 'tomorrow' ? 'Tomorrow' : 'Today')}** — ${results.schedule.length} slot(s) on grid. `;
      if (!resolved.length) {
        text += 'None of those codes mapped to synced ERP subjects (labs/theory naming). Open **Attendance summary** to match labels.';
      } else if (zeroBudget) {
        text += `At least one mapped subject has **no skip buffer**; default stance: **attend** unless you accept the hit.`;
      } else if (under75.length) {
        text += `**At risk:** ${under75.map((u) => shortName(u.key, 24)).join(', ')} — skipping would dig the hole deeper.`;
      } else {
        text += 'Mapped ERP subjects show **non‑zero skip budget** — still verify coeval weightage yourself.';
      }
      if (results.recommendation) text += `\n\n_${results.recommendation}_`;
      return { text, type: zeroBudget || under75.length ? 'warning' : 'safe' };
    }

    case 'ATTENDANCE_SUMMARY': {
      const att = session.attendance || {};
      const entries = Object.entries(att).map(([name, d]) => {
        const pct = d.total > 0 ? calculatePercentage(d.attended, d.total) : 0;
        const skip = d.total > 0 ? calculateMaxBunkable(d.attended, d.total) : 0;
        const need = d.total > 0 ? calculateNeededToReachTarget(d.attended, d.total) : 0;
        return { name, d, pct, skip, need, band: riskBand(pct, skip) };
      });
      entries.sort((a, b) => a.pct - b.pct);
      const rows = entries.map((e) => [
        shortName(e.name, 16),
        `${e.d.attended}/${e.d.total}`,
        `${e.pct}%`,
        String(e.skip),
        e.need > 0 ? `+${e.need}` : '—',
        e.band,
      ]);
      const totalA = Object.values(att).reduce((a, b) => a + b.attended, 0);
      const totalT = Object.values(att).reduce((a, b) => a + b.total, 0);
      const overall = totalT > 0 ? calculatePercentage(totalA, totalT) : 0;
      const critical = entries.filter((e) => e.pct < 75).length;
      const headline = critical
        ? `**${critical}** subject(s) under **75%** — prioritize those in the table.`
        : overall >= 80
          ? 'Overall load looks **healthy** vs the 75% rule-of-thumb.'
          : 'Overall is **above 75%** but a few subjects may still be tight on skips.';
      return {
        text: `**Attendance snapshot** (75% advisory threshold)\n${formatTable(['Subject', 'Ratio', '%', 'Skips', 'To 75', 'Band'], rows)}\n_Legend: **Skips** = max additional absences before falling below 75% at this ratio. **To 75** = extra presents needed if under 75%._\n**Weighted overall:** **${overall}%**\n${headline}`,
        type: overall < 75 || critical ? 'warning' : 'info',
      };
    }

    case 'RISK_CHECK': {
      const att = session.attendance || {};
      const lines = Object.entries(att)
        .map(([name, d]) => {
          const pct = calculatePercentage(d.attended, d.total);
          const skip = calculateMaxBunkable(d.attended, d.total);
          return { name, pct, skip, band: riskBand(pct, skip) };
        })
        .sort((a, b) => a.pct - b.pct);
      const critical = lines.filter((l) => l.pct < 75);
      const tight = lines.filter((l) => l.band === 'Tight' && l.pct >= 75);
      if (!lines.length) {
        return { text: 'No attendance in session — run **setup / ERP sync** first.', type: 'warning' };
      }
      const rows = lines.map((l) => [shortName(l.name, 16), `${l.pct}%`, String(l.skip), l.band]);
      let narrative = '';
      if (critical.length) narrative += `**Critical (<75%):** ${critical.map((c) => shortName(c.name, 20)).join(', ')}. `;
      if (tight.length) narrative += `**Tight buffer:** ${tight.map((c) => shortName(c.name, 20)).join(', ')}.`;
      if (!narrative) narrative = 'No subjects currently below **75%** in synced data.';
      return {
        text: `**Risk scan**\n${formatTable(['Subject', '%', 'Skips', 'Band'], rows)}\n${narrative}`,
        type: critical.length ? 'warning' : 'info',
      };
    }

    case 'NEEDED_CLASSES': {
      const att = session.attendance || {};
      if (subject) {
        const d = att[subject];
        if (!d) return { text: `No ERP data for **${subject}**.`, type: 'warning' };
        const need = calculateNeededToReachTarget(d.attended, d.total);
        const pct = calculatePercentage(d.attended, d.total);
        if (need === 0) {
          return { text: `**${subject}** is already at **${pct}%** vs the **75%** target (ratio model).`, type: 'safe' };
        }
        return {
          text: `**${subject}** is **${pct}%**. Roughly **${need}** more **present** classes (at the current conducted count) lift the ratio to **75%** — treat as guidance, not a guarantee.`,
          type: 'warning',
        };
      }
      const rows = Object.entries(att)
        .map(([name, d]) => {
          const need = calculateNeededToReachTarget(d.attended, d.total);
          return need > 0 ? [shortName(name, 18), `${calculatePercentage(d.attended, d.total)}%`, String(need)] : null;
        })
        .filter(Boolean)
        .sort((a, b) => parseInt(b[2], 10) - parseInt(a[2], 10));
      if (!rows.length) {
        return { text: 'Every synced subject is already at or above the **75%** ratio target (or has no conducted hours).', type: 'safe' };
      }
      return {
        text: `**Classes to reach ~75%** (per subject, ratio model)\n${formatTable(['Subject', 'Now', 'Need'], rows)}`,
        type: 'info',
      };
    }

    case 'IAT_QUERY': {
      const iatStr = results?.iat;
      if (iatStr) {
        return { text: `**IAT timeline (from COE sync):** ${iatStr}`, type: 'info' };
      }
      const iat1 = new Date('2026-03-02');
      const iat2 = new Date('2026-05-04');
      const d1 = Math.ceil((iat1 - today) / 86400000);
      const d2 = Math.ceil((iat2 - today) / 86400000);
      const rows = [
        ['IAT-1', 'Mar 02, 2026', d1 > 0 ? `${d1}d` : d1 > -5 ? 'Window' : 'Past'],
        ['IAT-2', 'May 04, 2026', d2 > 0 ? `${d2}d` : d2 > -5 ? 'Window' : 'Past'],
      ];
      return {
        text: `**IAT dates** (fallback — upload COE PDF in setup for exact windows)\n${formatTable(['Exam', 'Date', 'Eta'], rows)}`,
        type: 'info',
      };
    }

    case 'TODAY_SCHEDULE':
    case 'TOMORROW_SCHEDULE':
    case 'SCHEDULE_QUERY': {
      const sch = results?.schedule;
      if (!sch?.length) {
        return { text: '**No classes** on this day in the active grid.', type: 'safe' };
      }
      const att = session.attendance || {};
      const rows = sch.map((s) => {
        const key = resolveAttendanceKey(s.subject, att);
        const d = key ? att[key] : null;
        const pct = d && d.total > 0 ? `${calculatePercentage(d.attended, d.total)}%` : '—';
        return [s.time.split(' - ')[0], shortName(s.subject, 14), pct];
      });
      const label = scheduleDayLabel || (time === 'tomorrow' ? 'Tomorrow' : 'Today');
      return {
        text: `**Schedule — ${label}** (ERP % where mapped)\n${formatTable(['Time', 'Subject', 'ERP %'], rows)}`,
        type: 'info',
      };
    }

    case 'IAT_COUNTDOWN': {
      const coeIat = sortCoeByDate(session.coe || []).filter((e) => e.type === 'IAT' && e.isoDate);
      if (coeIat.length) {
        const rows = coeIat.map((e) => {
          const start = new Date(`${e.isoDate}T12:00:00`);
          const d = Math.ceil((start - today) / 86400000);
          let status = 'Past';
          if (d > 0) status = `${d} day${d === 1 ? '' : 's'}`;
          else if (d > -5 && e.isoEndDate && e.isoEndDate !== e.isoDate) status = 'In window';
          else if (d > -5) status = 'In window';
          return [e.name, e.date || e.isoDate, status];
        });
        return {
          text: `**IAT countdown (from your COE sync)**\n${formatTable(['Event', 'When', 'Status'], rows)}${coeDigestFooter(session)}`,
          type: 'info',
        };
      }
      const iat1 = new Date('2026-03-02');
      const iat2 = new Date('2026-05-04');
      const d1 = Math.ceil((iat1 - today) / 86400000);
      const d2 = Math.ceil((iat2 - today) / 86400000);
      const rows = [
        ['IAT-1', 'March 02', d1 > 0 ? `${d1} days` : d1 > -4 ? 'RUNNING' : 'DONE'],
        ['IAT-2', 'May 04', d2 > 0 ? `${d2} days` : d2 > -4 ? 'RUNNING' : 'AHEAD'],
      ];
      return {
        text: `**Exam countdown** (static — finish **COE PDF** setup for exact windows)\n${formatTable(['Event', 'Date', 'Status'], rows)}`,
        type: 'warning',
      };
    }

    case 'WEEKLY_SUMMARY': {
      const att = session.attendance || {};
      const totalA = Object.values(att).reduce((a, b) => a + b.attended, 0);
      const totalT = Object.values(att).reduce((a, b) => a + b.total, 0);
      const overall = totalT > 0 ? calculatePercentage(totalA, totalT) : 0;
      const rec = results?.recovery;
      const coe = sortCoeByDate(session.coe || []);
      const thisWeek = filterCoeInWeek(coe, today);
      const ymdToday = localYmd(today);
      const fromToday = coe.filter((e) => e.isoDate && endIso(e) >= ymdToday);
      const weekTable =
        thisWeek.length > 0
          ? `\n**COE — next 7 days (start→end overlaps this window)**\n${formatTable(['Item', 'Date', 'Type'], thisWeek.map((e) => [shortName(e.name || 'Event', 20), e.date || '—', e.type || '—']))}`
          : coe.length
            ? '\n**COE:** no dated milestones in the next 7 days — see **“important COE events”** for the full timeline.'
            : '';
      const headsUp =
        coe.length && fromToday.length
          ? `\n**Upcoming academic dates (from today — IAT / milestones / holidays)**\n${formatTable(['Item', 'Date', 'Type'], fromToday.slice(0, 10).map((e) => [shortName(e.name || 'Event', 22), e.date || e.isoDate || '—', e.type || '—']))}`
          : '';
      return {
        text: `**Weekly snapshot**\n• **Weighted attendance:** **${overall}%**${
          rec
            ? `\n• **Ceiling scenario** (no further absences until ${rec.deadline}): **${rec.maxPercent}%** · **${rec.futureClasses}** model classes ahead`
            : ''
        }${weekTable}${headsUp}\n• **Timetable:** ask **Monday timetable** … **Saturday timetable** or **today / tomorrow**.${coeDigestFooter(session)}`,
        type: 'info',
      };
    }

    case 'COE_TODAY': {
      const ymd = localYmd(today);
      const coe = sortCoeByDate(session.coe || []);
      const todayEv = coe.filter((e) => eventActiveOnDay(e, ymd));
      const foot = coeDigestFooter(session);
      if (!coe.length) {
        return {
          text: `**COE — today**\nNo synced COE timeline on this session. Complete the **COE PDF** step in setup.${foot}`,
          type: 'warning',
        };
      }
      if (!todayEv.length) {
        return {
          text: `**COE — ${todayName} (${today.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })})**\nNo item is **active on** this exact date (multi-day windows only list on days inside **start→end**).\nTry **weekly summary** or **this month events** for nearby dates.${foot}`,
          type: 'info',
        };
      }
      const rows = todayEv.map((e) => [
        shortName(e.name, 30),
        e.date || (e.isoEndDate && e.isoEndDate !== e.isoDate ? `${e.isoDate} → ${e.isoEndDate}` : e.isoDate),
        e.type || '—',
      ]);
      return {
        text: `**COE — today**\n${formatTable(['Item', 'When', 'Type'], rows)}${foot}`,
        type: 'info',
      };
    }

    case 'MONTHLY_EVENTS': {
      const coe = sortCoeByDate(session.coe || []);
      if (!coe.length) {
        return {
          text: '**No COE timeline** in session. Complete setup (semester + COE step) so IAT and semester-end dates attach to your session.',
          type: 'warning',
        };
      }
      const scope = monthScope === 'next' ? 'next' : 'this';
      const inMonth = filterCoeInMonth(coe, today, scope);
      const label = scope === 'next' ? 'Next calendar month' : 'This calendar month';
      if (inMonth.length) {
        return {
          text: `**${label} (COE)** — includes rows whose **start→end** overlaps this month\n${formatTable(['Item', 'Date', 'Type'], inMonth.map((e) => [shortName(e.name || 'Event', 20), e.date || '—', e.type || '—']))}${coeDigestFooter(session)}`,
          type: 'info',
        };
      }
      const rows = coe.map((e) => [shortName(e.name || 'Event', 20), e.date || '—', e.type || '—']);
      return {
        text: `**No dated COE overlap** in ${label.toLowerCase()}.\n**Full synced timeline:**\n${formatTable(['Item', 'Date', 'Type'], rows)}${coeDigestFooter(session)}`,
        type: 'info',
      };
    }

    case 'COE_EVENTS': {
      const coe = sortCoeByDate(session.coe || []);
      if (!coe.length) {
        return {
          text: '**No COE data** on this session. Run setup through the **COE sync** step, or ensure the API received **semester** + **recoveryMetadata** so defaults can attach.',
          type: 'warning',
        };
      }
      const important = coe.filter((e) => ['IAT', 'Exam', 'Milestone'].includes(e.type));
      const rows = (important.length ? important : coe).map((e) => [
        shortName(e.name || 'Event', 22),
        e.date || '—',
        e.type || '—',
      ]);
      return {
        text: `**Important academic events (COE — ${session.semester || 'semester'})**\n${formatTable(['Item', 'Window / date', 'Type'], rows)}\n_Confirm all dates with official COE / notice boards._${coeDigestFooter(session)}`,
        type: 'info',
      };
    }

    case 'HOLIDAY_QUERY': {
      const coe = session.coe || [];
      const allH = (coe || []).filter(isCoeHolidayEvent);
      const fromCoe = coeHolidayList(coe, today);
      if (fromCoe.length || allH.length) {
        const totalAhead = fromCoe.length;
        const totalInCoe = allH.length;
        const rows = (fromCoe.length ? fromCoe : sortCoeByDate(allH).slice(0, 24)).slice(0, 24).map((e) => [
          shortName(e.name || 'Holiday', 36),
          e.isoEndDate && e.isoEndDate !== e.isoDate ? `${e.isoDate} → ${e.isoEndDate}` : (e.isoDate || e.date || '—'),
        ]);
        const head =
          totalAhead > 0
            ? `**Holiday-related rows from today onward:** **${totalAhead}** · **In full merged COE timeline:** **${totalInCoe}** (deduped labels; multi-day rows count once)`
            : `**No holidays dated after today** in extract — showing earliest **${rows.length}** holiday row(s) from COE (**${totalInCoe}** total in file)`;
        const more =
          (totalAhead > 24 || (totalAhead === 0 && totalInCoe > 24))
            ? `\n_Truncated for chat — see COE PDF or **important COE events** for the complete calendar._`
            : '';
        return {
          text: `**Holidays (synced COE — your PDF + registry)**\n${head}\n${formatTable(['Occasion / note', 'Date / range'], rows)}${more}${coeDigestFooter(session)}`,
          type: 'info',
        };
      }
      const upcoming = [
        { date: '2026-03-19', name: 'Anniversary' },
        { date: '2026-03-21', name: 'Holi' },
        { date: '2026-03-31', name: 'Eid' },
        { date: '2026-04-14', name: 'Ambedkar' },
        { date: '2026-05-01', name: 'Labour' },
      ].filter((h) => new Date(h.date) >= today);
      const rows = upcoming.slice(0, 6).map((h) => [
        h.name,
        new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      ]);
      return {
        text: `**Upcoming holidays** (static fallback — **upload the AY 2025-26 Even sem COE PDF** in setup for institute-accurate dates)\n${formatTable(['Occasion', 'Date'], rows)}`,
        type: 'warning',
      };
    }

    case 'RECOVERY_QUERY': {
      const rec = results?.recovery;
      if (!rec) return { text: 'Sync ERP in setup to unlock **recovery / ceiling** projections.', type: 'warning' };
      return {
        text: `**Recovery ceiling** (model assumes continued classes until **${rec.deadline}** with no further absences)\n• **Max reachable %:** **${rec.maxPercent}%**\n• **Modelled remaining classes:** **${rec.futureClasses}**\nCross-check with official calendars — this is a heuristic, not VTU/COE policy.`,
        type: 'info',
      };
    }

    case 'FALLBACK':
      return {
        text: 'I couldn’t reliably match that to an **attendance**, **bunk**, **timetable**, **COE**, or **recovery** query. I use **your last setup snapshot** (ERP demo data + merged COE timeline), not a live browser session.\n\n**Try:** “**attendance summary**”, “**can I bunk ML**”, “**Friday timetable**”, “**holidays list**”, “**COE today**”, or **help**.',
        type: 'info',
      };

    default:
      return { text: 'That intent is not wired yet — ask for **help** to see supported queries.', type: 'info' };
  }
};

module.exports = {
  classifyIntent,
  generateResponse,
  resolveAttendanceKey,
  resolveScheduleDate,
  DAY_NAMES,
};
