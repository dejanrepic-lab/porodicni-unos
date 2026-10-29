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
      '/api/people/': [{handle:'a', gramps_id:'I001', primary_name:{first_name:'Ana', surname_list:[{surname:'Test'}]}}, {handle:'b', primary_name:{first_name:'Marko'}}],
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
  assert.doesNotMatch(detail,/Otvori link za rođaka/);assert.match(detail,/Link je isključen/);assert.doesNotMatch(detail,/class="share-url"/);
  const toggle = await fetch(detailUrl+'/toggle',{method:'POST',redirect:'manual',headers:adminHeaders,body:new URLSearchParams({csrf})});
  assert.equal(toggle.status,302);
  detail = await (await fetch(detailUrl,{headers:{cookie}})).text();
  const branchPath=detail.match(/href="(\/branch\/[a-f0-9]+)"/)[1];
  assert.match(detail,/Link za slanje rođaku/);assert.match(detail,/Kopiraj link/);assert.match(detail,/class="share-url" readonly/);
  const shareList=await (await fetch(base+'/admin/family-links',{headers:{cookie}})).text();assert.match(shareList,/Link za slanje rođaku/);assert.ok(shareList.includes(branchPath));
  const vm=require('node:vm'),script=detail.match(/<script>([\s\S]*?)<\/script>/)[1];
  const events={},field={value:'',select(){this.selected=true;},focus(){this.focused=true;},addEventListener(name,fn){events[name]=fn;}},button={hidden:true,addEventListener(name,fn){events['button_'+name]=fn;}},feedback={textContent:''};
  const box={dataset:{sharePath:branchPath},querySelector(sel){return {'.share-url':field,'.copy-share':button,'.share-feedback':feedback}[sel];}};
  let copied;const context={URL,window:{location:{origin:'https://porodica.example'}},document:{querySelectorAll(){return [box];}},navigator:{clipboard:{async writeText(text){copied=text;}}}};
  vm.runInNewContext(script,context);assert.equal(field.value,'https://porodica.example'+branchPath);assert.equal(button.hidden,false);
  await events.button_click();assert.equal(copied,field.value);assert.match(feedback.textContent,/kopiran/);
  context.navigator.clipboard.writeText=async()=>{throw Error('denied');};await events.button_click();assert.equal(field.focused,true);assert.equal(field.selected,true);assert.match(feedback.textContent,/ručno/);
  const publicHtml = await (await fetch(base+branchPath)).text();
  assert.match(publicHtml,/id="familyForm"/);
  const mapHtml=await (await fetch(base+branchPath+'?map=1')).text();assert.match(mapHtml,/Ana Test/);assert.match(mapHtml,/Mapa porodične grane/);
  assert.doesNotMatch(publicHtml,/id="person-editor"/);
  const editorHtml=await (await fetch(base+branchPath+'?legacy=1&person=a')).text();
  assert.match(editorHtml,/id="person-editor"/);
  const card=editorHtml.match(/<section id="person-editor" class="person-card">([\s\S]*?)<\/section>/)[1];
  assert.match(card,/class="person-grid"/);assert.match(card,/id="person-families"/);assert.match(card,/action="[^"]+\/person"/);
  let forms=0;for(const tag of card.matchAll(/<\/?form\b[^>]*>/g)){if(tag[0].startsWith('</'))forms--;else forms++;assert.ok(forms>=0&&forms<=1,'forms must not nest');}assert.equal(forms,0);
  assert.ok(editorHtml.indexOf('id="person-editor"')<editorHtml.indexOf('class="family-tree"'));
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
  const selectedChild=await (await fetch(base+branchPath+'?legacy=1&person=b')).text();
  assert.match(selectedChild,/Dodaj partnera \/ novu porodicu/);
  const newFamily=await fetch(base+branchPath+'/family',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'2',editor:'Rođak',person:'b',partnerName:'Novi partner',childName:'Prvo dijete'})});
  assert.equal(newFamily.status,302);
  let familyPage=await (await fetch(base+branchPath+'?legacy=1&person=b')).text();
  assert.match(familyPage,/Novi partner/);assert.match(familyPage,/Prvo dijete/);
  const familyId=familyPage.match(/name="family" value="([^"]+)"/)[1];
  const secondChild=await fetch(base+branchPath+'/add',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'3',editor:'Rođak',family:familyId,context:'b',role:'child',name:'Drugo dijete'})});
  assert.equal(secondChild.status,302);
  assert.match(secondChild.headers.get('location'),/person=b&family=[^#]+#person-families/);
  familyPage=await (await fetch(base+branchPath+'?legacy=1&person=b')).text();
  assert.match(familyPage,/Drugo dijete/);
  const childId=decodeURIComponent(familyPage.match(/person=([^"#]+)#person-editor">Drugo dijete/)[1]);
  const badContext=await fetch(base+branchPath+'/add',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'4',editor:'Rođak',family:familyId,context:'a',role:'child',name:'Pogrešno'})});
  assert.equal(badContext.status,400);
  const staleFamily=await fetch(base+branchPath+'/family',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'3',editor:'Rođak',person:'b'})});
  assert.equal(staleFamily.status,409);
  const singleParent=await fetch(base+branchPath+'/family',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'4',editor:'Rođak',person:'a',childName:'Još jedno dijete'})});
  assert.equal(singleParent.status,302);
  const tree=await (await fetch(base+branchPath+'?map=1')).text();assert.match(tree,/Još jedno dijete/);
  const multiple=await (await fetch(base+branchPath+'?legacy=1&person=a')).text();const familyArea=multiple.split('id="person-families"')[1].split('</section>')[0];assert.doesNotMatch(familyArea,/<details data-family-id="[^"]+" open><summary>/);
  const reopened=await (await fetch(base+branchPath+'?legacy=1&person=a&family=family1')).text();const openedArea=reopened.split('id="person-families"')[1].split('</section>')[0];assert.match(openedArea,/<details data-family-id="[^"]+" open><summary>/);

  detail=await (await fetch(detailUrl,{headers:{cookie}})).text();
  assert.match(detail,/Ana Dopunjeno/);assert.match(detail,/Novo dijete/);assert.match(detail,/Test izvor/);
  assert.match(detail,/Početna porodica:<\/b> Test, Ana \(I001\)/);
  assert.match(detail,/id="change-navigation"/);assert.match(detail,/Izmjene u grani/);assert.match(detail,/Nova osoba/);
  assert.match(detail,/Dodana djeca – pregledaj/);assert.match(detail,/Nova porodica – pregledaj/);
  const familyView=await (await fetch(detailUrl+'?family='+encodeURIComponent(familyId),{headers:{cookie}})).text();
  const familyFocus=familyView.split('id="family-review"')[1].split('</section>')[0];
  assert.match(familyFocus,/Novi partner/);assert.match(familyFocus,/Prvo dijete/);assert.match(familyFocus,/Drugo dijete/);assert.match(familyFocus,/Promjena \d+ od \d+/);assert.match(familyFocus,/Prethodna|Sljedeća/);
  const personView=await (await fetch(detailUrl+'?legacy=1&person=a',{headers:{cookie}})).text();
  const personFocus=personView.split('id="person-editor"')[1].split('</section>')[0];assert.match(personFocus,/Prije: Test, Ana/);assert.match(personFocus,/Sada: Ana Dopunjeno/);assert.match(personFocus,/Sljedeća/);
  const latest=detail.split('id="latest-changes"')[1].split('id="all-changes"')[0];
  assert.match(latest,/Još jedno dijete/);assert.match(latest,/Ana Dopunjeno \(I001\) → Još jedno dijete/);assert.match(latest,/person=[^"#]+#person-editor/);
  assert.match(detail,/Nove osobe \(5\)/);assert.match(detail,/Nove porodice \(2\)/);assert.match(detail,/Djeca dodana u postojeće porodice \(1\)/);
  assert.match(detail,/Prije: Test, Ana/);assert.match(detail,/Sada: Ana Dopunjeno/);
  let listHtml=await (await fetch(base+'/admin/family-links',{headers:{cookie}})).text();
  assert.match(listHtml,/Početna porodica:<\/b> Test, Ana \(I001\)/);
  assert.match(listHtml,/Obrada:<\/b> U toku/);
  const completed=await fetch(base+branchPath+'/completion',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'5',editor:'Rođak'})});
  assert.equal(completed.status,302);
  detail=await (await fetch(detailUrl,{headers:{cookie}})).text();assert.match(detail,/Završeno — čeka pregled/);assert.match(detail,/Dopunu završio\/la: Rođak/);
  const staleReview=await fetch(detailUrl+'/review',{method:'POST',headers:adminHeaders,body:new URLSearchParams({csrf,revision:'4'})});assert.equal(staleReview.status,409);
  const review=await fetch(detailUrl+'/review',{method:'POST',redirect:'manual',headers:adminHeaders,body:new URLSearchParams({csrf,revision:'5'})});assert.equal(review.status,302);
  listHtml=await (await fetch(base+'/admin/family-links',{headers:{cookie}})).text();assert.match(listHtml,/Obrada:<\/b> Pregledano/);
  detail=await (await fetch(detailUrl,{headers:{cookie}})).text();assert.match(detail,/Nema nepregledanih promjena/);assert.doesNotMatch(detail,/<span class="change-badge">/);assert.match(detail,/Nove osobe \(5\)/);
  const afterReview=await fetch(base+branchPath+'/person',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'5',editor:'Rođak',id:'a',name:'Ana Ponovo'})});assert.equal(afterReview.status,302);
  detail=await (await fetch(detailUrl,{headers:{cookie}})).text();assert.match(detail,/<span>U toku<\/span>/);
  let quick=detail.split('id="change-navigation"')[1].split('</section>')[0];assert.match(quick,/Ana Ponovo/);assert.doesNotMatch(quick,/Novi partner|Prvo dijete/);
  const updatedPerson=await (await fetch(detailUrl+'?legacy=1&person=a',{headers:{cookie}})).text();assert.match(updatedPerson,/Prije: Ana Dopunjeno/);assert.match(updatedPerson,/Sada: Ana Ponovo/);
  const Database=require('better-sqlite3');const upgradeDb=new Database(path.join(dataDir,'porodicni-unos.db'));upgradeDb.prepare('DELETE FROM family_link_review_snapshots').run();upgradeDb.close();
  detail=await (await fetch(detailUrl,{headers:{cookie}})).text();quick=detail.split('id="change-navigation"')[1].split('</section>')[0];assert.match(quick,/Ana Ponovo/);assert.doesNotMatch(quick,/Novi partner/);
  const rereview=await fetch(detailUrl+'/review',{method:'POST',redirect:'manual',headers:adminHeaders,body:new URLSearchParams({csrf,revision:'6'})});assert.equal(rereview.status,302);
  const imported=await fetch(base+branchPath+'/remove-person',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'6',editor:'Rođak',id:'a',confirm:'yes'})});assert.equal(imported.status,400);
  const newPersonPage=await (await fetch(base+branchPath+'?legacy=1&person='+encodeURIComponent(childId))).text();const newCard=newPersonPage.match(/<section id="person-editor" class="person-card">([\s\S]*?)<\/section>/)[1];assert.match(newCard,/Ukloni ovu osobu/);assert.match(newCard,/id="person-families"/);
  const noConfirm=await fetch(base+branchPath+'/remove-person',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'6',editor:'Rođak',id:childId})});assert.equal(noConfirm.status,400);
  const removed=await fetch(base+branchPath+'/remove-person',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'6',editor:'Rođak',id:childId,confirm:'yes'})});assert.equal(removed.status,302);
  detail=await (await fetch(detailUrl,{headers:{cookie}})).text();quick=detail.split('id="change-navigation"')[1].split('</section>')[0];assert.match(quick,/Uklonjena osoba: Drugo dijete/);assert.match(quick,/Izmijenjena porodica/);
  const removedDetail=await (await fetch(detailUrl+'?removed='+encodeURIComponent(childId),{headers:{cookie}})).text();assert.match(removedDetail,/Uklonjena osoba: Drugo dijete/);
  const afterRemoval=await (await fetch(base+branchPath+'?legacy=1&person=b')).text();assert.doesNotMatch(afterRemoval,/Drugo dijete/);assert.match(afterRemoval,/Prvo dijete/);
  const firstChildId=decodeURIComponent(afterRemoval.match(/person=([^"#]+)#person-editor">Prvo dijete/)[1]);
  const parentFamily=await fetch(base+branchPath+'/family',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'7',editor:'Rođak',person:firstChildId,childName:'Unuk'})});assert.equal(parentFamily.status,302);
  const familyRemoveDenied=await fetch(base+branchPath+'/remove-family',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'8',editor:'Rođak',person:'a',family:'family1',confirm:'yes'})});assert.equal(familyRemoveDenied.status,400);
  const orphanAttempt=await fetch(base+branchPath+'/remove-person',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'8',editor:'Rođak',id:firstChildId,confirm:'yes'})});assert.equal(orphanAttempt.status,400);assert.match(await orphanAttempt.text(),/jedini roditelj/);
  const afterOrphanAttempt=await (await fetch(base+branchPath+'?legacy=1&person='+encodeURIComponent(firstChildId))).text();assert.match(afterOrphanAttempt,/Unuk/);
  const createdFamilyId=decodeURIComponent(parentFamily.headers.get('location').match(/family=([^#]+)/)[1]);
  assert.match(afterOrphanAttempt,/Ukloni porodicu/);
  const noFamilyConfirm=await fetch(base+branchPath+'/remove-family',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'8',editor:'Rođak',person:firstChildId,family:createdFamilyId})});assert.equal(noFamilyConfirm.status,400);
  const removeFamily=await fetch(base+branchPath+'/remove-family',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'8',editor:'Rođak',person:firstChildId,family:createdFamilyId,confirm:'yes'})});assert.equal(removeFamily.status,302);
  const afterFamilyRemoval=await (await fetch(base+branchPath+'?map=1')).text();assert.match(afterFamilyRemoval,/Osobe bez porodične veze/);assert.match(afterFamilyRemoval,/Unuk/);



  const staleCompletion=await fetch(base+branchPath+'/completion',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:publicCsrf,revision:'5',editor:'Rođak'})});assert.equal(staleCompletion.status,409);
  await fetch(detailUrl+'/toggle',{method:'POST',headers:adminHeaders,body:new URLSearchParams({csrf})});
  const inactiveDetail=await (await fetch(detailUrl,{headers:{cookie}})).text();assert.match(inactiveDetail,/Link je isključen/);assert.doesNotMatch(inactiveDetail,/class="share-url"/);
  assert.equal((await fetch(base+branchPath)).status,404);
  assert.equal((await fetch(base+branchPath+'/person',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body})).status,404);
  const firstId=Number(detailUrl.match(/\d+$/)[0]);
  const nextCreate=await fetch(`${base}/admin/family-links/prepare`,{method:'POST',redirect:'manual',headers:adminHeaders,body:new URLSearchParams({csrf,label:'Drugi link',family:'family1'})});assert.equal(nextCreate.status,302);
  const secondUrl=base+nextCreate.headers.get('location'),secondId=Number(secondUrl.match(/\d+$/)[0]);
  await fetch(secondUrl+'/toggle',{method:'POST',redirect:'manual',headers:adminHeaders,body:new URLSearchParams({csrf})});
  const secondDetail=await (await fetch(secondUrl,{headers:{cookie}})).text(),secondPath=secondDetail.match(/href="(\/branch\/[a-f0-9]+)"/)[1];
  const dbCheck=new Database(path.join(dataDir,'porodicni-unos.db'));
  assert.ok(dbCheck.prepare('SELECT COUNT(*) n FROM family_link_history WHERE link_id=?').get(firstId).n>0);
  assert.equal(dbCheck.prepare('SELECT COUNT(*) n FROM family_link_review_snapshots WHERE link_id=?').get(firstId).n,1);
  const confirmPage=await (await fetch(detailUrl+'/delete',{headers:{cookie}})).text();assert.match(confirmPage,/traj|Traj/i);assert.match(confirmPage,/Gramps podaci/);assert.match(confirmPage,/name="confirm"/);
  const anonymousDelete=await fetch(detailUrl+'/delete',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,revision:'9',confirm:'yes'})});assert.equal(anonymousDelete.status,302);
  const rejectedCsrf=await fetch(detailUrl+'/delete',{method:'POST',headers:adminHeaders,body:new URLSearchParams({csrf:'invalid',revision:'9',confirm:'yes'})});assert.equal(rejectedCsrf.status,403);
  const noConfirmDelete=await fetch(detailUrl+'/delete',{method:'POST',headers:adminHeaders,body:new URLSearchParams({csrf,revision:'9'})});assert.equal(noConfirmDelete.status,400);
  const staleDelete=await fetch(detailUrl+'/delete',{method:'POST',headers:adminHeaders,body:new URLSearchParams({csrf,revision:'7',confirm:'yes'})});assert.equal(staleDelete.status,409);
  assert.equal((await fetch(detailUrl,{headers:{cookie}})).status,200);
  const deleted=await fetch(detailUrl+'/delete',{method:'POST',redirect:'manual',headers:adminHeaders,body:new URLSearchParams({csrf,revision:'9',confirm:'yes'})});assert.equal(deleted.status,302);assert.equal(deleted.headers.get('location'),'/admin/family-links?deleted=1');
  assert.equal((await fetch(detailUrl,{headers:{cookie}})).status,404);assert.equal((await fetch(base+secondPath)).status,200);
  for(const table of ['family_link_history','family_link_progress','family_link_review_snapshots'])assert.equal(dbCheck.prepare(`SELECT COUNT(*) n FROM ${table} WHERE link_id=?`).get(firstId).n,0);
  assert.equal(dbCheck.prepare('SELECT COUNT(*) n FROM family_links WHERE id=?').get(secondId).n,1);
  const activeDelete=await fetch(secondUrl+'/delete',{method:'POST',redirect:'manual',headers:adminHeaders,body:new URLSearchParams({csrf,revision:'0',confirm:'yes'})});assert.equal(activeDelete.status,302);assert.equal((await fetch(base+secondPath)).status,404);
  dbCheck.close();


});
