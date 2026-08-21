const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const Database = require('better-sqlite3');

const app = express();
app.set('trust proxy', 1);
app.use((req, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  next();
});
const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'porodicni-unos.db');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'promijeni-me';
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_COOKIE = 'porodicni_admin';
const ADMIN_SESSION_HOURS = Math.max(1, Number(process.env.ADMIN_SESSION_HOURS || 12));
const FORM_ACCESS_PASSWORD = process.env.FORM_ACCESS_PASSWORD || '';
const FORM_ACCESS_DAYS = Math.max(1, Number(process.env.FORM_ACCESS_DAYS || 7));
const SUBMIT_RATE_LIMIT = Math.max(1, Number(process.env.SUBMIT_RATE_LIMIT || 5));
const FORM_COOKIE = 'porodicni_form_access';
const FORM_COOKIE_SECRET = process.env.FORM_COOKIE_SECRET || ADMIN_SESSION_SECRET;
const MAX_UPLOAD_MB = Math.max(1, Number(process.env.MAX_UPLOAD_MB || 15));

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  submitted_by TEXT,
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'novo',
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL,
  mime_type TEXT,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON submissions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attachments_submission ON attachments(submission_id);
`);

function esc(v='') {
  return String(v).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function cleanFilename(name='file') {
  return name.normalize('NFKD').replace(/[^a-zA-Z0-9._-]+/g, '_').slice(-120) || 'file';
}
function parseCookies(req) {
  const out = {};
  const raw = req.headers.cookie || '';
  raw.split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  });
  return out;
}
function signSession(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}
function verifySession(token='') {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return false;
    const expected = crypto.createHmac('sha256', ADMIN_SESSION_SECRET).update(data).digest('base64url');
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    return payload.user === ADMIN_USER && Number(payload.exp || 0) > Date.now();
  } catch {
    return false;
  }
}

function signFormAccess() {
  const data = Buffer.from(JSON.stringify({
    ok: true,
    exp: Date.now() + FORM_ACCESS_DAYS * 24 * 60 * 60 * 1000
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', FORM_COOKIE_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}
function verifyFormAccess(token='') {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return false;
    const expected = crypto.createHmac('sha256', FORM_COOKIE_SECRET).update(data).digest('base64url');
    if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    return payload.ok === true && Number(payload.exp || 0) > Date.now();
  } catch {
    return false;
  }
}
function formAccessRequired(req, res, next) {
  // Ako šifra nije podešena, forma ostaje otvorena.
  if (!FORM_ACCESS_PASSWORD) return next();
  const token = parseCookies(req)[FORM_COOKIE];
  if (verifyFormAccess(token)) return next();
  const nextUrl = encodeURIComponent(req.originalUrl || '/');
  return res.redirect(`/access?next=${nextUrl}`);
}

function adminAuth(req, res, next) {
  const token = parseCookies(req)[ADMIN_COOKIE];
  if (verifySession(token)) return next();
  const nextUrl = encodeURIComponent(req.originalUrl || '/admin');
  return res.redirect(`/admin/login?next=${nextUrl}`);
}


const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).slice(0, 12);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, cb) => {
    const allowed = new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif','application/pdf']);
    if (allowed.has(file.mimetype)) cb(null, true);
    else cb(new Error('Dozvoljeni su PDF, JPG, PNG, WEBP i HEIC/HEIF fajlovi.'));
  }
});

app.disable('x-powered-by');
app.use(express.json({ limit: '3mb' }));

app.get('/', formAccessRequired, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/access', (req, res) => {
  if (!FORM_ACCESS_PASSWORD) return res.redirect('/');
  if (verifyFormAccess(parseCookies(req)[FORM_COOKIE])) return res.redirect('/');
  const nextUrl = typeof req.query.next === 'string' && req.query.next.startsWith('/') ? req.query.next : '/';
  res.send(`<!doctype html>
