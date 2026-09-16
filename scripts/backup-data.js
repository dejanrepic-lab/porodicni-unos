const path = require('path');

const { createDataBackup } = require('../lib/backup');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const backupRoot = process.env.BACKUP_DIR || path.join(dataDir, 'backups');

createDataBackup(dataDir, backupRoot)
  .then(({ destination, manifest }) => {
    console.log(`Backup je napravljen: ${destination}`);
    console.log(`Upload fajlova: ${manifest.uploadFiles}`);
  })
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
