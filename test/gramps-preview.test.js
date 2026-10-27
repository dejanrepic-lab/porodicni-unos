const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

test('admin can select and preview a branch from a mock Gramps server', async t => {
  const mock = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/token/' && req.method === 'POST') return res.end(JSON.stringify({ access_token: 'token' }));
    if (req.headers.authorization !== 'Bearer token') { res.statusCode = 401; return res.end('{}'); }
    const data = {
      '/api/people/': [{handle:'a', primary_name:{first_name:'Ana', surname_list:[{surname:'Test'}]}}, {handle:'b', primary_name:{first_name:'Marko'}}],
      '/api/families/': [{handle:'family1', father_handle:'a', child_ref_list:[{ref:'b'}]}],
      '/api/events/': [], '/api/places/': [],
    };
    if (!(req.url in data)) { res.statusCode = 404; return res.end('{}'); }
    return res.end(JSON.stringify(data[req.url]));
  });
  await new Promise(resolve => mock.listen(0, '127.0.0.1', resolve));
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gramps-preview-'));
  const port = 21000 + (process.pid % 10000);
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], {cwd:path.join(__dirname,'..'), env:{...process.env, PORT:String(port), DATA_DIR:dataDir, ADMIN_PASSWORD:'test-password', ADMIN_SESSION_SECRET:'test-secret', GRAMPS_URL:`http://127.0.0.1:${mock.address().port}`, GRAMPS_USER:'reader', GRAMPS_PASSWORD:'pw'}});
  t.after(() => { child.kill(); mock.close(); fs.rmSync(dataDir, {recursive:true, force:true}); });
  let ready = false;
  for (let i=0; i<50; i++) {
    try { if ((await fetch(`${base}/health`)).ok) {ready=true; break;} } catch {}
    await new Promise(resolve => setTimeout(resolve,100));
  }
  assert.ok(ready);
  const anonymous = await fetch(`${base}/admin/gramps`, {redirect:'manual'});
  assert.equal(anonymous.status,302);
  const login = await fetch(`${base}/admin/login`, {method:'POST', redirect:'manual', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:'username=admin&password=test-password'});
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const list = await fetch(`${base}/admin/gramps`, {headers:{cookie}});
  assert.equal(list.status,200);
  assert.match(await list.text(), /Ana Test/);
  const preview = await fetch(`${base}/admin/gramps/preview`, {method:'POST', headers:{cookie,'Content-Type':'application/x-www-form-urlencoded'}, body:'family=family1'});
  assert.equal(preview.status,200);
  assert.match(await preview.text(), /2 osoba · 1 porodica/);
});
