const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { loadOrCreateSecret } = require('../lib/runtime-secrets');

test('runtime session secret persists in DATA_DIR and is reused', () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porodicni-secret-'));
  try {
    const first = loadOrCreateSecret(dataDir);
    const second = loadOrCreateSecret(dataDir);

    assert.equal(first, second);
    assert.ok(first.length >= 48);

    const secretPath = path.join(dataDir, '.admin-session-secret');
    assert.equal(fs.readFileSync(secretPath, 'utf8').trim(), first);

    if (process.platform !== 'win32') {
      const mode = fs.statSync(secretPath).mode & 0o777;
      assert.equal(mode, 0o600);
    }
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
});
