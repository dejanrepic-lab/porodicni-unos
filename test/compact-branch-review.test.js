const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const express=require('express');
const Database=require('better-sqlite3');
const {JSDOM,VirtualConsole}=require('jsdom');
const {mountFamilyLinks}=require('../lib/family-links');
const asset=file=>fs.readFileSync(path.join(__dirname,'../public',file),'utf8');
async function fixture(t,data,query='person=a'){
 const db=new Database(':memory:'),app=express();mountFamilyLinks(app,{db,adminAuth:(req,res,next)=>next(),client:()=>{}});
 const json=JSON.stringify(data);db.prepare('INSERT INTO family_links(token,label,baseline,working,created,active) VALUES(?,?,?,?,?,1)').run('compact','Test',json,json,'2026-01-01');
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(()=>{server.close();db.close();});const origin=`http://127.0.0.1:${server.address().port}`,url=origin+'/branch/compact/form?'+query;
 let page=await (await fetch(url)).text();
 page=page.replace(/((?:src|href)="\/[^"?]+\.(?:css|js))\?[^"]*"/g,'$1"');
 page=page.replace('<link rel="stylesheet" href="/app.css">',()=>'<style>'+asset('app.css')+'</style>');
 assert.match(page,/branch-review.css/);assert.match(page,/branch-review.js/);
 for(const file of ['descendant-data.js','branch-form.js','branch-preview.js','branch-review.js','branch-workflow.js'])page=page.replace(`<script src="/${file}"></script>`,()=>'<script>'+asset(file)+'</script>');
 page=page.replace('<link rel="stylesheet" href="/branch-review.css">',()=>'<style>'+asset('branch-review.css')+'</style>');
 const errors=[],console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM(page,{url,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse(w){w.structuredClone=structuredClone;w.fetch=(u,o)=>fetch(new URL(u,origin),o);w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=(x,y)=>Object.defineProperty(w,'scrollY',{value:typeof x==='object'?x.top:y,writable:true,configurable:true});}});
 t.after(()=>dom.window.close());assert.deepEqual(errors,[]);
 const w=dom.window,d=w.document;
 const put=(input,value)=>{input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));};
 const save=async()=>{await d.querySelector('#familyForm').onsubmit(new w.Event('submit',{bubbles:true,cancelable:true}));await d.querySelector('#sendBtn').onclick();};
 return {db,w,d,put,save,errors,json};
}
function family(){return {rootFamily:'f',people:[{id:'a',name:'Test, Ana',birth:'oko 1970',notes:'Originalna napomena'},{id:'b',name:'Test, Marko'},{id:'c',name:'Test, Dijete'},{id:'p',name:'Drugi, Partner'},{id:'g',name:'Test, Unuče',death:'2020'}],families:[{id:'f',parents:['a','b'],children:['c'],notes:'Napomena porodice'},{id:'fc',parents:['c','p'],children:['g']}],original:{people:[]}};}
test('one contributor name handles saving and finishing without a reload or reopening reviewed work',async t=>{
 const {db,w,d,put,save,errors,json}=await fixture(t,family()),author=d.querySelector('#familyForm [name=submittedBy]'),finish=d.querySelector('.branch-finish'),review=d.querySelector('.review-savebar button');
 const completion=d.querySelector('.branch-completion form');
 assert.equal(d.querySelectorAll('#familyForm [name=submittedBy]').length,1);
 assert.equal(completion.elements.editor.type,'hidden');assert.equal(review.disabled,true);assert.equal(finish.disabled,false);
 completion.dispatchEvent(new w.Event('submit',{cancelable:true}));
 assert.equal(d.activeElement,author);assert.match(d.querySelector('.branch-workflow-message').textContent,/ime/);
 put(author,'Tetka Mira');assert.equal(w.sessionStorage.getItem('branch-author:/branch/compact'),'Tetka Mira');
 const complete=async()=>{const done=new Promise(resolve=>d.addEventListener('branch:completed',resolve,{once:true}));completion.dispatchEvent(new w.Event('submit',{cancelable:true}));await done;};
 const url=w.location.href;w.scrollTo(0,500);await complete();await Promise.resolve();
 assert.equal(w.location.href,url);assert.equal(w.scrollY,500);assert.match(d.querySelector('.branch-progress').textContent,/Završeno/);assert.equal(finish.disabled,true);
 assert.equal(db.prepare('SELECT working FROM family_links').get().working,json);assert.equal(db.prepare('SELECT revision FROM family_links').get().revision,0);assert.equal(db.prepare('SELECT submitted_by FROM family_link_progress').get().submitted_by,'Tetka Mira');
 put(d.querySelector('[name=father_birthDate]'),'1972');assert.equal(finish.disabled,true);assert.equal(review.disabled,false);await save();
 assert.match(d.querySelector('.review-save-status').textContent,/Sve izmjene su sačuvane/);assert.equal(review.disabled,true);assert.equal(finish.disabled,false);assert.equal(completion.elements.revision.value,'1');
 await complete();db.prepare('UPDATE family_link_progress SET reviewed_revision=1,reviewed_at=?').run('2026-01-02');
 const response=await w.fetch(completion.action,{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:completion.elements.csrf.value,revision:'1',editor:'Drugo ime'}).toString()});
 assert.equal((await response.json()).progress,'Pregledano');assert.equal(db.prepare('SELECT reviewed_revision,submitted_by FROM family_link_progress').get().submitted_by,'Tetka Mira');assert.equal(db.prepare('SELECT reviewed_revision FROM family_link_progress').get().reviewed_revision,1);assert.deepEqual(errors,[]);
});
test('cancelling a new row and undoing a removed child restore a clean form and preserve family focus',async t=>{
 const {w,d,errors}=await fixture(t,family()),review=d.querySelector('.review-savebar button');
 d.querySelector('#addChild').click();const added=d.querySelector('#children').lastElementChild;
 assert.equal(review.disabled,false);assert.equal(added.querySelector('.child-remove').textContent,'Odustani od dodavanja');
 added.querySelector('.child-remove').click();await Promise.resolve();assert.equal(review.disabled,true);
 const unload=new w.Event('beforeunload',{cancelable:true});w.dispatchEvent(unload);assert.equal(unload.defaultPrevented,false);
 const child=d.querySelector('#children > .child-card');child.querySelector('.review-actions button:nth-child(2)').click();
 const grandchild=w.addGrandchild(child);grandchild.querySelector('[data-c=firstName]').value='Privremeno';const before=w.familyData();
 grandchild.querySelector('.review-actions button').click();assert.equal(grandchild.querySelector('.child-remove').textContent,'Odustani od dodavanja');
 grandchild.querySelector('.child-remove').click();await Promise.resolve();assert.equal(review.disabled,true);assert.ok(child.classList.contains('review-family-open'));
 assert.equal(d.querySelector('.branch-undo').hidden,false);d.querySelector('.branch-undo button').click();
 assert.equal(review.disabled,false);assert.deepEqual(w.familyData(),before);assert.ok(child.classList.contains('review-family-open'));assert.deepEqual(errors,[]);
});
test('a child can gain a partner directly and destructive actions follow the selected saved family',async t=>{
 const data=family();data.people.push({id:'leaf',name:'Test, Novo dijete'});data.families[0].children.push('leaf');
 const {db,w,d,put,save,errors}=await fixture(t,data),leaf=d.querySelector('#children').lastElementChild,action=leaf.querySelector('.review-actions button:nth-child(2)');
 assert.equal(action.textContent,'+ Dodaj partnera');action.click();assert.equal(d.querySelectorAll('.review-editing').length,0);
 const partner=leaf.querySelector('[data-s=firstName]');assert.equal(d.activeElement,partner);assert.equal(partner.closest('.descendant-partner').open,true);
 put(partner,'Novi partner');put(d.querySelector('[name=submittedBy]'),'Rođak');await save();
 const saved=JSON.parse(db.prepare('SELECT working FROM family_links').get().working),familyId=saved.families.find(f=>f.parents.includes('leaf')).id;
 const removal=d.querySelector('form[action$="/remove-family"]');assert.equal(removal.closest('details').hidden,false);assert.equal(removal.elements.family.value,familyId);assert.equal(removal.elements.person.value,'leaf');assert.match(removal.closest('details').textContent,/Novo dijete Test/);
 put(leaf.querySelector('[data-c=birthDate]'),'2000');const event=new w.Event('submit',{cancelable:true});removal.dispatchEvent(event);assert.equal(event.defaultPrevented,true);assert.match(d.querySelector('.branch-workflow-message').textContent,/Prvo sačuvaj/);assert.equal(db.prepare('SELECT revision FROM family_links').get().revision,1);assert.deepEqual(errors,[]);
});
test('finishing errors keep the saved form in place and allow retrying',async t=>{
 const {db,w,d,put,errors}=await fixture(t,family());put(d.querySelector('[name=submittedBy]'),'Rođak');
 w.fetch=async()=>({ok:false,json:async()=>({error:'Veza je prekinuta. Pokušaj ponovo.'})});
 d.querySelector('.branch-completion form').dispatchEvent(new w.Event('submit',{cancelable:true}));await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(d.querySelector('.branch-workflow-message').hidden,false);assert.match(d.querySelector('.branch-workflow-message').textContent,/Veza je prekinuta/);assert.equal(d.querySelector('.branch-finish').disabled,false);assert.equal(d.querySelector('[name=submittedBy]').value,'Rođak');assert.equal(db.prepare('SELECT revision FROM family_links').get().revision,0);assert.deepEqual(errors,[]);
});
test('imported standard and custom relationship types stay visible and survive unrelated edits',async t=>{
 const data=family();data.families[0].relationship='Brak';data.families[1].relationship='Veza po običaju <x>';
 const {db,w,d,put,errors}=await fixture(t,data);assert.equal(d.querySelector('.review-relationship select').value,'Brak');assert.equal(d.querySelector('[name=primaryRelationship]').value,'Brak');
 const child=d.querySelector('#children > .child-card');assert.equal(child.querySelector('[data-s=relationship]').value,'Veza po običaju <x>');assert.match(child.querySelector('.review-facts').textContent,/Veza: Veza po običaju <x>/);assert.equal(d.querySelector('x'),null);
 child.querySelector('.review-actions button:nth-child(2)').click();assert.equal(child.querySelector('.review-relationship select').value,'Veza po običaju <x>');put(child.querySelector('[data-c=birthPlace]'),'Novo mjesto');put(d.querySelector('[name=submittedBy]'),'Rođak');await d.querySelector('#familyForm').onsubmit(new w.Event('submit',{bubbles:true,cancelable:true}));
 assert.equal(Array.from(d.querySelectorAll('.preview-change > strong')).some(el=>el.textContent==='Vrsta veze'),false);await d.querySelector('#sendBtn').onclick();const saved=JSON.parse(db.prepare('SELECT working FROM family_links').get().working);assert.equal(saved.families[0].relationship,'Brak');assert.equal(saved.families[1].relationship,'Veza po običaju <x>');assert.deepEqual(errors,[]);
});
test('family metadata is edited locally without opening person editors or changing other families',async t=>{
 const data=family();data.families[0].relationship='Brak';data.families[0].source='Tetka Mira';data.families[1].relationship='Nepoznato';data.families[1].notes='Stara napomena';
 const {db,w,d,put,save,errors}=await fixture(t,data),form=d.querySelector('#familyForm'),root=d.querySelector('.review-root-extra'),child=d.querySelector('#children > .child-card');
 assert.equal(root.tagName,'DIV');assert.equal(root.previousElementSibling.className,'review-parents');assert.equal(d.querySelector('.relationship-section'),null);
 assert.equal(root.querySelectorAll('h2').length,0);assert.equal(root.querySelectorAll('textarea').length,2);assert.match(root.textContent,/Tetka Mira.*Napomena porodice/);
 assert.equal(root.querySelectorAll('details[open]').length,0);assert.equal(d.querySelectorAll('.review-editing').length,0);assert.match(d.querySelector('.review-save-status').textContent,/Nema nesačuvanih izmjena/);
 put(root.querySelector('select'),'Vanbračna zajednica');put(d.querySelector('[name=source]'),'Porodični dokument');put(d.querySelector('[name=submittedBy]'),'Rođak');
 await form.onsubmit(new w.Event('submit',{bubbles:true,cancelable:true}));assert.equal(d.querySelectorAll('.preview-item').length,1);assert.match(d.querySelector('#result').textContent,/Brak.*Vanbračna zajednica/);
 d.querySelector('.preview-correct').click();assert.equal(d.activeElement.name,'primaryRelationship');assert.equal(d.querySelectorAll('.review-editing').length,0);
 child.querySelector('.review-actions button:nth-child(2)').click();const meta=child.querySelector(':scope > .review-family-meta');assert.equal(w.getComputedStyle(meta).display,'flex');assert.equal(meta.querySelector('select').value,'Nepoznato');
 put(meta.querySelector('select'),'Partnerstvo');await form.onsubmit(new w.Event('submit',{bubbles:true,cancelable:true}));
 Array.from(d.querySelectorAll('.preview-family')).find(el=>el.textContent.includes('Partnerstvo')).querySelector('.preview-correct').click();assert.equal(d.activeElement,meta.querySelector('select'));assert.equal(d.querySelectorAll('.review-editing').length,0);assert.ok(child.classList.contains('review-family-open'));
 const notes=meta.querySelector('textarea');put(notes,'Dopuna porodice');put(meta.querySelector('select'),'Nepoznato');await form.onsubmit(new w.Event('submit',{bubbles:true,cancelable:true}));
 const correction=Array.from(d.querySelectorAll('.preview-family')).find(el=>el.textContent.includes('Dopuna porodice')).querySelector('.preview-correct');correction.click();assert.equal(d.activeElement,notes);assert.equal(notes.closest('details').open,true);assert.equal(d.querySelectorAll('.review-editing').length,0);
 await save();const saved=JSON.parse(db.prepare('SELECT working FROM family_links').get().working);assert.equal(saved.families[0].relationship,'Vanbračna zajednica');assert.equal(saved.families[0].source,'Porodični dokument');assert.equal(saved.families[0].notes,'Napomena porodice');assert.equal(saved.families[1].relationship,'Nepoznato');assert.equal(saved.families[1].notes,'Dopuna porodice');assert.deepEqual(errors,[]);
});
test('family navigation keeps map context and completion requires saved edits',async t=>{
 const {d,w,put,save,errors}=await fixture(t,family());const child=d.querySelector('#children > .child-card');
 assert.equal(d.querySelector('.branch-map-link').textContent,'Mapa cijele grane');assert.match(d.querySelector('.branch-progress').textContent,/Otvoren, bez izmjena/);
 child.querySelector('.review-actions button:nth-child(2)').click();assert.equal(d.querySelector('.review-root-name').textContent,'Dijete Test i Partner Drugi');assert.match(d.querySelector('.branch-map-link').href,/focus=c&returnFamily=fc/);
 const completion=d.querySelector('.branch-completion form');put(child.querySelector('[data-c=birthDate]'),'1990');let event=new w.Event('submit',{bubbles:true,cancelable:true});completion.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
 put(d.querySelector('[name=submittedBy]'),'Rođak');assert.equal(completion.querySelector('[name=editor]').value,'Rođak');await save();assert.equal(completion.querySelector('[name=revision]').value,'1');assert.equal(completion.querySelector('[name=context]').value,'c');assert.equal(completion.querySelector('[name=family]').value,'fc');assert.match(d.querySelector('.branch-progress').textContent,/U toku/);assert.ok(child.classList.contains('review-family-open'));assert.deepEqual(errors,[]);
});
test('adding a person does not propose or save an untouched Gramps name reformat',async t=>{
 const data=family();data.people.find(p=>p.id==='b').name='Milan  Repić';data.original.people=[{handle:'b',primary_name:{first_name:'Milan ',surname_list:[{surname:'Repić'}]}}];
 const {db,w,d,put,errors}=await fixture(t,data);const form=d.querySelector('#familyForm');assert.equal(d.querySelector('[name=mother_firstName]').value,'Milan ');
 d.querySelector('#addChild').click();const card=d.querySelector('#children').lastElementChild;put(card.querySelector('[data-c=firstName]'),'Novo dijete');put(d.querySelector('[name=submittedBy]'),'Rođak');
 const preview=()=>form.onsubmit(new w.Event('submit',{bubbles:true,cancelable:true}));await preview();assert.match(d.querySelector('.preview-totals').textContent,/Nove osobe: 1/);assert.doesNotMatch(d.querySelector('.preview-totals').textContent,/Osobe s izmjenama/);assert.equal(d.querySelectorAll('.preview-before').length,0);
 await d.querySelector('#sendBtn').onclick();assert.equal(JSON.parse(db.prepare('SELECT working FROM family_links').get().working).people.find(p=>p.id==='b').name,'Milan  Repić');
 await preview();assert.match(d.querySelector('#result').textContent,/Nema novih izmjena/);d.querySelector('#backBtn').click();put(d.querySelector('[name=mother_firstName]'),'Milan Jovan');await preview();assert.match(d.querySelector('.preview-totals').textContent,/Osobe s izmjenama: 1/);assert.match(d.querySelector('.preview-after').textContent,/Milan Jovan/);assert.deepEqual(errors,[]);
});
test('readable date presentation leaves stored dates and editable values unchanged',async t=>{
 const data=family();data.people[0].birth='1956-02-15';data.people[0].death='2015-03-07';
 const {db,w,d,put,save}=await fixture(t,data);const parent=d.querySelector('[data-prefix=father]').closest('.section');
 assert.match(parent.querySelector('.review-facts').textContent,/Rođ\. 15\.02\.1956.*Preminuo\/la 07\.03\.2015/);
 assert.equal(d.querySelector('[name=father_birthDate]').value,'1956-02-15');assert.equal(w.getComputedStyle(d.querySelector('[name=father_firstName]')).fontSize,'16px');
 put(d.querySelector('[name=father_birthPlace]'),'Novo mjesto');put(d.querySelector('[name=submittedBy]'),'Rođak');await save();
 const saved=JSON.parse(db.prepare('SELECT working FROM family_links').get().working).people.find(p=>p.id==='a');assert.equal(saved.birth,'1956-02-15');assert.equal(saved.death,'2015-03-07');
});
test('compact review opens one editor and one family while preserving and saving the shared form',async t=>{
 const {db,w,d,put,save,errors,json}=await fixture(t,family());
 const form=d.querySelector('#familyForm'),parent=d.querySelector('[data-prefix=father]').closest('.section'),child=d.querySelector('#children > .child-card');
 assert.ok(form.classList.contains('compact-review'));assert.equal(d.querySelectorAll('.review-editing').length,0);
 assert.equal(w.getComputedStyle(parent.querySelector(':scope > .grid')).display,'none');assert.match(parent.querySelector('.review-facts').textContent,/oko 1970/);
 assert.equal(w.getComputedStyle(child.querySelector(':scope > .descendant-family')).display,'none');assert.match(child.querySelector('.review-facts').textContent,/Partner: Partner Drugi.*Djeca: 1/);
 assert.ok(form.querySelector('.sender-section').compareDocumentPosition(form.querySelector('.review-savebar')) & w.Node.DOCUMENT_POSITION_FOLLOWING);
 parent.querySelector('.review-actions button').click();assert.ok(parent.classList.contains('review-editing'));
 const more=parent.querySelector('.review-more');assert.equal(more.open,false);assert.equal(d.querySelector('[name=father_notes]').value,'Originalna napomena');
 const missing=d.querySelector('.review-missing');assert.equal(missing.open,false);const addPlace=Array.from(missing.querySelectorAll('button')).find(b=>b.textContent==='Ana Test — dodaj mjesto rođenja');addPlace.click();assert.equal(d.activeElement.name,'father_birthPlace');put(d.activeElement,'Salzburg');
 child.querySelector('.review-actions button').click();assert.equal(d.querySelectorAll('.review-editing').length,1);assert.equal(parent.classList.contains('review-editing'),false);put(child.querySelector('[data-c=birthDate]'),'1995');
 child.querySelector(':scope > .actions > .child-collapse').click();assert.equal(d.querySelectorAll('.review-editing').length,0);assert.match(child.querySelector('.review-state').textContent,/nije sačuvano/);
 child.querySelector('.review-actions button:nth-child(2)').click();assert.ok(form.classList.contains('descendant-focus-mode'));assert.ok(child.classList.contains('review-family-open'));assert.equal(w.getComputedStyle(child.querySelector(':scope > .descendant-family')).display,'block');assert.equal(w.getComputedStyle(missing).display,'block');assert.notEqual(w.getComputedStyle(d.querySelector('.descendant-focus-toolbar')).display,'none');
 child.querySelector(':scope > .descendant-family > .actions > .add-grandchild').click();const newChild=child.querySelector(':scope > .descendant-family > .nested-list').lastElementChild;assert.ok(newChild.classList.contains('review-editing'));put(newChild.querySelector('[data-c=firstName]'),'Novo unuče');
 const focusedChildId=child.dataset.branchId;put(d.querySelector('[name=submittedBy]'),'Rođak');w.scrollTo(0,680);await save();assert.equal(w.scrollY,680);assert.ok(form.classList.contains('descendant-focus-mode'));assert.equal(child.dataset.branchId,focusedChildId);assert.equal(d.querySelectorAll('.review-changed').length,0);
 let row=db.prepare('SELECT * FROM family_links').get(),saved=JSON.parse(row.working);assert.equal(row.baseline,json);assert.equal(row.revision,1);assert.equal(saved.people.find(p=>p.id==='a').birthPlace,'Salzburg');assert.equal(saved.people.find(p=>p.id==='a').notes,'Originalna napomena');assert.equal(saved.people.find(p=>p.id==='c').birth,'1995');assert.equal(saved.people.find(p=>p.id==='g').death,'2020');assert.ok(saved.people.some(p=>p.firstName==='Novo unuče'));
 await save();assert.equal(JSON.parse(db.prepare('SELECT working FROM family_links').get().working).people.length,saved.people.length);
 d.querySelector('.descendant-focus-toolbar button').click();assert.equal(form.classList.contains('descendant-focus-mode'),false);assert.equal(child.classList.contains('review-family-open'),false);assert.equal(w.getComputedStyle(child.querySelector(':scope > .descendant-family')).display,'none');assert.deepEqual(errors,[]);
});
test('a blank partner and children are added explicitly and hidden optional values remain editable',async t=>{
 const data={rootFamily:null,people:[{id:'a',name:'Test, Ana'}],families:[],original:{people:[]}};
 const {db,d,put,save,errors}=await fixture(t,data);
 assert.equal(d.querySelectorAll('#children > .child-card').length,0);assert.equal(d.querySelector('.review-empty').hidden,false);
 const partner=d.querySelector('[data-prefix=mother]').closest('.section');assert.equal(partner.querySelector('.review-actions button').textContent,'＋ Dodaj partnera');partner.querySelector('.review-actions button').click();put(d.querySelector('[name=mother_firstName]'),'Novi partner');
 const more=partner.querySelector('.review-more');more.open=true;put(d.querySelector('[name=mother_nickname]'),'Nadimak');
 d.querySelector('#addChild').click();const child=d.querySelector('#children > .child-card');assert.ok(child.classList.contains('review-editing'));assert.equal(partner.classList.contains('review-editing'),false);put(child.querySelector('[data-c=firstName]'),'Dijete');put(d.querySelector('[name=submittedBy]'),'Rođak');await save();
 const saved=JSON.parse(db.prepare('SELECT working FROM family_links').get().working);assert.equal(saved.families.length,1);assert.equal(saved.families[0].parents.length,2);assert.equal(saved.families[0].children.length,1);assert.ok(saved.people.some(p=>p.nickname==='Nadimak'));assert.deepEqual(errors,[]);
});
test('deep family navigation returns one level and a failed save retains the edits',async t=>{
 const data=family();data.people.push({id:'gg',name:'Test, Praunuče'});data.families.push({id:'fg',parents:['g'],children:['gg']});
 const {db,w,d,put,save,errors}=await fixture(t,data);
 const child=d.querySelector('#children > .child-card');child.querySelector('.review-actions button:nth-child(2)').click();
 const grandchild=child.querySelector(':scope > .descendant-family > .nested-list > .child-card');grandchild.querySelector('.review-actions button:nth-child(2)').click();assert.ok(grandchild.classList.contains('review-family-open'));
 const greatGrandchild=grandchild.querySelector(':scope > .descendant-family > .nested-list > .child-card');assert.equal(greatGrandchild.querySelector('.review-name').textContent,'Praunuče Test');
 greatGrandchild.querySelector('.review-actions button').click();put(greatGrandchild.querySelector('[data-c=birthDate]'),'oko 1930');
 d.querySelector('.descendant-focus-toolbar button').click();assert.ok(child.classList.contains('review-family-open'));assert.equal(grandchild.classList.contains('review-family-open'),false);assert.equal(w.familyData().children[0].children[0].children[0].birthDate,'oko 1930');
 put(d.querySelector('[name=source]'),'Tetka Mira');assert.equal(d.querySelector('.review-save-status').textContent,'Ima nesačuvanih izmjena');put(d.querySelector('[name=submittedBy]'),'Rođak');
 db.prepare('UPDATE family_links SET revision=revision+1').run();await save();assert.match(d.querySelector('#sendStatus').textContent,/u međuvremenu/);assert.match(greatGrandchild.querySelector('.review-state').textContent,/nije sačuvano/);assert.equal(greatGrandchild.querySelector('[data-c=birthDate]').value,'oko 1930');assert.ok(child.classList.contains('review-family-open'));assert.deepEqual(errors,[]);
});
test('save preview shows just the changes and correction returns to the exact person',async t=>{
 const {db,w,d,put,errors}=await fixture(t,family());const form=d.querySelector('#familyForm');
 put(d.querySelector('[name=father_birthDate]'),'1972');put(d.querySelector('[name=submittedBy]'),'Rođak');
 const preview=()=>form.onsubmit(new w.Event('submit',{bubbles:true,cancelable:true}));await preview();
 assert.ok(d.body.classList.contains('branch-preview-open'));assert.equal(d.querySelectorAll('.preview-family').length,1);assert.equal(d.querySelectorAll('.preview-item').length,1);assert.match(d.querySelector('#result').textContent,/Datum rođenja.*Bilo.*oko 1970.*Sada.*1972/);assert.doesNotMatch(d.querySelector('#result').textContent,/Originalna napomena/);assert.equal(db.prepare('SELECT revision FROM family_links').get().revision,0);
 d.querySelector('.preview-correct').click();assert.equal(d.body.classList.contains('branch-preview-open'),false);assert.equal(d.activeElement.name,'father_birthDate');assert.equal(d.querySelector('[name=father_birthDate]').value,'1972');
 put(d.querySelector('[name=father_birthDate]'),'1973');await preview();await d.querySelector('#sendBtn').onclick();assert.equal(d.body.classList.contains('branch-preview-open'),false);assert.equal(JSON.parse(db.prepare('SELECT working FROM family_links').get().working).people.find(p=>p.id==='a').birth,'1973');
 await preview();assert.match(d.querySelector('#result').textContent,/Nema novih izmjena/);assert.equal(d.querySelector('#sendBtn').disabled,true);d.querySelector('#backBtn').click();
 const child=d.querySelector('#children > .child-card');child.querySelector('.review-actions button:nth-child(2)').click();put(child.querySelector('[data-c=birthDate]'),'1990');await preview();d.querySelector('.preview-correct').click();assert.ok(child.classList.contains('review-family-open'));assert.equal(d.activeElement.dataset.c,'birthDate');put(child.querySelector('[data-c=birthDate]'),'');
 const grandchild=child.querySelector(':scope > .descendant-family > .nested-list > .child-card');put(grandchild.querySelector('[data-c=birthPlace]'),'Novo mjesto');await preview();assert.equal(d.querySelectorAll('.preview-item').length,1);d.querySelector('.preview-correct').click();assert.equal(d.activeElement.dataset.c,'birthPlace');assert.ok(grandchild.classList.contains('review-editing'));assert.ok(child.classList.contains('review-family-open'));assert.deepEqual(errors,[]);
});

