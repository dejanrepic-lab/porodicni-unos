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

test('database bootstrap creates the current schema and is idempotent', () => {
  const dir = tempDir();
  try {
    let db = initializeDatabase(dir);
    assert.equal(db.pragma('journal_mode', { simple: true }), 'wal');
    assert.equal(db.pragma('foreign_keys', { simple: true }), 1);
    assert.ok(columnNames(db, 'submissions').includes('updated_at'));
    assert.ok(columnNames(db, 'submission_history').includes('changed_by'));
    assert.ok(columnNames(db, 'submission_history').includes('changed_via'));

    db.prepare(`INSERT INTO submissions
      (public_id,type,title,submitted_by,payload_json,status,created_at)
      VALUES (?,?,?,?,?,'novo',?)`)
      .run('keep-me', 'porodica', 'Test porodica', 'Tester', '{}', new Date().toISOString());
    db.close();

    db = initializeDatabase(dir);
    assert.equal(db.prepare('SELECT title FROM submissions WHERE public_id=?').get('keep-me').title, 'Test porodica');
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
    assert.equal(db.prepare('SELECT title FROM submissions WHERE public_id=?').get('legacy-row').title, 'Stari unos');
    db.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
