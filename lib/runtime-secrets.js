const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function loadOrCreateSecret(dataDir, filename = '.admin-session-secret') {
  fs.mkdirSync(dataDir, { recursive: true });
  const secretPath = path.join(dataDir, filename);

  try {
    const existing = fs.readFileSync(secretPath, 'utf8').trim();
    if (existing) return existing;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  const generated = crypto.randomBytes(48).toString('base64url');
  let descriptor;
  try {
    descriptor = fs.openSync(secretPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${generated}\n`, 'utf8');
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    const existing = fs.readFileSync(secretPath, 'utf8').trim();
    return existing || generated;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }

  return generated;
}

module.exports = {
  loadOrCreateSecret,
};