test('adding a child has a clear local finish and a single cancellable preview card',async t=>{
 const {db,w,d,put,errors}=await fixture(t,family());d.querySelector('#addChild').click();const child=d.querySelector('#children').lastElementChild,done=child.querySelector(':scope > .actions > .child-collapse');
 assert.equal(done.textContent,'Gotovo — dodaj u porodicu');done.click();assert.ok(child.classList.contains('review-editing'));
 put(child.querySelector('[data-c=firstName]'),'Probno dijete');put(child.querySelector('[data-c=birthDate]'),'2026');done.click();assert.equal(child.classList.contains('review-editing'),false);assert.match(child.querySelector('.review-state').textContent,/Novo · nije sačuvano/);
 put(d.querySelector('[name=submittedBy]'),'Rođak');await d.querySelector('#familyForm').onsubmit(new w.Event('submit',{cancelable:true}));
 assert.equal(d.querySelectorAll('.preview-item').length,1);assert.match(d.querySelector('#result').textContent,/Dodaješ dijete u porodicu/);d.querySelector('.preview-cancel').click();await Promise.resolve();
 assert.equal(child.isConnected,false);assert.equal(d.body.classList.contains('branch-preview-open'),false);assert.equal(d.querySelector('.review-savebar button').disabled,true);assert.equal(db.prepare('SELECT revision FROM family_links').get().revision,0);d.querySelector('.branch-undo button').click();assert.equal(child.isConnected,true);assert.equal(child.querySelector('[data-c=birthDate]').value,'2026');assert.deepEqual(errors,[]);
});

