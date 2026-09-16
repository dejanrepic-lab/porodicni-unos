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

function jpegBlob() {
  return new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
}

test('rejected update removes incoming upload files and preserves existing attachments', async (t) => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'porodicni-upload-'));
  const port = 21000 + (process.pid % 1000);
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
    firstName: 'Upload',
    lastName: 'Test',
    title: 'Upload Test',
    submittedBy: 'CI',
  }));
  for (let index = 1; index <= 10; index += 1) {
    createForm.append('files', jpegBlob(), `foto-${index}.jpg`);
  }

  const createResponse = await fetch(`${baseUrl}/api/submissions`, {
    method: 'POST',
    body: createForm,
  });
  assert.equal(createResponse.status, 200, stderr);
  const created = await createResponse.json();
  assert.equal(created.files.length, 10);

  const uploadsDir = path.join(dataDir, 'uploads');
  assert.equal(fs.readdirSync(uploadsDir).length, 10);

  const updateForm = new FormData();
  updateForm.append('payload', JSON.stringify({
    type: 'pojedinac',
    firstName: 'Upload',
    lastName: 'Test',
    title: 'Upload Test izmjena',
    submittedBy: 'CI',
  }));
  updateForm.append('files', jpegBlob(), 'jedanaesta.jpg');

  const updateResponse = await fetch(`${baseUrl}/api/submissions/${created.publicId}/update`, {
    method: 'POST',
    body: updateForm,
  });
  assert.equal(updateResponse.status, 400, stderr);
  assert.deepEqual(await updateResponse.json(), {
    error: 'Ukupno može biti najviše 10 priloženih fajlova.',
  });

  assert.equal(fs.readdirSync(uploadsDir).length, 10);

  const database = new Database(path.join(dataDir, 'porodicni-unos.db'), { readonly: true });
  const attachmentCount = database.prepare(`
    SELECT COUNT(*) AS count
    FROM attachments
    WHERE submission_id=?
  `).get(created.id).count;
  const title = database.prepare('SELECT title FROM submissions WHERE id=?').get(created.id).title;
  database.close();

  assert.equal(attachmentCount, 10);
  assert.equal(title, 'Upload Test');
});
