const fs = require('fs');
const path = require('path');

const {
  RUNTIME_SECRET_FILENAME,
  createDataBackup,
  databasePath,
  verifyDatabaseFile,
} = require('./backup');

function readManifest(backupDir) {
  const manifestPath = path.join(backupDir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Backup nema manifest.json: ${backupDir}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (![1, 2].includes(manifest.format)) {
    throw new Error(`Nepodržan backup format: ${manifest.format}`);
  }
  if (manifest.database !== 'porodicni-unos.db') {
    throw new Error('Backup manifest ne pokazuje na očekivanu bazu.');
  }
  return manifest;
}

async function restoreDataBackup(dataDir, backupDir, options = {}) {
  if (options.confirmStopped !== true) {
    throw new Error('Restore je dozvoljen samo kada je aplikacija zaustavljena.');
  }

  const manifest = readManifest(backupDir);
  const backupDbPath = path.join(backupDir, manifest.database);
  verifyDatabaseFile(backupDbPath);

  fs.mkdirSync(dataDir, { recursive: true });
  const activeDbPath = databasePath(dataDir);
  let safetyBackup = null;

  if (fs.existsSync(activeDbPath) && fs.statSync(activeDbPath).size > 0) {
    const safetyRoot = path.join(dataDir, 'backups', 'pre-restore');
    const result = await createDataBackup(dataDir, safetyRoot);
    safetyBackup = result.destination;
  }

  const restoreDbPath = `${activeDbPath}.restore`;
  fs.copyFileSync(backupDbPath, restoreDbPath);
  verifyDatabaseFile(restoreDbPath);

  fs.rmSync(`${activeDbPath}-wal`, { force: true });
  fs.rmSync(`${activeDbPath}-shm`, { force: true });
  fs.rmSync(activeDbPath, { force: true });
  fs.renameSync(restoreDbPath, activeDbPath);

  const backupUploads = path.join(backupDir, 'uploads');
  const activeUploads = path.join(dataDir, 'uploads');
  const restoreUploads = path.join(dataDir, `.uploads-restore-${process.pid}`);
  fs.rmSync(restoreUploads, { recursive: true, force: true });
  fs.mkdirSync(restoreUploads, { recursive: true });
  if (fs.existsSync(backupUploads)) {
    fs.cpSync(backupUploads, restoreUploads, { recursive: true });
  }
  fs.rmSync(activeUploads, { recursive: true, force: true });
  fs.renameSync(restoreUploads, activeUploads);

  const backupSecret = path.join(backupDir, RUNTIME_SECRET_FILENAME);
  if (fs.existsSync(backupSecret)) {
    const activeSecret = path.join(dataDir, RUNTIME_SECRET_FILENAME);
    fs.copyFileSync(backupSecret, activeSecret);
    if (process.platform !== 'win32') fs.chmodSync(activeSecret, 0o600);
  }

  verifyDatabaseFile(activeDbPath);
  return { manifest, safetyBackup };
}

module.exports = {
  readManifest,
  restoreDataBackup,
};
