const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { createDataBackup } = require('../lib/backup');
const { initializeDatabase } = require('../lib/database');
const { restoreDataBackup } = require('../lib/restore');

function titleFromDatabase(dbPath) {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    return db.prepare('SELECT title FROM submissions WHERE public_id=?').get('restore-row').title;
  } finally {
    db.close();
  }
}

test('restore requires stopped confirmation, restores all data and preserves current state first', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'porodicni-restore-'));
  const dataDir = path.join(root, 'data');
  const backupRoot = path.join(root, 'saved-backups');

  try {
    let db = initializeDatabase(dataDir);
    db.prepare(`INSERT INTO submissions
      (public_id,type,title,submitted_by,payload_json,status,created_at)
      VALUES (?,?,?,?,?,'novo',?)`)
      .run('restore-row', 'porodica', 'Stanje A', 'Tester', '{}', new Date().toISOString());
    db.close();

    const uploadsDir = path.join(dataDir, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, 'stanje-a.pdf'), 'A');
    fs.writeFileSync(path.join(dataDir, '.admin-session-secret'), 'secret-a\n', { mode: 0o600 });

    const { destination: savedBackup } = await createDataBackup(
      dataDir,
      backupRoot,
      new Date('2026-09-16T05:00:00.000Z'),
    );

    db = initializeDatabase(dataDir);
    db.prepare('UPDATE submissions SET title=? WHERE public_id=?').run('Stanje B', 'restore-row');
    db.close();
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, 'stanje-b.pdf'), 'B');
    fs.writeFileSync(path.join(dataDir, '.admin-session-secret'), 'secret-b\n', { mode: 0o600 });

    await assert.rejects(
      restoreDataBackup(dataDir, savedBackup),
      /aplikacija zaustavljena/,
    );
    assert.equal(titleFromDatabase(path.join(dataDir, 'porodicni-unos.db')), 'Stanje B');

    const { safetyBackup } = await restoreDataBackup(dataDir, savedBackup, {
      confirmStopped: true,
    });

    assert.ok(safetyBackup);
    assert.equal(titleFromDatabase(path.join(dataDir, 'porodicni-unos.db')), 'Stanje A');
    assert.equal(fs.readFileSync(path.join(uploadsDir, 'stanje-a.pdf'), 'utf8'), 'A');
    assert.equal(fs.existsSync(path.join(uploadsDir, 'stanje-b.pdf')), false);
    assert.equal(
      fs.readFileSync(path.join(dataDir, '.admin-session-secret'), 'utf8').trim(),
      'secret-a',
    );

    assert.equal(titleFromDatabase(path.join(safetyBackup, 'porodicni-unos.db')), 'Stanje B');
    assert.equal(fs.readFileSync(path.join(safetyBackup, 'uploads', 'stanje-b.pdf'), 'utf8'), 'B');
    assert.equal(
      fs.readFileSync(path.join(safetyBackup, '.admin-session-secret'), 'utf8').trim(),
      'secret-b',
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