<html lang="sr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<title>Pristup porodičnom unosu</title>
<style>
:root{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#172033;background:#f4f7fb}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px}
.card{width:min(440px,100%);background:#fff;border:1px solid #dfe6ef;border-radius:18px;padding:24px;box-shadow:0 12px 36px rgba(15,23,42,.08)}
h1{margin:0 0 10px;font-size:28px}.muted{color:#667085;line-height:1.45}
label{display:block;font-weight:700;margin:18px 0 7px}
input{width:100%;min-height:52px;padding:12px 13px;border:1px solid #cfd8e3;border-radius:11px;font-size:16px}
button{width:100%;min-height:50px;margin-top:16px;border:0;border-radius:11px;background:#2563eb;color:#fff;font-size:16px;font-weight:800;cursor:pointer}
.error{background:#fff1f0;color:#b42318;border:1px solid #f5c2bd;border-radius:10px;padding:10px 12px;margin-top:12px}
</style>
</head>
<body><div class="card">
<h1>Porodično stablo</h1>
<p class="muted">Ovaj obrazac je namijenjen porodici i rodbini. Unesite zajedničku pristupnu šifru.</p>
<form method="post" action="/access">
<input type="hidden" name="next" value="${esc(nextUrl)}">
<label>Pristupna šifra</label>
<input name="password" type="password" autocomplete="current-password" required autofocus>
<button type="submit">Otvori obrazac</button>
</form>
</div></body></html>`);
});

app.post('/access', express.urlencoded({extended:false}), (req, res) => {
  if (!FORM_ACCESS_PASSWORD) return res.redirect('/');
  const password = String(req.body.password || '');
  const nextUrl = typeof req.body.next === 'string' && req.body.next.startsWith('/') ? req.body.next : '/';

  const ok = password.length === FORM_ACCESS_PASSWORD.length &&
    crypto.timingSafeEqual(Buffer.from(password), Buffer.from(FORM_ACCESS_PASSWORD));

  if (!ok) {
    return res.status(401).send(`<!doctype html>
<html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive"><title>Pogrešna šifra</title>
<style>:root{font-family:system-ui;color:#172033;background:#f4f7fb}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:20px}.card{width:min(440px,100%);background:#fff;border:1px solid #dfe6ef;border-radius:18px;padding:24px}a{display:inline-block;margin-top:14px;color:#2563eb;font-weight:700}</style>
</head><body><div class="card"><h1>Pogrešna šifra</h1><p>Pristupna šifra nije ispravna.</p><a href="/access?next=${encodeURIComponent(nextUrl)}">Pokušaj ponovo</a></div></body></html>`);
  }

  const token = signFormAccess();
  const secure = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim() === 'https';
  const parts = [
    `${FORM_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${FORM_ACCESS_DAYS * 24 * 60 * 60}`
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
  res.redirect(nextUrl);
});

app.post('/access/logout', express.urlencoded({extended:false}), (req, res) => {
  const secure = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim() === 'https';
  const parts = [
    `${FORM_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
  res.redirect('/access');
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.get('/health', (_req, res) => res.json({ ok: true }));


const submitBuckets = new Map();
function submitRateLimit(req, res, next) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const bucket = (submitBuckets.get(ip) || []).filter(ts => now - ts < windowMs);

  if (bucket.length >= SUBMIT_RATE_LIMIT) {
    res.setHeader('Retry-After', '3600');
    return res.status(429).json({
      error: `Previše poslanih obrazaca. Pokušajte ponovo kasnije.`
    });
  }
  bucket.push(now);
  submitBuckets.set(ip, bucket);

  // Povremeno očisti stare IP zapise.
  if (submitBuckets.size > 5000) {
    for (const [key, list] of submitBuckets) {
      const fresh = list.filter(ts => now - ts < windowMs);
      if (fresh.length) submitBuckets.set(key, fresh);
      else submitBuckets.delete(key);
    }
  }
  next();
}

app.post('/api/submissions', formAccessRequired, submitRateLimit, upload.array('files', 10), (req, res) => {
  let payload;
  try { payload = JSON.parse(req.body.payload || '{}'); }
  catch { cleanupFiles(req.files); return res.status(400).json({ error: 'Neispravan sadržaj obrasca.' }); }

  const type = payload.type === 'pojedinac' ? 'pojedinac' : 'porodica';
  const title = String(payload.title || (type === 'pojedinac' ? [payload.firstName,payload.lastName].filter(Boolean).join(' ') : '') || 'Bez naslova').trim().slice(0, 240);
  const submittedBy = String(payload.submittedBy || '').trim().slice(0, 180);
  const publicId = crypto.randomUUID();
  const now = new Date().toISOString();

  const tx = db.transaction(() => {
    const result = db.prepare(`INSERT INTO submissions (public_id,type,title,submitted_by,payload_json,status,created_at) VALUES (?,?,?,?,?,'novo',?)`)
      .run(publicId, type, title, submittedBy, JSON.stringify(payload), now);
    const submissionId = Number(result.lastInsertRowid);
    const ins = db.prepare(`INSERT INTO attachments (submission_id,original_name,stored_name,mime_type,size,created_at) VALUES (?,?,?,?,?,?)`);
    for (const f of req.files || []) ins.run(submissionId, f.originalname, f.filename, f.mimetype, f.size, now);
    return submissionId;
  });

  try {
    const id = tx();
    res.json({ ok: true, id, publicId, title, createdAt: now, files: (req.files || []).map(f => f.originalname) });
  } catch (e) {
    cleanupFiles(req.files);
    console.error(e);
    res.status(500).json({ error: 'Podaci nisu sačuvani. Pokušajte ponovo.' });
  }
});


app.get('/receipt/:publicId', formAccessRequired, (req, res) => {
  const row = db.prepare(`SELECT public_id,type,title,submitted_by,payload_json,created_at FROM submissions WHERE public_id=?`).get(req.params.publicId);
  if (!row) return res.status(404).send('Odgovor nije pronađen.');
  const payload = JSON.parse(row.payload_json);
  const files = db.prepare(`SELECT original_name,size FROM attachments WHERE submission_id=(SELECT id FROM submissions WHERE public_id=?) ORDER BY id`).all(req.params.publicId);
  const fileHtml = files.length ? `<h2>Priloženi fajlovi</h2><ul>${files.map(f=>`<li>${esc(f.original_name)} <span class="muted">(${Math.ceil(f.size/1024)} KB)</span></li>`).join('')}</ul>` : '';
  res.send(publicShell(`Poslani podaci – ${row.title}`, `
    <div class="card"><h1>Podaci su poslani</h1><p class="muted">Ovo je trajni pregled onoga što ste poslali. Sačuvajte link ili ovu stranicu kao PDF.</p>
    <p><b>${esc(row.title)}</b><br><span class="muted">${esc(new Date(row.created_at).toLocaleString('sr-Latn'))}</span></p>
    <div class="receipt-actions no-print">
      <button class="btn" type="button" onclick="copyReceiptLink(this)">Kopiraj link</button>
      <button class="btn secondary" type="button" onclick="window.print()">Sačuvaj / štampaj kao PDF</button>
    </div></div>
    ${renderPayload(payload)}${fileHtml}
    <script>
      async function copyReceiptLink(btn){
        const url=location.href.split('?')[0];
        try{ await navigator.clipboard.writeText(url); btn.textContent='Link kopiran'; setTimeout(()=>btn.textContent='Kopiraj link',1800); }
        catch{ window.prompt('Kopirajte ovaj link:',url); }
      }
      if(new URLSearchParams(location.search).get('print')==='1') setTimeout(()=>window.print(),350);
    <\/script>
  `));
});
app.get('/api/receipt/:publicId', (req, res) => {
  const row = db.prepare(`SELECT public_id,type,title,submitted_by,payload_json,created_at FROM submissions WHERE public_id=?`).get(req.params.publicId);
  if (!row) return res.status(404).json({ error: 'Odgovor nije pronađen.' });
  const files = db.prepare(`SELECT original_name,mime_type,size FROM attachments WHERE submission_id=(SELECT id FROM submissions WHERE public_id=?) ORDER BY id`).all(req.params.publicId);
  res.json({ ...row, payload: JSON.parse(row.payload_json), payload_json: undefined, files });
});


app.get('/admin/login', (req, res) => {
  if (verifySession(parseCookies(req)[ADMIN_COOKIE])) return res.redirect('/admin');
  const nextUrl = typeof req.query.next === 'string' && req.query.next.startsWith('/admin') ? req.query.next : '/admin';
  res.send(adminShell('Admin prijava', `
    <div class="login-wrap">
      <div class="login-card">
        <h1>Admin prijava</h1>
        <p class="muted">Prijavi se za pregled i obradu primljenih podataka.</p>
        <form method="post" action="/admin/login">
          <input type="hidden" name="next" value="${esc(nextUrl)}">
          <label>Korisničko ime</label>
          <input name="username" autocomplete="username" required>
          <label>Lozinka</label>
          <input name="password" type="password" autocomplete="current-password" required>
          <button class="btn primary" type="submit">Prijavi se</button>
        </form>
      </div>
    </div>
  `));
});

app.post('/admin/login', express.urlencoded({extended:false}), (req, res) => {
  const username = String(req.body.username || '');
  const password = String(req.body.password || '');
  const nextUrl = typeof req.body.next === 'string' && req.body.next.startsWith('/admin') ? req.body.next : '/admin';

  const userOk = username.length === ADMIN_USER.length &&
    crypto.timingSafeEqual(Buffer.from(username), Buffer.from(ADMIN_USER));
  const passOk = password.length === ADMIN_PASSWORD.length &&
    crypto.timingSafeEqual(Buffer.from(password), Buffer.from(ADMIN_PASSWORD));

  if (!userOk || !passOk) {
    return res.status(401).send(adminShell('Neuspješna prijava', `
      <div class="login-wrap">
        <div class="login-card">
          <h1>Prijava nije uspjela</h1>
          <p class="muted">Korisničko ime ili lozinka nisu ispravni.</p>
          <a class="btn primary" href="/admin/login">Pokušaj ponovo</a>
        </div>
      </div>
    `));
  }

  const token = signSession({
    user: ADMIN_USER,
    exp: Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000
  });
  const secure = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim() === 'https';
  const parts = [
    `${ADMIN_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/admin',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${ADMIN_SESSION_HOURS * 60 * 60}`
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
  res.redirect(nextUrl);
});

app.post('/admin/logout', adminAuth, express.urlencoded({extended:false}), (req, res) => {
  const secure = String(req.headers['x-forwarded-proto'] || req.protocol).split(',')[0].trim() === 'https';
  const parts = [
    `${ADMIN_COOKIE}=`,
    'Path=/admin',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
  res.redirect('/admin/login');
});

app.get('/admin', adminAuth, (req, res) => {
  const view = ['active','archived','all'].includes(req.query.view) ? req.query.view : 'active';
  const where = view === 'archived' ? "WHERE s.status='arhivirano'" : view === 'all' ? '' : "WHERE s.status<>'arhivirano'";
  const rows = db.prepare(`
    SELECT s.id,s.type,s.title,s.submitted_by,s.status,s.created_at,
           (SELECT COUNT(*) FROM attachments a WHERE a.submission_id=s.id) AS file_count
    FROM submissions s ${where} ORDER BY s.id DESC LIMIT 500
  `).all();
  const counts = db.prepare(`SELECT
    SUM(CASE WHEN status<>'arhivirano' THEN 1 ELSE 0 END) AS active_count,
    SUM(CASE WHEN status='arhivirano' THEN 1 ELSE 0 END) AS archived_count,
    COUNT(*) AS total_count
    FROM submissions`).get();
  const trs = rows.map(r => `<tr>
    <td><input class="row-select" type="checkbox" name="ids" value="${r.id}" aria-label="Označi odgovor #${r.id}"></td>
    <td><a href="/admin/submissions/${r.id}">#${r.id}</a></td>
    <td><a href="/admin/submissions/${r.id}">${esc(r.title)}</a></td><td>${esc(r.type === 'porodica' ? 'Porodica' : 'Pojedinac')}</td>
    <td>${esc(r.submitted_by || '—')}</td><td>${esc(new Date(r.created_at).toLocaleString('sr-Latn'))}</td>
    <td>${r.file_count}</td><td><span class="status ${esc(r.status)}">${esc(r.status)}</span></td>
  </tr>`).join('');
  res.send(adminShell('Primljeni odgovori', `
    <div class="toolbar">
      <h1>Primljeni odgovori</h1>
      <div class="admin-actions">
        <a class="btn" href="/admin/export.csv">Izvezi CSV pregled</a>
        <form method="post" action="/admin/logout" style="margin:0">
          <button class="btn soft" type="submit">Odjavi se</button>
        </form>
      </div>
    </div>
    <div class="admin-tabs">
      <a class="tab ${view==='active'?'active':''}" href="/admin?view=active">Aktivni (${counts.active_count || 0})</a>
      <a class="tab ${view==='archived'?'active':''}" href="/admin?view=archived">Arhiva (${counts.archived_count || 0})</a>
      <a class="tab ${view==='all'?'active':''}" href="/admin?view=all">Svi (${counts.total_count || 0})</a>
    </div>
    <p class="muted">Klikni na odgovor da ga otvoriš. Za masovno brisanje označi više odgovora ili koristi „Označi sve“.</p>

    <form method="post" action="/admin/submissions/bulk-delete" id="bulkForm"
      onsubmit="return confirmBulkDelete();">
      <input type="hidden" name="view" value="${esc(view)}">
      <div class="admin-actions" style="margin:12px 0 14px 0;align-items:center">
        <label style="display:flex;align-items:center;gap:8px;font-weight:700;cursor:pointer">
          <input type="checkbox" id="selectAll"> Označi sve
        </label>
        <span class="muted" id="selectedCount">0 označeno</span>
        <button class="btn danger" type="submit" id="bulkDeleteBtn" disabled>Obriši označene</button>
      </div>
      <div class="tablewrap"><table><thead><tr><th style="width:42px">✓</th><th>ID</th><th>Naslov</th><th>Tip</th><th>Poslao</th><th>Vrijeme</th><th>Fajlovi</th><th>Status</th></tr></thead><tbody>${trs || '<tr><td colspan="8">Nema odgovora u ovom prikazu.</td></tr>'}</tbody></table></div>
    </form>

    <script>
      const selectAll = document.getElementById('selectAll');
      const rowSelects = [...document.querySelectorAll('.row-select')];
      const selectedCount = document.getElementById('selectedCount');
      const bulkDeleteBtn = document.getElementById('bulkDeleteBtn');

      function updateBulkState(){
        const n = rowSelects.filter(x => x.checked).length;
        selectedCount.textContent = n + (n === 1 ? ' označen' : ' označeno');
        bulkDeleteBtn.disabled = n === 0;
        if(rowSelects.length){
          selectAll.checked = n === rowSelects.length;
          selectAll.indeterminate = n > 0 && n < rowSelects.length;
        }
      }
      if(selectAll){
        selectAll.addEventListener('change', () => {
          rowSelects.forEach(x => x.checked = selectAll.checked);
          updateBulkState();
        });
      }
      rowSelects.forEach(x => x.addEventListener('change', updateBulkState));
      updateBulkState();

      function confirmBulkDelete(){
        const n = rowSelects.filter(x => x.checked).length;
        if(!n) return false;
        return confirm('Trajno obrisati ' + n + ' označen' + (n === 1 ? ' odgovor' : 'a odgovora') +
          ' i sve njihove priložene fajlove? Ova radnja se ne može poništiti.');
      }
    </script>
  `));
});


app.get('/admin/submissions/:id/download.txt', adminAuth, (req, res) => {
  const row = db.prepare(`SELECT * FROM submissions WHERE id=?`).get(req.params.id);
  if (!row) return res.status(404).send('Odgovor nije pronađen.');

  let payload = {};
  try {
    payload = JSON.parse(row.payload_json || '{}');
  } catch {
    return res.status(500).send('Sačuvani podaci se ne mogu pročitati.');
  }

  const files = db.prepare(`SELECT * FROM attachments WHERE submission_id=? ORDER BY id`).all(row.id);
  const body = renderPayloadTxt(payload, files);
  const safeTitle = String(row.title || `unos-${row.id}`)
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60) || `unos-${row.id}`;

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}-${row.id}.txt"`);
  res.send('\uFEFF' + body);
});

app.get('/admin/submissions/:id', adminAuth, (req, res) => {
  const row = db.prepare(`SELECT * FROM submissions WHERE id=?`).get(req.params.id);
  if (!row) return res.status(404).send('Odgovor nije pronađen.');
  const payload = JSON.parse(row.payload_json);
  const files = db.prepare(`SELECT * FROM attachments WHERE submission_id=? ORDER BY id`).all(row.id);
  const archived = row.status === 'arhivirano';
  res.send(adminShell(`#${row.id} – ${esc(row.title)}`, `
    <div class="toolbar"><div><a href="/admin${archived?'?view=archived':''}">← ${archived?'Arhiva':'Aktivni odgovori'}</a><h1>${esc(row.title)}</h1></div>
      <div class="admin-actions">
        ${!archived ? `<form method="post" action="/admin/submissions/${row.id}/status"><button class="btn" name="status" value="${row.status === 'obradjeno' ? 'novo' : 'obradjeno'}">${row.status === 'obradjeno' ? 'Vrati na novo' : 'Označi kao obrađeno'}</button></form>` : ''}
        <a class="btn" href="/admin/submissions/${row.id}/download.txt">Preuzmi TXT</a>
        <form method="post" action="/admin/submissions/${row.id}/archive"><button class="btn secondary" type="submit">${archived ? 'Vrati iz arhive' : 'Arhiviraj'}</button></form>
        <form method="post" action="/admin/submissions/${row.id}/delete" onsubmit="return confirm('Trajno obrisati ovaj odgovor i sve njegove priložene fajlove? Ova radnja se ne može poništiti.');"><button class="btn danger" type="submit">Obriši trajno</button></form>
      </div>
    </div>
    <p class="muted">ID #${row.id} · ${esc(new Date(row.created_at).toLocaleString('sr-Latn'))} · status: <b>${esc(row.status)}</b></p>
    ${renderPayload(payload)}
    ${files.length ? `<h2>Priloženi dokumenti i fotografije</h2><ul>${files.map(f=>`<li><a href="/admin/files/${f.id}">${esc(f.original_name)}</a> <span class="muted">(${Math.ceil(f.size/1024)} KB)</span></li>`).join('')}</ul>` : ''}
  `));
});

app.post('/admin/submissions/:id/status', adminAuth, express.urlencoded({extended:false}), (req, res) => {
  const current = db.prepare(`SELECT status FROM submissions WHERE id=?`).get(req.params.id);
  if (!current) return res.status(404).send('Odgovor nije pronađen.');
  if (current.status === 'arhivirano') return res.redirect(`/admin/submissions/${req.params.id}`);
  const status = req.body.status === 'obradjeno' ? 'obradjeno' : 'novo';
  db.prepare(`UPDATE submissions SET status=? WHERE id=?`).run(status, req.params.id);
  res.redirect(`/admin/submissions/${req.params.id}`);
});

app.post('/admin/submissions/:id/archive', adminAuth, express.urlencoded({extended:false}), (req, res) => {
  const row = db.prepare(`SELECT status FROM submissions WHERE id=?`).get(req.params.id);
  if (!row) return res.status(404).send('Odgovor nije pronađen.');
  const status = row.status === 'arhivirano' ? 'novo' : 'arhivirano';
  db.prepare(`UPDATE submissions SET status=? WHERE id=?`).run(status, req.params.id);
  res.redirect(status === 'arhivirano' ? '/admin?view=archived' : `/admin/submissions/${req.params.id}`);
});

app.post('/admin/submissions/bulk-delete', adminAuth, express.urlencoded({extended:false}), (req, res) => {
  const rawIds = Array.isArray(req.body.ids) ? req.body.ids : (req.body.ids ? [req.body.ids] : []);
  const ids = [...new Set(rawIds.map(v => Number(v)).filter(v => Number.isInteger(v) && v > 0))].slice(0, 500);
  const view = ['active','archived','all'].includes(req.body.view) ? req.body.view : 'active';

  if (!ids.length) return res.redirect(`/admin?view=${view}`);

  const placeholders = ids.map(() => '?').join(',');
  const files = db.prepare(`SELECT stored_name FROM attachments WHERE submission_id IN (${placeholders})`).all(...ids);

  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM attachments WHERE submission_id IN (${placeholders})`).run(...ids);
    db.prepare(`DELETE FROM submissions WHERE id IN (${placeholders})`).run(...ids);
  });
  tx();

  for (const f of files) {
    const full = path.join(UPLOAD_DIR, f.stored_name);
    try {
      if (fs.existsSync(full)) fs.unlinkSync(full);
    } catch (e) {
      console.error('Ne mogu obrisati fajl', full, e);
    }
  }

  res.redirect(`/admin?view=${view}`);
});

app.post('/admin/submissions/:id/delete', adminAuth, express.urlencoded({extended:false}), (req, res) => {
  const row = db.prepare(`SELECT id FROM submissions WHERE id=?`).get(req.params.id);
  if (!row) return res.status(404).send('Odgovor nije pronađen.');
  const files = db.prepare(`SELECT stored_name FROM attachments WHERE submission_id=?`).all(row.id);
  const tx = db.transaction(() => {
    db.prepare(`DELETE FROM attachments WHERE submission_id=?`).run(row.id);
    db.prepare(`DELETE FROM submissions WHERE id=?`).run(row.id);
  });
  tx();
  for (const f of files) {
    const full = path.join(UPLOAD_DIR, f.stored_name);
    try { if (fs.existsSync(full)) fs.unlinkSync(full); } catch (e) { console.error('Ne mogu obrisati fajl', full, e); }
  }
  res.redirect('/admin');
});

app.get('/admin/files/:id', adminAuth, (req, res) => {
  const f = db.prepare(`SELECT * FROM attachments WHERE id=?`).get(req.params.id);
  if (!f) return res.status(404).send('Fajl nije pronađen.');
  const full = path.join(UPLOAD_DIR, f.stored_name);
  if (!fs.existsSync(full)) return res.status(404).send('Fajl nedostaje na disku.');
  res.download(full, f.original_name);
});

app.get('/admin/export.csv', adminAuth, (_req, res) => {
  const rows = db.prepare(`SELECT id,title,type,submitted_by,status,created_at FROM submissions ORDER BY id DESC`).all();
  const q = v => `"${String(v ?? '').replace(/"/g,'""')}"`;
  const csv = ['ID,Naslov,Tip,Poslao,Status,Vrijeme', ...rows.map(r => [r.id,r.title,r.type,r.submitted_by,r.status,r.created_at].map(q).join(','))].join('\n');
  res.type('text/csv; charset=utf-8').set('Content-Disposition','attachment; filename="porodicni-unosi.csv"').send('\uFEFF' + csv);
});

app.use((err, req, res, _next) => {
  console.error(err);
  cleanupFiles(req.files);
  if (err instanceof multer.MulterError) return res.status(400).json({ error: `Upload nije uspio: ${err.message}` });
  res.status(400).json({ error: err.message || 'Greška pri obradi zahtjeva.' });
});

app.listen(PORT, '0.0.0.0', () => console.log(`Porodicni unos radi na portu ${PORT}`));

function cleanupFiles(files=[]) {
  for (const f of files || []) { try { if (f.path && fs.existsSync(f.path)) fs.unlinkSync(f.path); } catch {} }
}
function row(label, value) {
  return `<div class="r"><b>${esc(label)}</b><span>${value ? esc(value) : '<i>nije navedeno</i>'}</span></div>`;
}
function person(title,p={}, maiden=false) {
  let h=`<section><h3>${esc(title)}</h3>${row('Ime',p.firstName)}${row('Prezime',p.lastName)}`;
  if (maiden) h += row('Djevojačko prezime',p.maidenName);
  h += row('Nadimak',p.nickname)+row('Datum rođenja',p.birthDate)+row('Mjesto rođenja',p.birthPlace)+row('Datum smrti',p.deathDate)+row('Mjesto smrti',p.deathPlace)+'</section>';
  return h;
}

function txtValue(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}
function txtLine(lines, label, value) {
  const v = txtValue(value);
  if (v) lines.push(`${label}: ${v}`);
}
function txtPerson(lines, title, p={}, maiden=false) {
  lines.push(title);
  lines.push('-'.repeat(title.length));
  txtLine(lines, 'Ime', p.firstName);
  txtLine(lines, 'Prezime', p.lastName);
  if (maiden || p.maidenName) txtLine(lines, 'Djevojačko prezime', p.maidenName);
  txtLine(lines, 'Nadimak', p.nickname);
  txtLine(lines, 'Datum rođenja', p.birthDate);
  txtLine(lines, 'Mjesto rođenja', p.birthPlace);
  txtLine(lines, 'Datum smrti', p.deathDate);
  txtLine(lines, 'Mjesto smrti', p.deathPlace);
  lines.push('');
}
function renderPayloadTxt(d={}, files=[]) {
  const lines = [];

  if (d.type === 'pojedinac') {
    lines.push('UNOS / DOPUNA POJEDINCA');
    lines.push('=======================');
    txtLine(lines, 'Podatke šalje', d.submittedBy);
    lines.push('');
    txtLine(lines, 'Ime', d.firstName);
    txtLine(lines, 'Prezime', d.lastName);
    txtLine(lines, 'Djevojačko prezime', d.maidenName);
    txtLine(lines, 'Nadimak', d.nickname);
    txtLine(lines, 'Datum rođenja', d.birthDate);
    txtLine(lines, 'Mjesto rođenja', d.birthPlace);
    txtLine(lines, 'Datum smrti', d.deathDate);
    txtLine(lines, 'Mjesto smrti', d.deathPlace);
    txtLine(lines, 'Otac', d.father);
    txtLine(lines, 'Majka', d.mother);
    lines.push('');
    txtLine(lines, 'Šta se dodaje ili ispravlja', d.correction);
    txtLine(lines, 'Odakle je poznat podatak', d.source);
  } else {
    lines.push(`PORODICA: ${txtValue(d.title) || 'Bez naslova'}`);
    lines.push('='.repeat(Math.max(10, (`PORODICA: ${txtValue(d.title) || 'Bez naslova'}`).length)));
    txtLine(lines, 'Podatke šalje', d.submittedBy);
    lines.push('');

    const primaryLabel = txtValue(d.primaryRelationship);
    lines.push(`OSNOVNA PORODICA${primaryLabel ? ' · ' + primaryLabel : ''}`);
    lines.push('----------------');
    lines.push('');

    txtPerson(lines, 'OTAC', d.father || {});
    txtPerson(lines, 'MAJKA', d.mother || {}, true);

    const kids = Array.isArray(d.children) ? d.children : [];
    lines.push(`SPISAK DJECE OSNOVNE PORODICE (${kids.length})`);
    lines.push('--------------------------------');
    if (kids.length) {
      kids.forEach((c, i) => {
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || `Dijete ${i+1}`;
        lines.push(`${i+1}. ${name}`);
      });
    } else {
      lines.push('Nema unesene djece.');
    }
    lines.push('');

    if (kids.length) {
      lines.push('PORODICE DJECE OSNOVNE PORODICE');
      lines.push('===============================');
      lines.push('');

      kids.forEach((c, i) => {
        const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || `Dijete ${i+1}`;
        lines.push(`${i+1}. ${name}`);
        lines.push('~'.repeat(Math.max(8, `${i+1}. ${name}`.length)));
        txtLine(lines, 'Ime', c.firstName);
        txtLine(lines, 'Prezime', c.lastName);
        txtLine(lines, 'Nadimak', c.nickname);
        txtLine(lines, 'Datum rođenja', c.birthDate);
        txtLine(lines, 'Mjesto rođenja', c.birthPlace);
        txtLine(lines, 'Datum smrti', c.deathDate);
        txtLine(lines, 'Mjesto smrti', c.deathPlace);
        lines.push('');

        const s = c.spouse || {};
        const hasSpouse = Object.values(s).some(v => txtValue(v));
        if (hasSpouse) {
          lines.push('SUPRUŽNIK / PARTNER');
          lines.push('-------------------');
          txtLine(lines, 'Ime', s.firstName);
          txtLine(lines, 'Prezime', s.lastName);
          txtLine(lines, 'Djevojačko prezime', s.maidenName);
          txtLine(lines, 'Nadimak', s.nickname);
          txtLine(lines, 'Datum rođenja', s.birthDate);
          txtLine(lines, 'Mjesto rođenja', s.birthPlace);
          txtLine(lines, 'Datum smrti', s.deathDate);
          txtLine(lines, 'Mjesto smrti', s.deathPlace);
          txtLine(lines, 'Vrsta veze', s.relationship);
          lines.push('');
        }

        const gc = Array.isArray(c.children) ? c.children : [];
        lines.push(`DJECA OVOG PARA (${gc.length})`);
        lines.push('----------------');
        if (gc.length) {
          gc.forEach((g, j) => {
            let line = `${j+1}. ${txtValue(g.name) || `Dijete ${j+1}`}`;
            if (txtValue(g.birthDate)) line += ` — ${txtValue(g.birthDate)}`;
            if (txtValue(g.birthPlace)) line += ` (${txtValue(g.birthPlace)})`;
            lines.push(line);
          });
        } else {
          lines.push('Nema unesene djece.');
        }
        lines.push('');
        txtLine(lines, 'Napomena za ovu porodicu', c.notes);
        if (txtValue(c.notes)) lines.push('');
      });
    }

    lines.push('IZVOR I NAPOMENE');
    lines.push('----------------');
    txtLine(lines, 'Odakle su poznati podaci', d.source);
    txtLine(lines, 'Napomena', d.notes);
  }

  if (Array.isArray(files) && files.length) {
    lines.push('');
    lines.push('PRILOŽENI DOKUMENTI I FOTOGRAFIJE');
    lines.push('---------------------------------');
    files.forEach((f, i) => {
      const kb = f.size ? ` (${Math.ceil(f.size/1024)} KB)` : '';
      lines.push(`${i+1}. ${txtValue(f.original_name) || 'Fajl'}${kb}`);
    });
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function renderPayload(d={}) {
  if (d.type === 'pojedinac') return `<div class="report"><h2>Unos / dopuna pojedinca</h2>${row('Ime',d.firstName)}${row('Prezime',d.lastName)}${row('Djevojačko prezime',d.maidenName)}${row('Nadimak',d.nickname)}${row('Datum rođenja',d.birthDate)}${row('Mjesto rođenja',d.birthPlace)}${row('Datum smrti',d.deathDate)}${row('Mjesto smrti',d.deathPlace)}${row('Otac',d.father)}${row('Majka',d.mother)}${row('Šta se dodaje ili ispravlja',d.correction)}${row('Odakle je poznat podatak',d.source)}${row('Podatke šalje',d.submittedBy)}</div>`;
  const kids = Array.isArray(d.children) ? d.children : [];
  const primaryLabel = d.primaryRelationship ? ` · ${esc(d.primaryRelationship)}` : '';
  let h=`<div class="report"><h2>Porodica: ${esc(d.title || 'Bez naslova')}</h2>${row('Podatke šalje',d.submittedBy)}<h2>Osnovna porodica${primaryLabel}</h2>${person('Otac',d.father)}${person('Majka',d.mother,true)}`;
  h += `<h2>Spisak djece osnovne porodice (${kids.length})</h2><ol>${kids.map((c,i)=>`<li>${esc([c.firstName,c.lastName].filter(Boolean).join(' ') || `Dijete ${i+1}`)}</li>`).join('')}</ol>`;
  if (kids.length) h += '<h2>Porodice djece osnovne porodice</h2>';
  kids.forEach((c,i)=>{
    const name=[c.firstName,c.lastName].filter(Boolean).join(' ') || `Dijete ${i+1}`;
    const s=c.spouse||{}; const gc=Array.isArray(c.children)?c.children:[];
    h += `<section><h3>${i+1}. ${esc(name)}</h3><h4>Podaci o osobi</h4>${row('Ime',c.firstName)}${row('Prezime',c.lastName)}${row('Nadimak',c.nickname)}${row('Datum rođenja',c.birthDate)}${row('Mjesto rođenja',c.birthPlace)}${row('Datum smrti',c.deathDate)}${row('Mjesto smrti',c.deathPlace)}<h4>Supružnik / partner</h4>${row('Ime',s.firstName)}${row('Prezime',s.lastName)}${row('Djevojačko prezime',s.maidenName)}${row('Nadimak',s.nickname)}${row('Datum rođenja',s.birthDate)}${row('Mjesto rođenja',s.birthPlace)}${row('Datum smrti',s.deathDate)}${row('Mjesto smrti',s.deathPlace)}${row('Vrsta veze',s.relationship)}<h4>Djeca ovog para (${gc.length})</h4><ol>${gc.map((g,j)=>`<li>${esc(g.name || `Dijete ${j+1}`)}${g.birthDate?` — ${esc(g.birthDate)}`:''}${g.birthPlace?` (${esc(g.birthPlace)})`:''}</li>`).join('')}</ol>${row('Napomena za ovu porodicu',c.notes)}</section>`;
  });
  h += `<h2>Izvor i napomene</h2>${row('Odakle su poznati podaci',d.source)}${row('Napomena',d.notes)}</div>`;
  return h;
}
function publicShell(title, body) {
  return `<!doctype html><html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
  body{font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;background:#f5f7fb;color:#1f2937;margin:0}.wrap{max-width:900px;margin:auto;padding:16px}.card,.report section{background:#fff;border:1px solid #dfe5ee;border-radius:14px;padding:15px;margin:12px 0}.muted{color:#667085}.report h2{margin-top:24px}.report h3{margin-top:0}.r{display:grid;grid-template-columns:220px 1fr;gap:10px;padding:6px 0;border-bottom:1px solid #eef1f5}.r:last-child{border-bottom:0}.r i{color:#98a2b3}.receipt-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.btn{border:0;background:#245ec7;color:#fff;padding:10px 13px;border-radius:9px;font-weight:700;cursor:pointer}.btn.secondary{background:#eef2f6;color:#1f2937}@media(max-width:700px){.r{grid-template-columns:1fr;gap:2px}.wrap{padding:10px}}@media print{body{background:#fff}.wrap{max-width:none;padding:0}.no-print{display:none!important}.card,.report section{box-shadow:none;break-inside:avoid;border-color:#bbb}.report section{page-break-inside:avoid}}
  
.login-wrap{min-height:70vh;display:grid;place-items:center;padding:28px 16px}
.login-card{width:min(440px,100%);background:#fff;border:1px solid #dde5ee;border-radius:18px;padding:24px;box-shadow:0 12px 36px rgba(15,23,42,.08)}
.login-card h1{margin-top:0}
.login-card label{display:block;font-weight:700;margin:14px 0 6px}
.login-card input{width:100%;box-sizing:border-box;padding:12px 13px;border:1px solid #cfd8e3;border-radius:10px;font-size:16px}
.login-card .btn{margin-top:18px;width:100%}

</style></head><body><div class="wrap">${body}</div></body></html>`;
}
function adminShell(title, body) {
  return `<!doctype html><html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
  body{font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;background:#f5f7fb;color:#1f2937;margin:0}.wrap{max-width:1100px;margin:auto;padding:20px}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}a{color:#245ec7}.btn{display:inline-block;border:0;background:#245ec7;color:#fff;text-decoration:none;padding:10px 13px;border-radius:9px;font-weight:700;cursor:pointer}.btn.secondary{background:#eef2f6;color:#1f2937}.btn.danger{background:#b42318}.admin-actions{display:flex;gap:8px;flex-wrap:wrap}.admin-actions form{margin:0}.admin-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 16px}.tab{display:inline-block;padding:8px 11px;border-radius:999px;background:#eef2f6;text-decoration:none;color:#344054;font-weight:700}.tab.active{background:#245ec7;color:#fff}.muted{color:#667085}.tablewrap{overflow:auto;background:#fff;border:1px solid #dfe5ee;border-radius:14px}table{width:100%;border-collapse:collapse;min-width:820px}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #eef1f5}th{background:#f8fafc}.status{padding:4px 8px;border-radius:999px;background:#eef2f6}.status.obradjeno{background:#dcfae6;color:#067647}.status.arhivirano{background:#f2f4f7;color:#475467}.report section{background:#fff;border:1px solid #dfe5ee;border-radius:13px;padding:14px;margin:12px 0}.report h2{margin-top:24px}.report h3{margin-top:0}.r{display:grid;grid-template-columns:220px 1fr;gap:10px;padding:6px 0;border-bottom:1px solid #eef1f5}.r:last-child{border-bottom:0}.r i{color:#98a2b3}@media(max-width:700px){.r{grid-template-columns:1fr;gap:2px}.wrap{padding:12px}}
  </style></head><body><div class="wrap">${body}</div></body></html>`;
}
