require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { scrapeAttendance, getScraperMode } = require('./utils/scraper');
const {
  classifyIntent,
  generateResponse,
  resolveAttendanceKey,
  resolveScheduleDate,
  DAY_NAMES,
} = require('./utils/decisionEngine');
const { calculateNeededToReachTarget, aggregateDailyRisk, calculateRecoveryPath } = require('./utils/attendanceCalculator');
const { getScheduleForDate, EMPTY_GRID_STRINGS } = require('./utils/timetableLogic');
const { buildCoeTimeline } = require('./utils/coeRegistry');
const { mergeCoeEvents } = require('./utils/coeMerge');

const { saveSession, getSession } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(
  cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((s) => s.trim()),
    credentials: true
  })
);
app.use(bodyParser.json({ limit: '10mb' }));

/** One-off ERP sync â€” call from setup step 2 before /api/setup */
app.post('/api/erp-sync', async (req, res) => {
  const { userId, password } = req.body || {};
  if (!userId || !password) {
    return res.status(400).json({ error: 'userId and password required' });
  }
  try {
    const attendance = await scrapeAttendance(userId, password);
    res.json({
      attendance,
      mode: getScraperMode() === 'live' ? 'live' : 'demo',
    });
  } catch (err) {
    console.error('[erp-sync]', err.message || err);
    res.status(502).json({ error: err.message || 'ERP sync failed' });
  }
});

app.post('/api/setup', async (req, res) => {
  const { sessionId, semester, batch, credentials, coeEvents, finalGrid, recoveryMetadata, attendance: clientAttendance } = req.body;
  if (!sessionId) return res.status(400).json({ error: "Session ID required" });

  try {
    let attendance = clientAttendance;
    const hasClientAttendance =
      (clientAttendance || req.body.attendanceRecord) &&
      typeof (clientAttendance || req.body.attendanceRecord) === 'object' &&
      !Array.isArray(clientAttendance || req.body.attendanceRecord) &&
      Object.keys(clientAttendance || req.body.attendanceRecord).length > 0;

    if (!hasClientAttendance) {
      if (!credentials?.userId || !credentials?.password) {
        return res.status(400).json({ error: 'ERP credentials/attendance required.' });
      }
      attendance = await scrapeAttendance(credentials.userId, credentials.password);
    } else {
      attendance = clientAttendance || req.body.attendanceRecord;
    }
    
    const fromClient = Array.isArray(coeEvents) ? coeEvents : [];
    const registryFallback = buildCoeTimeline(semester || 'Sixth Sem', recoveryMetadata);
    const coe = mergeCoeEvents(fromClient, registryFallback);

    const sessionData = {
      semester: semester || 'Sixth Sem',
      batch: batch || 'A1',
      credentials: credentials?.userId ? { userId: credentials.userId } : {},
      timetable: finalGrid || EMPTY_GRID_STRINGS(),
      coe,
      coeOcrSummary: req.body.coeOcrSummary || null,
      attendance,
      history: [],
      lastWorkingDay: recoveryMetadata?.lastWorkingDay || 'May 16, 2026'
    };

    saveSession(sessionId, sessionData);

    console.log(`[Setup] Session stored for ${credentials?.userId || 'unknown'}. (live logic active)`);
    res.json({ message: "Setup complete", safe: true, fetched: !!attendance });
  } catch (err) {
    console.error('[Setup Error]', err.message || err);
    res.status(500).json({ error: "Failed to initialize secure session" });
  }
});

app.get('/api/session/:id', (req, res) => {
  const session = getSession(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  res.json(session);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, erpMode: getScraperMode() });
});

app.post('/api/chat', async (req, res) => {
  const { sessionId, message } = req.body;
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: "Session not found. Please refresh and complete setup." });

  const analysis = classifyIntent(message);
  const scheduleDayLabel = ['BUNK_QUERY', 'SCHEDULE_QUERY', 'TODAY_SCHEDULE', 'TOMORROW_SCHEDULE'].includes(
    analysis.intent
  )
    ? DAY_NAMES[resolveScheduleDate(analysis).getDay()]
    : undefined;

  let results = {};

  if (['BUNK_QUERY', 'SCHEDULE_QUERY', 'TODAY_SCHEDULE', 'TOMORROW_SCHEDULE'].includes(analysis.intent)) {
    const day = resolveScheduleDate(analysis);
    const schedule = getScheduleForDate(day, session.timetable, session.batch, session.coe);
    const att = session.attendance || {};

    if (analysis.intent === 'BUNK_QUERY') {
      const erpSlices = schedule
        .map((s) => {
          const key = resolveAttendanceKey(s.subject, att);
          return key ? { name: key, type: s.type } : null;
        })
        .filter(Boolean);
      const dailyRisk = aggregateDailyRisk(erpSlices, att);
      results = { ...dailyRisk, schedule };
    } else {
      results = { schedule };
    }
  }

  if (['ATTENDANCE_SUMMARY', 'MAX_BUNK_QUERY', 'MULTI_BUNK_QUERY', 'RISK_CHECK'].includes(analysis.intent)) {
    results = { ...results, attendance: session.attendance };
  }

  if (analysis.intent === 'NEEDED_CLASSES' && analysis.subject) {
    const subData = (session.attendance && session.attendance[analysis.subject]) || { attended: 0, total: 0 };
    results = {
      ...results,
      subject: analysis.subject,
      needed: calculateNeededToReachTarget(subData.attended, subData.total),
    };
  }

  if (analysis.intent === 'IAT_QUERY') {
    const coe = session.coe || [];
    results = {
      ...results,
      iat: coe.filter((e) => e.type === 'IAT').map((e) => `${e.name}: ${e.date}`).join(' | ') || null,
    };
  }

  if (analysis.intent === 'RECOVERY_QUERY' || analysis.intent === 'WEEKLY_SUMMARY') {
    const totalAttended = Object.values(session.attendance || {}).reduce((acc, curr) => acc + curr.attended, 0);
    const totalConducted = Object.values(session.attendance || {}).reduce((acc, curr) => acc + curr.total, 0);
    results = {
      ...results,
      recovery: calculateRecoveryPath(totalAttended, totalConducted, 6, session.lastWorkingDay),
    };
  }

  const response = generateResponse({
    intent: analysis.intent,
    results,
    session,
    time: analysis.time,
    subject: analysis.subject,
    multiSubjects: analysis.multiSubjects,
    scheduleDayLabel,
    monthScope: analysis.monthScope,
  });

  // Persist history
  session.history.push({ role: 'user', content: message });
  session.history.push({ role: 'bot', content: response.text });
  saveSession(sessionId, session);

  res.json(response);
});

app.listen(Number(PORT), '0.0.0.0', () => console.log(`Server running on http://0.0.0.0:${PORT}`));
