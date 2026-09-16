const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { initializeDatabase } = require('../lib/database');

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'porodicni-db-'));
}

function columnNames(db, table) {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
}

function indexNames(db, table) {
  return db.prepare(`PRAGMA index_list(${table})`).all().map((row) => row.name);
}

test('database bootstrap creates the current schema and is idempotent', () => {
  const dir = tempDir();
  try {
    let db = initializeDatabase(dir);
    assert.equal(db.pragma('journal_mode', { simple: true }), 'wal');
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
    assert.equal(db.pragma('busy_timeout', { simple: true }), 10000);
    assert.ok(columnNames(db, 'submissions').includes('updated_at'));
    assert.ok(columnNames(db, 'submission_history').includes('changed_by'));
    assert.ok(columnNames(db, 'submission_history').includes('changed_via'));
    assert.ok(indexNames(db, 'submissions').includes('idx_submissions_status_activity'));

    db.prepare(`INSERT INTO submissions
      (public_id,type,title,submitted_by,payload_json,status,created_at)
      VALUES (?,?,?,?,?,'novo',?)`)
      .run('keep-me', 'porodica', 'Test porodica', 'Tester', '{}', new Date().toISOString());
    db.close();

    db = initializeDatabase(dir);
    assert.equal(db.prepare('SELECT title FROM submissions WHERE public_id=?').get('keep-me').title, 'Test porodica');
    assert.equal(db.pragma('busy_timeout', { simple: true }), 10000);
    assert.ok(indexNames(db, 'submissions').includes('idx_submissions_status_activity'));
    db.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('database bootstrap upgrades a legacy schema without losing rows', () => {
  const dir = tempDir();
  const dbPath = path.join(dir, 'porodicni-unos.db');
  try {
    const legacy = new Database(dbPath);
    legacy.exec(`
      CREATE TABLE submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        public_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        submitted_by TEXT,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'novo',
        created_at TEXT NOT NULL
      );
      CREATE TABLE submission_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        public_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        title TEXT,
        submitted_by TEXT,
        saved_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
    legacy.prepare(`INSERT INTO submissions
      (public_id,type,title,submitted_by,payload_json,status,created_at)
      VALUES (?,?,?,?,?,'novo',?)`)
      .run('legacy-row', 'pojedinac', 'Stari unos', 'Tester', '{}', new Date().toISOString());
    legacy.close();

    const db = initializeDatabase(dir);
    assert.ok(columnNames(db, 'submissions').includes('updated_at'));
    assert.ok(columnNames(db, 'submission_history').includes('changed_by'));
    assert.ok(columnNames(db, 'submission_history').includes('changed_via'));
    assert.ok(indexNames(db, 'submissions').includes('idx_submissions_status_activity'));
    assert.equal(db.prepare('SELECT title FROM submissions WHERE public_id=?').get('legacy-row').title, 'Stari unos');
    db.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('database bootstrap refuses an existing database with foreign-key corruption', () => {
  const dir = tempDir();
  const dbPath = path.join(dir, 'porodicni-unos.db');
  try {
    const broken = new Database(dbPath);
    broken.exec(`
      PRAGMA foreign_keys = OFF;
      CREATE TABLE submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        public_id TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        submitted_by TEXT,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'novo',
        created_at TEXT NOT NULL
      );
      CREATE TABLE attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL,
        mime_type TEXT,
        size INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE
      );
    `);
    broken.prepare(`INSERT INTO attachments
      (submission_id,original_name,stored_name,mime_type,size,created_at)
      VALUES (?,?,?,?,?,?)`)
      .run(999, 'orphan.pdf', 'orphan.pdf', 'application/pdf', 10, new Date().toISOString());
    broken.close();

    assert.throws(
      () => initializeDatabase(dir),
      /foreign-key grešaka/,
    );

    const inspect = new Database(dbPath, { readonly: true });
    assert.equal(inspect.prepare('SELECT COUNT(*) AS count FROM attachments').get().count, 1);
    assert.equal(columnNames(inspect, 'submissions').includes('updated_at'), false);
    inspect.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
