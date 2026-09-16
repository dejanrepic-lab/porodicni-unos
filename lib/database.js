const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function ensureColumn(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function verifyDatabaseIntegrity(db) {
  const quickCheck = db.pragma('quick_check', { simple: true });
  if (quickCheck !== 'ok') {
    throw new Error(`SQLite quick_check nije prošao: ${quickCheck}`);
  }

  const foreignKeyErrors = db.pragma('foreign_key_check');
  if (foreignKeyErrors.length) {
    throw new Error(`Baza ima ${foreignKeyErrors.length} foreign-key grešaka.`);
  }
}

function initializeDatabase(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, 'porodicni-unos.db');
  const existingDatabase = fs.existsSync(dbPath) && fs.statSync(dbPath).size > 0;
  const db = new Database(dbPath);

  try {
    if (existingDatabase) verifyDatabaseIntegrity(db);

    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 10000');

    db.exec(`
      CREATE TABLE IF NOT EXISTS submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        public_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        submitted_by TEXT,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'novo',
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        mime_type TEXT,
        size INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_attachments_submission ON attachments(submission_id);

      CREATE TABLE IF NOT EXISTS submission_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        public_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        title TEXT,
        submitted_by TEXT,
        saved_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_submission_history_submission_id
        ON submission_history(submission_id);
    `);

    ensureColumn(db, 'submission_history', 'changed_by', 'TEXT');
    ensureColumn(db, 'submission_history', 'changed_via', 'TEXT');
    ensureColumn(db, 'submissions', 'updated_at', 'TEXT');

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_submissions_status_activity
        ON submissions(status, updated_at DESC, created_at DESC, id DESC);
    `);

    verifyDatabaseIntegrity(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

module.exports = {
  initializeDatabase,
  verifyDatabaseIntegrity,
};
