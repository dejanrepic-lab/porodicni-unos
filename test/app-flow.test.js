const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const Database = require('better-sqlite3');

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

test('submission flow and admin authentication work through the real HTTP server', async (t) => {
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

  const database = new Database(path.join(dataDir, 'porodicni-unos.db'), { readonly: true });
  const history = database.prepare(`
    SELECT payload_json,title,submitted_by,changed_by,changed_via
    FROM submission_history
    WHERE public_id=?
    ORDER BY id
  `).all(created.publicId);
  database.close();
  assert.equal(history.length, 1);
  assert.equal(history[0].title, 'Test Osoba');
  assert.equal(history[0].submitted_by, 'CI');
  assert.equal(history[0].changed_by, 'CI');
  assert.equal(history[0].changed_via, 'private_link');
  assert.equal(JSON.parse(history[0].payload_json).title, 'Test Osoba');

  const anonymousAdmin = await fetch(`${baseUrl}/admin`, { redirect: 'manual' });
  assert.equal(anonymousAdmin.status, 302);
  assert.equal(anonymousAdmin.headers.get('location'), '/admin/login?next=%2Fadmin');

  const wrongLogin = await fetch(`${baseUrl}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username: 'admin',
      password: 'wrong-password',
      next: '/admin',
    }),
    redirect: 'manual',
  });
  assert.equal(wrongLogin.status, 401);

  const login = await fetch(`${baseUrl}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username: 'admin',
      password: 'test-admin-password',
      next: '/admin',
    }),
    redirect: 'manual',
  });
  assert.equal(login.status, 302);
  assert.equal(login.headers.get('location'), '/admin');

  const setCookie = login.headers.get('set-cookie') || '';
  assert.match(setCookie, /porodicni_admin=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\/admin/i);
  const sessionCookie = setCookie.split(';')[0];

  const authenticatedAdmin = await fetch(`${baseUrl}/admin`, {
    headers: { cookie: sessionCookie },
    redirect: 'manual',
  });
  assert.equal(authenticatedAdmin.status, 200);
  const adminPage = await authenticatedAdmin.text();
  assert.match(adminPage, /Primljeni odgovori/);
  assert.match(adminPage, /Test Osoba izmjena/);
});
