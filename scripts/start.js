const path = require('path');

const { loadOrCreateSecret } = require('../lib/runtime-secrets');

const projectRoot = path.join(__dirname, '..');
const dataDir = process.env.DATA_DIR || path.join(projectRoot, 'data');

if (!String(process.env.ADMIN_SESSION_SECRET || '').trim()) {
  process.env.ADMIN_SESSION_SECRET = loadOrCreateSecret(dataDir);
}

const adminPassword = String(process.env.ADMIN_PASSWORD || '').trim();
if (!adminPassword || ['promijeni-me', 'PROMIJENI-OVU-LOZINKU'].includes(adminPassword)) {
  console.warn('[security] ADMIN_PASSWORD nije postavljen na sigurnu vrijednost.');
}

require('../server');
