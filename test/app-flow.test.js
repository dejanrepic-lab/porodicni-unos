const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

async function waitForHealth(baseUrl) {
  let lastError;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw lastError || new Error('Application did not become healthy');
}

test('submission can be created, read and updated through the real HTTP server', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porodicni-flow-'));
  const port = 19000 + (process.pid % 1000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.join(__dirname, '..'),
    env: {
      ...process.env,
      PORT: String(port),
      DATA_DIR: dataDir,
      ADMIN_USER: 'admin',
      ADMIN_PASSWORD: 'test-admin-password',
      ADMIN_SESSION_SECRET: 'test-session-secret',
      FORM_ACCESS_PASSWORD: '',
      SUBMIT_RATE_LIMIT: '20',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

  t.after(() => {
    child.kill('SIGTERM');
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  await waitForHealth(baseUrl);

  const createForm = new FormData();
  createForm.append('payload', JSON.stringify({
    type: 'pojedinac',
    firstName: 'Test',
    lastName: 'Osoba',
    title: 'Test Osoba',
    submittedBy: 'CI',
  }));
  const createResponse = await fetch(`${baseUrl}/api/submissions`, {
    method: 'POST',
    body: createForm,
  });
  assert.equal(createResponse.status, 200, stderr);
  const created = await createResponse.json();
  assert.equal(created.ok, true);
  assert.ok(created.publicId);

  const receiptResponse = await fetch(`${baseUrl}/api/receipt/${created.publicId}`);
  assert.equal(receiptResponse.status, 200);
  const receipt = await receiptResponse.json();
  assert.equal(receipt.title, 'Test Osoba');
  assert.equal(receipt.payload.firstName, 'Test');

  const updateForm = new FormData();
  updateForm.append('payload', JSON.stringify({
    type: 'pojedinac',
    firstName: 'Test',
    lastName: 'Osoba',
    title: 'Test Osoba izmjena',
    submittedBy: 'CI',
  }));
  const updateResponse = await fetch(`${baseUrl}/api/submissions/${created.publicId}/update`, {
    method: 'POST',
    body: updateForm,
  });
  assert.equal(updateResponse.status, 200, stderr);
  const updated = await updateResponse.json();
  assert.equal(updated.ok, true);
  assert.equal(updated.title, 'Test Osoba izmjena');

  const updatedReceiptResponse = await fetch(`${baseUrl}/api/receipt/${created.publicId}`);
  const updatedReceipt = await updatedReceiptResponse.json();
  assert.equal(updatedReceipt.title, 'Test Osoba izmjena');
  assert.ok(updatedReceipt.updated_at);
});
