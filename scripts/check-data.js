const path = require('path');

const { databasePath, verifyDatabaseFile } = require('../lib/backup');

const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const dbPath = databasePath(dataDir);

try {
  const result = verifyDatabaseFile(dbPath);
  console.log(`Baza je ispravna: ${dbPath}`);
  console.log(`quick_check: ${result.quickCheck}; foreign-key greške: ${result.foreignKeyErrors}`);
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
}
