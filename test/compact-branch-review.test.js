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
 page=page.replace('<link rel="stylesheet" href="/app.css?v=2.13.1">',()=>'<style>'+asset('app.css')+'</style>');
 assert.match(page,/branch-review.css/);assert.match(page,/branch-review.js/);
 for(const file of ['descendant-data.js','branch-form.js','branch-preview.js','branch-review.js'])page=page.replace(`<script src="/${file}"></script>`,()=>'<script>'+asset(file)+'</script>');
 page=page.replace('<link rel="stylesheet" href="/branch-review.css?v=2.13.2">',()=>'<style>'+asset('branch-review.css')+'</style>');
 const errors=[],console=new VirtualConsole();console.on('jsdomError',error=>errors.push(error.message));
 const dom=new JSDOM(page,{url,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse(w){w.structuredClone=structuredClone;w.fetch=(u,o)=>fetch(new URL(u,origin),o);w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=(x,y)=>Object.defineProperty(w,'scrollY',{value:typeof x==='object'?x.top:y,writable:true,configurable:true});}});
 t.after(()=>dom.window.close());assert.deepEqual(errors,[]);
 const w=dom.window,d=w.document;
 const put=(input,value)=>{input.value=value;input.dispatchEvent(new w.Event('input',{bubbles:true}));};
 const save=async()=>{await d.querySelector('#familyForm').onsubmit(new w.Event('submit',{bubbles:true,cancelable:true}));await d.querySelector('#sendBtn').onclick();};
 return {db,w,d,put,save,errors,json};
}
function family(){return {rootFamily:'f',people:[{id:'a',name:'Test, Ana',birth:'oko 1970',notes:'Originalna napomena'},{id:'b',name:'Test, Marko'},{id:'c',name:'Test, Dijete'},{id:'p',name:'Drugi, Partner'},{id:'g',name:'Test, Unuče',death:'2020'}],families:[{id:'f',parents:['a','b'],children:['c'],notes:'Napomena porodice'},{id:'fc',parents:['c','p'],children:['g']}],original:{people:[]}};}
test('family navigation keeps map context and completion requires saved edits',async t=>{
 const {d,w,put,save,errors}=await fixture(t,family());const child=d.querySelector('#children > .child-card');
 assert.equal(d.querySelector('.branch-map-link').textContent,'Mapa cijele grane');assert.match(d.querySelector('.branch-completion summary').textContent,/Otvoren, bez izmjena/);
 child.querySelector('.review-actions button:nth-child(2)').click();assert.equal(d.querySelector('.review-root-name').textContent,'Dijete Test i Partner Drugi');assert.match(d.querySelector('.branch-map-link').href,/focus=c&returnFamily=fc/);
 const completion=d.querySelector('.branch-completion form');put(child.querySelector('[data-c=birthDate]'),'1990');let event=new w.Event('submit',{bubbles:true,cancelable:true});completion.dispatchEvent(event);assert.equal(event.defaultPrevented,true);
 put(d.querySelector('[name=submittedBy]'),'Rođak');assert.equal(completion.querySelector('[name=editor]').value,'Rođak');await save();assert.equal(completion.querySelector('[name=revision]').value,'1');assert.equal(completion.querySelector('[name=context]').value,'c');assert.equal(completion.querySelector('[name=family]').value,'fc');assert.match(d.querySelector('.branch-completion summary').textContent,/U toku/);assert.ok(child.classList.contains('review-family-open'));assert.deepEqual(errors,[]);
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
 assert.equal(form.querySelector('.sender-section').nextElementSibling.classList.contains('review-savebar'),true);
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
