const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

const { createDataBackup, verifyDatabaseFile } = require('../lib/backup');
const { initializeDatabase } = require('../lib/database');

test('backup contains a verified SQLite snapshot, uploads, secret and manifest', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'porodicni-backup-'));
  const dataDir = path.join(root, 'data');
  const backupRoot = path.join(root, 'backups');

  try {
    const db = initializeDatabase(dataDir);
    db.prepare(`INSERT INTO submissions
      (public_id,type,title,submitted_by,payload_json,status,created_at)
      VALUES (?,?,?,?,?,'novo',?)`)
      .run('backup-row', 'porodica', 'Porodica za backup', 'Tester', '{}', new Date().toISOString());
    db.close();

    const uploadsDir = path.join(dataDir, 'uploads');
    fs.mkdirSync(uploadsDir, { recursive: true });
    fs.writeFileSync(path.join(uploadsDir, 'dokaz.pdf'), '%PDF-1.4\ntest\n');
    fs.writeFileSync(path.join(dataDir, '.admin-session-secret'), 'persistent-secret\n', { mode: 0o600 });

    const now = new Date('2026-09-16T04:00:00.000Z');
    const { destination, manifest } = await createDataBackup(dataDir, backupRoot, now);

    assert.equal(manifest.format, 2);
    assert.equal(manifest.createdAt, now.toISOString());
    assert.equal(manifest.uploadFiles, 1);
    assert.equal(manifest.runtimeSecretIncluded, true);
    assert.ok(fs.existsSync(path.join(destination, 'manifest.json')));
    assert.equal(fs.readFileSync(path.join(destination, 'uploads', 'dokaz.pdf'), 'utf8'), '%PDF-1.4\ntest\n');
    assert.equal(
      fs.readFileSync(path.join(destination, '.admin-session-secret'), 'utf8').trim(),
      'persistent-secret',
    );

    const backupDbPath = path.join(destination, 'porodicni-unos.db');
    assert.deepEqual(verifyDatabaseFile(backupDbPath), { quickCheck: 'ok', foreignKeyErrors: 0 });

    const backupDb = new Database(backupDbPath, { readonly: true });
    assert.equal(
      backupDb.prepare('SELECT title FROM submissions WHERE public_id=?').get('backup-row').title,
      'Porodica za backup',
    );
    backupDb.close();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
