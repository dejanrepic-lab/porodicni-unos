const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const RUNTIME_SECRET_FILENAME = '.admin-session-secret';

function databasePath(dataDir) {
  return path.join(dataDir, 'porodicni-unos.db');
}

function verifyDatabaseFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Baza ne postoji: ${filePath}`);
  }

  const db = new Database(filePath, { readonly: true, fileMustExist: true });
  try {
    const quickCheck = db.pragma('quick_check', { simple: true });
    if (quickCheck !== 'ok') {
      throw new Error(`SQLite quick_check nije prošao: ${quickCheck}`);
    }
    const foreignKeyErrors = db.pragma('foreign_key_check');
    if (foreignKeyErrors.length) {
      throw new Error(`Baza ima ${foreignKeyErrors.length} foreign-key grešaka.`);
    }
    return { quickCheck, foreignKeyErrors: 0 };
  } finally {
    db.close();
  }
}

function countFiles(root) {
  if (!fs.existsSync(root)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) count += countFiles(full);
    else if (entry.isFile()) count += 1;
  }
  return count;
}

function safeTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

async function createDataBackup(dataDir, backupRoot, now = new Date()) {
  const sourceDbPath = databasePath(dataDir);
  verifyDatabaseFile(sourceDbPath);

  fs.mkdirSync(backupRoot, { recursive: true });
  const destination = path.join(backupRoot, `porodicni-unos-${safeTimestamp(now)}`);
  fs.mkdirSync(destination, { recursive: false });

  const backupDbPath = path.join(destination, 'porodicni-unos.db');
  const sourceDb = new Database(sourceDbPath, { readonly: true, fileMustExist: true });
  try {
    await sourceDb.backup(backupDbPath);
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    throw error;
  } finally {
    sourceDb.close();
  }

  try {
    verifyDatabaseFile(backupDbPath);

    const uploadsSource = path.join(dataDir, 'uploads');
    const uploadsDestination = path.join(destination, 'uploads');
    if (fs.existsSync(uploadsSource)) {
      fs.cpSync(uploadsSource, uploadsDestination, { recursive: true });
    }

    const secretSource = path.join(dataDir, RUNTIME_SECRET_FILENAME);
    const secretDestination = path.join(destination, RUNTIME_SECRET_FILENAME);
    const runtimeSecretIncluded = fs.existsSync(secretSource);
    if (runtimeSecretIncluded) {
      fs.copyFileSync(secretSource, secretDestination);
      if (process.platform !== 'win32') fs.chmodSync(secretDestination, 0o600);
    }

    const manifest = {
      format: 2,
      createdAt: now.toISOString(),
      database: 'porodicni-unos.db',
      uploadFiles: countFiles(uploadsDestination),
      runtimeSecretIncluded,
    };
    fs.writeFileSync(
      path.join(destination, 'manifest.json'),
      `${JSON.stringify(manifest, null, 2)}\n`,
      'utf8',
    );
    return { destination, manifest };
  } catch (error) {
    fs.rmSync(destination, { recursive: true, force: true });
    throw error;
  }
}

module.exports = {
  RUNTIME_SECRET_FILENAME,
  createDataBackup,
  databasePath,
  verifyDatabaseFile,
};
