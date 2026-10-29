const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const Database=require('better-sqlite3');
const {scopeFor,applyForm}=require('../lib/branch-form');
const {compareBranch}=require('../lib/family-review');
const {mountFamilyLinks}=require('../lib/family-links');
const {branchPreview}=require('../lib/branch-preview');
function fixture(){return {rootFamily:'f',people:[{id:'a',name:'Test, Ana',grampsId:'I1',notes:'Stara napomena',events:['Birth: 1900']},{id:'b',name:'Test, Marko',grampsId:'I2',events:[]},{id:'c',name:'Test, Dijete',grampsId:'I3',notes:'Poznata priča',events:[]},{id:'s',name:'Druga, Partner',notes:'Partnerov zapis',events:[]},{id:'g',name:'Unuk',birth:'2000',death:'2020',notes:'Važan izvor',events:[]},{id:'other',name:'Drugi partner',events:[]}],families:[{id:'f',parents:['a','b'],children:['c'],events:['Brak']},{id:'cf',parents:['c','s'],children:['g'],relationship:'Brak',events:[]},{id:'otherf',parents:['c','other'],children:[],events:[]}],original:{people:[]}};}
test('prefills the original family form and saves the same identities without losing other families',()=>{
 const data=fixture(),payload=scopeFor(data,'a').payload;assert.equal(payload.father.firstName,'Ana');assert.equal(payload.mother.lastName,'Test');assert.equal(payload.children[0].spouse._id,'s');assert.equal(payload.children[0].children[0]._id,'g');
 const before=structuredClone(data),result=applyForm(data,'a','f',payload);assert.equal(data.people.length,before.people.length);assert.equal(data.families.length,before.families.length);assert.deepEqual(data.families.find(f=>f.id==='otherf'),before.families.find(f=>f.id==='otherf'));assert.equal(data.people.find(p=>p.id==='g').death,'2020');assert.equal(data.people.find(p=>p.id==='g').notes,'Važan izvor');assert.equal(data.people.find(p=>p.id==='a').notes,'Stara napomena');assert.equal(result.familyId,'f');assert.equal(compareBranch(before,data).hasChanges,false);
 delete payload.children[0].spouse.notes;payload.children[0].nickname='Mali';payload.children[0].spouse.maidenName='Staro';payload.primaryRelationship='Partnerstvo';payload.notes='Porodična napomena';applyForm(data,'a','f',payload);const diff=compareBranch(before,data);assert.ok(diff.changedPeople.some(x=>x.person.id==='c'));assert.ok(diff.changedPeople.some(x=>x.person.id==='s'));assert.ok(diff.changedFamilies.some(x=>x.family.id==='f'));assert.equal(data.people.find(p=>p.id==='s').notes,'Partnerov zapis');
});
test('trimmed imported name parts do not rename untouched people at any generation',()=>{
 const data=fixture(),parts={a:[' Ana ','Test'],b:['Milan ','Repić'],c:[' Dijete','Test '],s:['Partner  ',' Druga'],g:['Unuk\u00a0','Test']};
 data.original.people=Object.entries(parts).map(([id,[first,surname]])=>{data.people.find(p=>p.id===id).name=first+' '+surname;return {handle:id,primary_name:{first_name:first,surname_list:[{surname}]}};});
 const before=structuredClone(data),payload=scopeFor(data,'a').payload;
 function trim(value){for(const [key,item] of Object.entries(value))if(typeof item==='string')value[key]=item.trim();else if(item&&typeof item==='object')trim(item);}
 trim(payload);let saved=applyForm(data,'a','f',payload);assert.equal(compareBranch(before,data).hasChanges,false);
 for(const old of before.people)assert.equal(data.people.find(p=>p.id===old.id).name,old.name);
 saved.payload.children.push({firstName:'Novo',lastName:'Dijete',spouse:{firstName:'Novi',lastName:'Partner'},children:[{firstName:'Novo unuče',spouse:{},children:[]}]});
 saved=applyForm(data,'a','f',saved.payload);let preview=branchPreview(before,data,saved);assert.equal(preview.counts.peopleChanged,0);assert.equal(preview.counts.peopleAdded,3);assert.equal(preview.counts.familiesAdded,1);
 applyForm(data,'a','f',saved.payload);assert.equal(compareBranch(before,data).changedPeople.length,0);
 saved.payload.mother.firstName='Milan Jovan';saved=applyForm(data,'a','f',saved.payload);preview=branchPreview(before,data,saved);assert.equal(preview.counts.peopleChanged,1);const change=preview.groups.flatMap(g=>g.items).find(i=>i.kind==='changed-person');assert.equal(change.changes[0].before,'Milan  Repić');assert.equal(change.changes[0].after,'Repić, Milan Jovan');
});
test('adds children with their partners and grandchildren, then repeats a save without duplicates',()=>{
 const data=fixture(),payload=scopeFor(data,'a').payload;
 payload.children.push({firstName:'Novo',lastName:'Test',birthDate:'1980',notes:'Izvor',spouse:{firstName:'Partner',lastName:'Novi',relationship:'Brak'},children:[{name:'Novo unuče',birthDate:'2010',birthPlace:'Beč'}]});
 const saved=applyForm(data,'a','f',payload),count=data.people.length,families=data.families.length,newChild=saved.payload.children[1];assert.ok(newChild._id);assert.ok(newChild.spouse._id);assert.ok(newChild._family);assert.ok(newChild.children[0]._id);assert.equal(data.families.find(f=>f.id===newChild._family).children[0],newChild.children[0]._id);
 applyForm(data,'a','f',saved.payload);assert.equal(data.people.length,count);assert.equal(data.families.length,families);
});
test('removing a child card removes only that relation and preserves descendants and other unions',()=>{
 const data=fixture(),before=structuredClone(data),payload=scopeFor(data,'a').payload;payload.children=[];applyForm(data,'a','f',payload);assert.deepEqual(data.families.find(f=>f.id==='f').children,[]);assert.equal(data.people.length,before.people.length);assert.deepEqual(data.families.find(f=>f.id==='cf'),before.families.find(f=>f.id==='cf'));assert.equal(compareBranch(before,data).removedLinks[0].children[0],'c');
});
test('supports a person without a family and binds either partner as the selected root',()=>{
 const data=fixture();data.people.push({id:'alone',name:'Osoba',events:[]});let payload=scopeFor(data,'alone').payload;payload.mother={firstName:'Novi partner'};payload.children=[{firstName:'Novo dijete',spouse:{},children:[]}];let result=applyForm(data,'alone','',payload);assert.ok(result.familyId);assert.equal(data.families.find(f=>f.id===result.familyId).parents[0],'alone');
 payload=scopeFor(data,'b','f').payload;assert.equal(payload.father._id,'b');applyForm(data,'b','f',payload);assert.equal(data.families.find(f=>f.id==='f').parents[0],'b');
});
test('rejects tampered identity, cross-scope identity and nameless filled rows',()=>{
 let data=fixture(),payload=scopeFor(data,'a').payload;payload.father._id='b';assert.throws(()=>applyForm(data,'a','f',payload),/Identitet/);
 data=fixture();payload=scopeFor(data,'a').payload;payload.children[0]._id='other';assert.throws(()=>applyForm(data,'a','f',payload),/ne pripada/);
 data=fixture();payload=scopeFor(data,'a').payload;payload.children.push({birthDate:'2001',spouse:{},children:[]});assert.throws(()=>applyForm(data,'a','f',payload),/ime osobe/);
});
test('serves the original interface and saves branch JSON with CSRF and revision protection',async t=>{
 const db=new Database(':memory:');db.pragma('foreign_keys = ON');const app=express();mountFamilyLinks(app,{db,adminAuth:(req,res,next)=>next(),client:()=>{}});const json=JSON.stringify(fixture());db.prepare('INSERT INTO family_links(token,label,baseline,working,created,active) VALUES(?,?,?,?,?,1)').run('test-token','Test',json,json,'2026-01-01');const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.close();db.close();});const base=`http://127.0.0.1:${server.address().port}/branch/test-token`;
 const redirect=await fetch(base+'?person=a',{redirect:'manual'});assert.equal(redirect.status,302);assert.match(redirect.headers.get('location'),/\/form\?person=a/);
 const html=await (await fetch(base+'/form?person=a')).text();assert.match(html,/id="familyForm"/);assert.match(html,/Završi unos djece osnovne porodice/);assert.match(html,/function familyReport/);assert.match(html,/Supružnik \/ partner/);assert.match(html,/branch-form.js/);assert.match(html,/if\(!branchFormMode\)/);
 const boot=JSON.parse(html.match(/<script id="branch-boot" type="application\/json">([\s\S]*?)<\/script>/)[1]);boot.payload.submittedBy='Rođak';boot.payload.children[0].birthDate='1970';
 const post=body=>fetch(base+'/form-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const body={csrf:boot.csrf,revision:boot.revision,personId:boot.personId,familyId:boot.familyId,payload:boot.payload};assert.equal((await post({...body,csrf:'wrong'})).status,403);
 const response=await post(body);assert.equal(response.status,200);const saved=await response.json();assert.equal(saved.revision,1);assert.equal(saved.payload.children[0]._id,'c');assert.equal((await post(body)).status,409);
 const row=db.prepare('SELECT * FROM family_links').get();assert.equal(row.baseline,json);assert.equal(JSON.parse(row.working).people.find(p=>p.id==='c').birth,'1970');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM family_link_history').get().n,1);
 const invalid=await post({...body,revision:1,payload:{...boot.payload,father:{...boot.payload.father,_id:'not-in-link'}}});assert.equal(invalid.status,400);assert.equal(db.prepare('SELECT revision FROM family_links').get().revision,1);
 db.prepare('UPDATE family_links SET active=0').run();assert.equal((await fetch(base+'/form?person=a')).status,404);assert.equal((await post({...body,revision:1})).status,404);
});

test('creates an additional union explicitly without overwriting existing families',()=>{
 const data=fixture(),before=structuredClone(data.families),payload=scopeFor(data,'c','new').payload;assert.equal(payload.father._id,'c');assert.deepEqual(payload.children,[]);payload.mother={firstName:'Novi partner'};const saved=applyForm(data,'c','new',payload);assert.ok(saved.familyId);assert.notEqual(saved.familyId,'new');for(const old of before)assert.deepEqual(data.families.find(f=>f.id===old.id),old);assert.equal(data.families.length,before.length+1);
});
