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

async function createSubmission(baseUrl, title, fileName) {
  const form = new FormData();
  form.append('payload', JSON.stringify({
    type: 'pojedinac',
    firstName: title,
    lastName: 'Test',
    title,
    submittedBy: 'CI',
  }));
  form.append('files', new Blob([`content-${title}`], { type: 'application/pdf' }), fileName);

  const response = await fetch(`${baseUrl}/api/submissions`, {
    method: 'POST',
    body: form,
  });
  assert.equal(response.status, 200);
  return response.json();
}

async function adminLogin(baseUrl) {
  const response = await fetch(`${baseUrl}/admin/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      username: 'admin',
      password: 'test-admin-password',
      next: '/admin',
    }),
    redirect: 'manual',
  });
  assert.equal(response.status, 302);
  const setCookie = response.headers.get('set-cookie') || '';
  assert.match(setCookie, /porodicni_admin=/);
  return setCookie.split(';')[0];
}

test('admin bulk delete removes submissions, attachments and physical upload files', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porodicni-delete-'));
  const port = 20000 + (process.pid % 1000);
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

  const first = await createSubmission(baseUrl, 'Prvi unos', 'prvi.pdf');
  const second = await createSubmission(baseUrl, 'Drugi unos', 'drugi.pdf');

  const dbPath = path.join(dataDir, 'porodicni-unos.db');
  let database = new Database(dbPath, { readonly: true });
  const submissionsBefore = database.prepare('SELECT id FROM submissions ORDER BY id').all();
  const attachmentsBefore = database.prepare('SELECT stored_name FROM attachments ORDER BY id').all();
  database.close();

  assert.equal(submissionsBefore.length, 2, stderr);
  assert.equal(attachmentsBefore.length, 2, stderr);
  assert.deepEqual(submissionsBefore.map((row) => row.id), [first.id, second.id]);

  const uploadDir = path.join(dataDir, 'uploads');
  for (const attachment of attachmentsBefore) {
    assert.equal(fs.existsSync(path.join(uploadDir, attachment.stored_name)), true);
  }

  const sessionCookie = await adminLogin(baseUrl);
  const deleteBody = new URLSearchParams();
  deleteBody.append('ids', String(first.id));
  deleteBody.append('ids', String(second.id));
  deleteBody.append('view', 'active');

  const deleteResponse = await fetch(`${baseUrl}/admin/submissions/bulk-delete`, {
    method: 'POST',
    headers: {
      cookie: sessionCookie,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: deleteBody,
    redirect: 'manual',
  });
  assert.equal(deleteResponse.status, 302, stderr);
  assert.equal(deleteResponse.headers.get('location'), '/admin?view=active');

  database = new Database(dbPath, { readonly: true });
  const submissionCount = database.prepare('SELECT COUNT(*) AS c FROM submissions').get().c;
  const attachmentCount = database.prepare('SELECT COUNT(*) AS c FROM attachments').get().c;
  const historyCount = database.prepare('SELECT COUNT(*) AS c FROM submission_history').get().c;
  database.close();

  assert.equal(submissionCount, 0);
  assert.equal(attachmentCount, 0);
  assert.equal(historyCount, 0);

  for (const attachment of attachmentsBefore) {
    assert.equal(fs.existsSync(path.join(uploadDir, attachment.stored_name)), false);
  }
  assert.deepEqual(fs.readdirSync(uploadDir), []);
});
