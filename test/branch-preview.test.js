const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const Database=require('better-sqlite3');
const {scopeFor,applyForm}=require('../lib/branch-form');
const {branchPreview}=require('../lib/branch-preview');
const {mountFamilyLinks}=require('../lib/family-links');
function fixture(){return {rootFamily:'f',people:[{id:'a',name:'Test, Ana',birth:'1950',notes:'Poznati izvor'},{id:'b',name:'Test, Marko'},{id:'c',name:'Test, Dijete'},{id:'p',name:'Drugi, Partner'},{id:'g',name:'Test, Unuče'}],families:[{id:'f',parents:['a','b'],children:['c']},{id:'fc',parents:['c','p'],children:['g']}],original:{people:[]}};}
test('preview groups precise differences and new people by their family without repeating unchanged fields',()=>{
 const before=fixture(),after=structuredClone(before),payload=scopeFor(before,'a').payload;payload.father.birthDate='1952';payload.children[0].spouse.birthPlace='Beč';payload.children[0].children.push({firstName:'Novo',lastName:'Unuče',spouse:{},children:[]});
 const accepted=applyForm(after,'a','f',payload),preview=branchPreview(before,after,accepted);
 assert.equal(preview.counts.peopleChanged,2);assert.equal(preview.counts.peopleAdded,1);assert.equal(preview.groups.length,2);
 const root=preview.groups.find(g=>g.id==='f'),desc=preview.groups.find(g=>g.id==='fc');assert.equal(root.items.length,1);assert.deepEqual(root.items[0].changes,[{label:'Datum rođenja',before:'1950',after:'1952'}]);assert.deepEqual(root.items[0].target,{role:'father',path:[],field:'birthDate'});
 assert.ok(desc.items.some(i=>i.kind==='new-person'&&i.name==='Novo Unuče'));assert.deepEqual(desc.items.find(i=>i.kind==='changed-person').target,{role:'partner',path:[0],field:'birthPlace'});assert.deepEqual(desc.items.find(i=>i.kind==='family').addedChildren,['Novo Unuče']);assert.doesNotMatch(JSON.stringify(preview),/Poznati izvor/);
});
test('removing a child is described as detaching a family link, and unchanged forms have no differences',()=>{
 const before=fixture(),after=structuredClone(before),payload=scopeFor(before,'a').payload;let result=applyForm(after,'a','f',payload);assert.equal(branchPreview(before,after,result).hasChanges,false);
 payload.children=[];result=applyForm(after,'a','f',payload);const preview=branchPreview(before,after,result);assert.equal(preview.counts.linksRemoved,1);assert.equal(preview.counts.peopleChanged,0);assert.equal(after.people.length,before.people.length);assert.deepEqual(preview.groups[0].items[0].removedChildren,['Dijete Test']);
});
test('preview uses save validation and does not write history, working data or revisions',async t=>{
 const db=new Database(':memory:'),app=express();mountFamilyLinks(app,{db,adminAuth:(r,s,n)=>n(),client:()=>{}});const json=JSON.stringify(fixture());db.prepare('INSERT INTO family_links(token,label,baseline,working,created,active) VALUES(?,?,?,?,?,1)').run('preview','Test',json,json,'2026-01-01');const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.close();db.close();});const base=`http://127.0.0.1:${server.address().port}/branch/preview`;
 const html=await (await fetch(base+'/form?person=a')).text(),boot=JSON.parse(html.match(/<script id="branch-boot" type="application\/json">([\s\S]*?)<\/script>/)[1]);boot.payload.submittedBy='Rođak';boot.payload.father.birthDate='1952';const body={csrf:boot.csrf,revision:0,personId:'a',familyId:'f',payload:boot.payload};
 const post=data=>fetch(base+'/form-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
 assert.equal((await post({...body,csrf:'wrong'})).status,403);assert.equal((await post({...body,revision:100})).status,409);
 const response=await post(body);assert.equal(response.status,200);const preview=await response.json();assert.equal(preview.counts.peopleChanged,1);assert.equal(preview.groups[0].items[0].changes[0].after,'1952');const row=db.prepare('SELECT * FROM family_links').get();assert.equal(row.working,json);assert.equal(row.baseline,json);assert.equal(row.revision,0);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM family_link_history').get().n,0);
 assert.equal((await post({...body,payload:{...boot.payload,children:[{birthDate:'2000',spouse:{},children:[]}]}})).status,400);db.prepare('UPDATE family_links SET active=0').run();assert.equal((await post(body)).status,404);
});
