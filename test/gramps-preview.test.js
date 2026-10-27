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
      '/api/events/': [], '/api/places/': [], '/api/notes/': [],
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
  const adminHeaders = {cookie, 'Content-Type':'application/x-www-form-urlencoded'};
  const csrfFrom = html => html.match(/name="csrf" value="([^"]+)"/)[1];
  const newPage = await (await fetch(`${base}/admin/family-links/new`, {headers:{cookie}})).text();
  const csrf = csrfFrom(newPage);
  const create = await fetch(`${base}/admin/family-links/prepare`, {method:'POST',redirect:'manual',headers:adminHeaders,body:new URLSearchParams({csrf,label:'Za rođaka',family:'family1'})});
  assert.equal(create.status,302);
  const detailUrl = base + create.headers.get('location');
  let detail = await (await fetch(detailUrl,{headers:{cookie}})).text();
  assert.match(detail,/Nacrt/);
  assert.doesNotMatch(detail,/Otvori link za rođaka/);
  const toggle = await fetch(detailUrl+'/toggle',{method:'POST',redirect:'manual',headers:adminHeaders,body:new URLSearchParams({csrf})});
  assert.equal(toggle.status,302);
  detail = await (await fetch(detailUrl,{headers:{cookie}})).text();
  const branchPath=detail.match(/href="(\/branch\/[a-f0-9]+)"/)[1];
  const publicHtml = await (await fetch(base+branchPath)).text();
  assert.match(publicHtml,/Test, Ana/);
  assert.doesNotMatch(publicHtml,/id="person-editor"/);
  const editorHtml=await (await fetch(base+branchPath+'?person=a')).text();
  assert.match(editorHtml,/id="person-editor"/);
  assert.equal((editorHtml.match(/action="[^"]+\/person"/g)||[]).length,1);
  const publicCsrf=csrfFrom(editorHtml);
  const body = new URLSearchParams({csrf:publicCsrf,revision:'0',editor:'Rođak',id:'a',name:'Ana Dopunjeno',birth:'oko 1900',notes:'Test izvor'});
  const saved=await fetch(base+branchPath+'/person',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  assert.equal(saved.status,302);
  const conflict=await fetch(base+branchPath+'/person',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
  assert.equal(conflict.status,409);
  const wrongCsrf=await fetch(base+branchPath+'/person',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:'wrong',revision:'1'})});
  assert.equal(wrongCsrf.status,403);
  const add=await fetch(base+branchPath+'/add',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'1',editor:'Rođak',family:'family1',role:'child',name:'Novo dijete'})});
  assert.equal(add.status,302);
  const selectedChild=await (await fetch(base+branchPath+'?person=b')).text();
  assert.match(selectedChild,/Napravi novu porodicu/);
  const newFamily=await fetch(base+branchPath+'/family',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'2',editor:'Rođak',person:'b',partnerName:'Novi partner',childName:'Prvo dijete'})});
  assert.equal(newFamily.status,302);
  let familyPage=await (await fetch(base+branchPath+'?person=b')).text();
  assert.match(familyPage,/Novi partner/);assert.match(familyPage,/Prvo dijete/);
  const familyId=familyPage.match(/name="family" value="([^"]+)"/)[1];
  const secondChild=await fetch(base+branchPath+'/add',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'3',editor:'Rođak',family:familyId,context:'b',role:'child',name:'Drugo dijete'})});
  assert.equal(secondChild.status,302);
  assert.match(secondChild.headers.get('location'),/person=b#person-families/);
  familyPage=await (await fetch(base+branchPath+'?person=b')).text();
  assert.match(familyPage,/Drugo dijete/);
  const badContext=await fetch(base+branchPath+'/add',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'4',editor:'Rođak',family:familyId,context:'a',role:'child',name:'Pogrešno'})});
  assert.equal(badContext.status,400);
  const staleFamily=await fetch(base+branchPath+'/family',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'3',editor:'Rođak',person:'b'})});
  assert.equal(staleFamily.status,409);
  const singleParent=await fetch(base+branchPath+'/family',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'4',editor:'Rođak',person:'a',childName:'Još jedno dijete'})});
  assert.equal(singleParent.status,302);
  const tree=await (await fetch(base+branchPath)).text();assert.match(tree,/Još jedno dijete/);
  detail=await (await fetch(detailUrl,{headers:{cookie}})).text();
  assert.match(detail,/Ana Dopunjeno/);assert.match(detail,/Novo dijete/);assert.match(detail,/Test izvor/);
  assert.match(detail,/Nove osobe \(5\)/);assert.match(detail,/Nove porodice \(2\)/);assert.match(detail,/Djeca dodana u postojeće porodice \(1\)/);
  assert.match(detail,/Prije: Test, Ana/);assert.match(detail,/Sada: Ana Dopunjeno/);
  let listHtml=await (await fetch(base+'/admin/family-links',{headers:{cookie}})).text();
  assert.match(listHtml,/Obrada:<\/b> U toku/);
  const completed=await fetch(base+branchPath+'/completion',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'5',editor:'Rođak'})});
  assert.equal(completed.status,302);
  detail=await (await fetch(detailUrl,{headers:{cookie}})).text();assert.match(detail,/Završeno — čeka pregled/);assert.match(detail,/Obradu označio\/la završenom: Rođak/);
  const staleReview=await fetch(detailUrl+'/review',{method:'POST',headers:adminHeaders,body:new URLSearchParams({csrf,revision:'4'})});assert.equal(staleReview.status,409);
  const review=await fetch(detailUrl+'/review',{method:'POST',redirect:'manual',headers:adminHeaders,body:new URLSearchParams({csrf,revision:'5'})});assert.equal(review.status,302);
  listHtml=await (await fetch(base+'/admin/family-links',{headers:{cookie}})).text();assert.match(listHtml,/Obrada:<\/b> Pregledano/);
  const afterReview=await fetch(base+branchPath+'/person',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'5',editor:'Rođak',id:'a',name:'Ana Ponovo'})});assert.equal(afterReview.status,302);
  detail=await (await fetch(detailUrl,{headers:{cookie}})).text();assert.match(detail,/Obrada:<\/b> U toku/);
  const staleCompletion=await fetch(base+branchPath+'/completion',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'5',editor:'Rođak'})});assert.equal(staleCompletion.status,409);
  await fetch(detailUrl+'/toggle',{method:'POST',headers:adminHeaders,body:new URLSearchParams({csrf})});
  assert.equal((await fetch(base+branchPath)).status,404);
  assert.equal((await fetch(base+branchPath+'/person',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body})).status,404);

});