test('second partner entry explains the separate union and offers a validated cancel route',async t=>{
 const data=family();data.people.push({id:'other',name:'Test, Drugi partner'});data.families.push({id:'second',parents:['a','other'],children:[]});
 const {db,w,d,put,save,errors,json}=await fixture(t,data,'person=a&family=new&returnFamily=second');
 assert.equal(d.querySelector('.hero h1').textContent,'Dodavanje drugog partnera');assert.equal(d.activeElement.name,'mother_firstName');assert.match(d.querySelector('.branch-cancel-partner').href,/person=a&family=second$/);assert.equal(d.querySelector('[name=mother_firstName]').value,'');
 put(d.querySelector('[name=mother_firstName]'),'Treći partner');assert.equal(db.prepare('SELECT working FROM family_links').get().working,json);const event=new w.Event('beforeunload',{cancelable:true});w.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
 put(d.querySelector('[name=submittedBy]'),'Rođak');await save();assert.equal(d.querySelector('.branch-cancel-partner'),null);assert.equal(d.querySelector('.hero h1').textContent,'Pregled porodice');const saved=JSON.parse(db.prepare('SELECT working FROM family_links').get().working);assert.equal(saved.families.length,4);assert.deepEqual(saved.families.find(f=>f.id==='f'),data.families[0]);assert.deepEqual(saved.families.find(f=>f.id==='second'),data.families[2]);assert.deepEqual(errors,[]);
});

