const path = require('path');

const { restoreDataBackup } = require('../lib/restore');

const args = process.argv.slice(2);
const confirmStopped = args.includes('--confirm-stopped');
const backupArg = args.find((arg) => !arg.startsWith('--'));

if (!backupArg) {
  console.error('Upotreba: npm run data:restore -- /putanja/do/backupa --confirm-stopped');
  process.exit(2);
}

const projectRoot = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');
const backupDir = path.resolve(backupArg);

restoreDataBackup(dataDir, backupDir, { confirmStopped })
  .then(({ safetyBackup }) => {
    console.log(`Restore je završen iz: ${backupDir}`);
    if (safetyBackup) console.log(`Safety backup prethodnog stanja: ${safetyBackup}`);
  })
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  });
