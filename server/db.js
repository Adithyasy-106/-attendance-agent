const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'attendance_sessions.sqlite');
const db = new Database(dbPath);

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    userId TEXT,
    semester TEXT,
    batch TEXT,
    attendance TEXT,  -- JSON string
    coe TEXT,         -- JSON string
    timetable TEXT,   -- JSON string
    recovery_meta TEXT, -- JSON string
    history TEXT,      -- JSON string
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

/**
 * Persist or update a user session.
 * @param {string} id - Session ID (UUID)
 * @param {object} data - Session data object
 */
function saveSession(id, data) {
  const stmt = db.prepare(`
    INSERT INTO sessions (id, userId, semester, batch, attendance, coe, timetable, recovery_meta, history)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      userId = excluded.userId,
      semester = excluded.semester,
      batch = excluded.batch,
      attendance = excluded.attendance,
      coe = excluded.coe,
      timetable = excluded.timetable,
      recovery_meta = excluded.recovery_meta,
      history = excluded.history,
      updated_at = CURRENT_TIMESTAMP
  `);

  stmt.run(
    id,
    data.credentials?.userId || null,
    data.semester,
    data.batch,
    JSON.stringify(data.attendance),
    JSON.stringify(data.coe),
    JSON.stringify(data.timetable),
    JSON.stringify({ 
      lastWorkingDay: data.lastWorkingDay,
      ocrSummary: data.coeOcrSummary
    }),
    JSON.stringify(data.history || [])
  );
}

/**
 * Retrieve a session by ID.
 * @param {string} id - Session ID
 * @returns {object|null} - Rehydrated session object or null
 */
function getSession(id) {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!row) return null;

  const recoveryMeta = JSON.parse(row.recovery_meta || '{}');

  return {
    sessionId: row.id,
    semester: row.semester,
    batch: row.batch,
    credentials: { userId: row.userId },
    attendance: JSON.parse(row.attendance),
    coe: JSON.parse(row.coe),
    timetable: JSON.parse(row.timetable),
    history: JSON.parse(row.history),
    lastWorkingDay: recoveryMeta.lastWorkingDay,
    coeOcrSummary: recoveryMeta.ocrSummary
  };
}

module.exports = { saveSession, getSession };