test('only an added child can be deleted, and deletion removes the person rather than just the parent link',async t=>{
 const {db,w,d,put,save,errors}=await fixture(t,family());const imported=d.querySelector('#children > .child-card');assert.equal(imported.querySelector('.child-remove').hidden,true);imported.querySelector('.child-remove').click();assert.equal(imported.isConnected,true);
 d.querySelector('#addChild').click();const child=d.querySelector('#children').lastElementChild;put(child.querySelector('[data-c=firstName]'),'Greška');put(d.querySelector('[name=submittedBy]'),'Rođak');await save();const id=child.dataset.branchId;
 assert.equal(child.querySelector('.child-remove').textContent,'Obriši dodano dijete');let posted;w.confirm=()=>true;w.HTMLFormElement.prototype.submit=function(){posted={action:this.action,body:new URLSearchParams(new w.FormData(this)).toString()};};child.querySelector('.child-remove').click();assert.ok(posted);
 const response=await w.fetch(posted.action,{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:posted.body});assert.equal(response.status,302);const working=JSON.parse(db.prepare('SELECT working FROM family_links').get().working);assert.equal(working.people.some(p=>p.id===id),false);assert.equal(working.families.some(f=>f.children.includes(id)),false);assert.ok(working.people.some(p=>p.id==='c'));assert.deepEqual(errors,[]);
});

test('a new child editor has one partner entry and no premature relationship controls',async t=>{
 const {w,d,put,errors}=await fixture(t,family());d.querySelector('#addChild').click();const child=d.querySelector('#children').lastElementChild,actions=child.querySelector('.review-actions'),partner=child.querySelector(':scope > .descendant-partner'),meta=child.querySelector(':scope > .review-family-meta');
 assert.equal(actions.querySelector('button:nth-child(2)').hidden,true);assert.equal(partner.open,false);assert.equal(meta.hidden,true);
 put(child.querySelector('[data-c=firstName]'),'Novo dijete');partner.open=true;partner.dispatchEvent(new w.Event('toggle'));assert.equal(meta.hidden,false);assert.equal(meta.querySelector('.review-relationship').hidden,false);
 put(child.querySelector('[data-s=firstName]'),'Novi partner');partner.open=false;partner.dispatchEvent(new w.Event('toggle'));assert.equal(meta.hidden,false);
 child.querySelector(':scope > .actions > .child-collapse').click();assert.equal(actions.querySelector('button:nth-child(2)').hidden,false);assert.equal(actions.querySelector('button:nth-child(2)').textContent,'Porodica');assert.deepEqual(errors,[]);
});
