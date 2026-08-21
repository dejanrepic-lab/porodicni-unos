const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const Database = require('better-sqlite3');

const app = express();
const PORT = Number(process.env.PORT || 8787);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'porodicni-unos.db');
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'promijeni-me';
const MAX_UPLOAD_MB = Math.max(1, Number(process.env.MAX_UPLOAD_MB || 15));

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
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
function basicAuth(req, res, next) {
  const hdr = req.headers.authorization || '';
  if (!hdr.startsWith('Basic ')) return deny();
  let decoded = '';
  try { decoded = Buffer.from(hdr.slice(6), 'base64').toString('utf8'); } catch { return deny(); }
  const idx = decoded.indexOf(':');
  const user = idx >= 0 ? decoded.slice(0, idx) : decoded;
  const pass = idx >= 0 ? decoded.slice(idx + 1) : '';
  const userOk = crypto.timingSafeEqual(Buffer.from(user.padEnd(ADMIN_USER.length)), Buffer.from(ADMIN_USER.padEnd(user.length))) && user === ADMIN_USER;
  const passOk = crypto.timingSafeEqual(Buffer.from(pass.padEnd(ADMIN_PASSWORD.length)), Buffer.from(ADMIN_PASSWORD.padEnd(pass.length))) && pass === ADMIN_PASSWORD;
  if (!userOk || !passOk) return deny();
  next();
  function deny() {
    res.set('WWW-Authenticate', 'Basic realm="Porodicni unos"');
    res.status(401).send('Potrebna je administratorska prijava.');
  }
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
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/submissions', upload.array('files', 10), (req, res) => {
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


app.get('/receipt/:publicId', (req, res) => {
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

app.get('/admin', basicAuth, (_req, res) => {
  const rows = db.prepare(`
    SELECT s.id,s.type,s.title,s.submitted_by,s.status,s.created_at,
           (SELECT COUNT(*) FROM attachments a WHERE a.submission_id=s.id) AS file_count
    FROM submissions s ORDER BY s.id DESC LIMIT 500
  `).all();
  const trs = rows.map(r => `<tr>
    <td><a href="/admin/submissions/${r.id}">#${r.id}</a></td>
    <td>${esc(r.title)}</td><td>${esc(r.type === 'porodica' ? 'Porodica' : 'Pojedinac')}</td>
    <td>${esc(r.submitted_by || '—')}</td><td>${esc(new Date(r.created_at).toLocaleString('sr-Latn'))}</td>
    <td>${r.file_count}</td><td><span class="status ${esc(r.status)}">${esc(r.status)}</span></td>
  </tr>`).join('');
  res.send(adminShell('Primljeni odgovori', `
    <div class="toolbar"><h1>Primljeni odgovori</h1><a class="btn" href="/admin/export.csv">Izvezi CSV pregled</a></div>
    <p class="muted">Klikni na broj odgovora da otvoriš kompletan izvještaj za unos u Gramps.</p>
    <div class="tablewrap"><table><thead><tr><th>ID</th><th>Naslov</th><th>Tip</th><th>Poslao</th><th>Vrijeme</th><th>Fajlovi</th><th>Status</th></tr></thead><tbody>${trs || '<tr><td colspan="7">Još nema odgovora.</td></tr>'}</tbody></table></div>
  `));
});

app.get('/admin/submissions/:id', basicAuth, (req, res) => {
  const row = db.prepare(`SELECT * FROM submissions WHERE id=?`).get(req.params.id);
  if (!row) return res.status(404).send('Odgovor nije pronađen.');
  const payload = JSON.parse(row.payload_json);
  const files = db.prepare(`SELECT * FROM attachments WHERE submission_id=? ORDER BY id`).all(row.id);
  res.send(adminShell(`#${row.id} – ${esc(row.title)}`, `
    <div class="toolbar"><div><a href="/admin">← Svi odgovori</a><h1>${esc(row.title)}</h1></div>
      <form method="post" action="/admin/submissions/${row.id}/status"><button class="btn" name="status" value="${row.status === 'obradjeno' ? 'novo' : 'obradjeno'}">${row.status === 'obradjeno' ? 'Vrati na novo' : 'Označi kao obrađeno'}</button></form>
    </div>
    <p class="muted">ID #${row.id} · ${esc(new Date(row.created_at).toLocaleString('sr-Latn'))} · status: <b>${esc(row.status)}</b></p>
    ${renderPayload(payload)}
    ${files.length ? `<h2>Priloženi dokumenti i fotografije</h2><ul>${files.map(f=>`<li><a href="/admin/files/${f.id}">${esc(f.original_name)}</a> <span class="muted">(${Math.ceil(f.size/1024)} KB)</span></li>`).join('')}</ul>` : ''}
  `));
});

app.post('/admin/submissions/:id/status', basicAuth, express.urlencoded({extended:false}), (req, res) => {
  const status = req.body.status === 'obradjeno' ? 'obradjeno' : 'novo';
  db.prepare(`UPDATE submissions SET status=? WHERE id=?`).run(status, req.params.id);
  res.redirect(`/admin/submissions/${req.params.id}`);
});

app.get('/admin/files/:id', basicAuth, (req, res) => {
  const f = db.prepare(`SELECT * FROM attachments WHERE id=?`).get(req.params.id);
  if (!f) return res.status(404).send('Fajl nije pronađen.');
  const full = path.join(UPLOAD_DIR, f.stored_name);
  if (!fs.existsSync(full)) return res.status(404).send('Fajl nedostaje na disku.');
  res.download(full, f.original_name);
});

app.get('/admin/export.csv', basicAuth, (_req, res) => {
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
function renderPayload(d={}) {
  if (d.type === 'pojedinac') return `<div class="report"><h2>Unos / dopuna pojedinca</h2>${row('Ime',d.firstName)}${row('Prezime',d.lastName)}${row('Djevojačko prezime',d.maidenName)}${row('Nadimak',d.nickname)}${row('Datum rođenja',d.birthDate)}${row('Mjesto rođenja',d.birthPlace)}${row('Datum smrti',d.deathDate)}${row('Mjesto smrti',d.deathPlace)}${row('Otac',d.father)}${row('Majka',d.mother)}${row('Šta se dodaje ili ispravlja',d.correction)}${row('Odakle je poznat podatak',d.source)}${row('Podatke šalje',d.submittedBy)}</div>`;
  const kids = Array.isArray(d.children) ? d.children : [];
  let h=`<div class="report"><h2>Porodica: ${esc(d.title || 'Bez naslova')}</h2>${row('Podatke šalje',d.submittedBy)}${row('Vrsta veze osnovne porodice',d.primaryRelationship)}${person('Otac',d.father)}${person('Majka',d.mother,true)}`;
  h += `<h2>Spisak djece osnovne porodice (${kids.length})</h2><ol>${kids.map((c,i)=>`<li>${esc([c.firstName,c.lastName].filter(Boolean).join(' ') || `Dijete ${i+1}`)}</li>`).join('')}</ol>`;
  if (kids.length) h += '<h2>Porodice djece osnovne porodice</h2>';
  kids.forEach((c,i)=>{
    const name=[c.firstName,c.lastName].filter(Boolean).join(' ') || `Dijete ${i+1}`;
    const s=c.spouse||{}; const gc=Array.isArray(c.children)?c.children:[];
    h += `<section><h3>${i+1}. ${esc(name)}</h3>${row('Nadimak',c.nickname)}${row('Datum rođenja',c.birthDate)}${row('Mjesto rođenja',c.birthPlace)}${row('Datum smrti',c.deathDate)}${row('Mjesto smrti',c.deathPlace)}<h4>Supružnik / partner</h4>${row('Ime',s.firstName)}${row('Prezime',s.lastName)}${row('Djevojačko prezime',s.maidenName)}${row('Nadimak',s.nickname)}${row('Datum rođenja',s.birthDate)}${row('Mjesto rođenja',s.birthPlace)}${row('Datum smrti',s.deathDate)}${row('Mjesto smrti',s.deathPlace)}${row('Vrsta veze',s.relationship)}<h4>Djeca ovog para (${gc.length})</h4><ol>${gc.map((g,j)=>`<li>${esc(g.name || `Dijete ${j+1}`)}${g.birthDate?` — ${esc(g.birthDate)}`:''}${g.birthPlace?` (${esc(g.birthPlace)})`:''}</li>`).join('')}</ol>${row('Napomena za ovu porodicu',c.notes)}</section>`;
  });
  h += `<h2>Izvor i napomene</h2>${row('Odakle su poznati podaci',d.source)}${row('Napomena',d.notes)}</div>`;
  return h;
}
function publicShell(title, body) {
  return `<!doctype html><html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
  body{font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;background:#f5f7fb;color:#1f2937;margin:0}.wrap{max-width:900px;margin:auto;padding:16px}.card,.report section{background:#fff;border:1px solid #dfe5ee;border-radius:14px;padding:15px;margin:12px 0}.muted{color:#667085}.report h2{margin-top:24px}.report h3{margin-top:0}.r{display:grid;grid-template-columns:220px 1fr;gap:10px;padding:6px 0;border-bottom:1px solid #eef1f5}.r:last-child{border-bottom:0}.r i{color:#98a2b3}.receipt-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.btn{border:0;background:#245ec7;color:#fff;padding:10px 13px;border-radius:9px;font-weight:700;cursor:pointer}.btn.secondary{background:#eef2f6;color:#1f2937}@media(max-width:700px){.r{grid-template-columns:1fr;gap:2px}.wrap{padding:10px}}@media print{body{background:#fff}.wrap{max-width:none;padding:0}.no-print{display:none!important}.card,.report section{box-shadow:none;break-inside:avoid;border-color:#bbb}.report section{page-break-inside:avoid}}
  </style></head><body><div class="wrap">${body}</div></body></html>`;
}
function adminShell(title, body) {
  return `<!doctype html><html lang="sr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
  body{font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif;background:#f5f7fb;color:#1f2937;margin:0}.wrap{max-width:1100px;margin:auto;padding:20px}.toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}a{color:#245ec7}.btn{display:inline-block;border:0;background:#245ec7;color:#fff;text-decoration:none;padding:10px 13px;border-radius:9px;font-weight:700;cursor:pointer}.muted{color:#667085}.tablewrap{overflow:auto;background:#fff;border:1px solid #dfe5ee;border-radius:14px}table{width:100%;border-collapse:collapse;min-width:820px}th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #eef1f5}th{background:#f8fafc}.status{padding:4px 8px;border-radius:999px;background:#eef2f6}.status.obradjeno{background:#dcfae6;color:#067647}.report section{background:#fff;border:1px solid #dfe5ee;border-radius:13px;padding:14px;margin:12px 0}.report h2{margin-top:24px}.report h3{margin-top:0}.r{display:grid;grid-template-columns:220px 1fr;gap:10px;padding:6px 0;border-bottom:1px solid #eef1f5}.r:last-child{border-bottom:0}.r i{color:#98a2b3}@media(max-width:700px){.r{grid-template-columns:1fr;gap:2px}.wrap{padding:12px}}
  </style></head><body><div class="wrap">${body}</div></body></html>`;
}
