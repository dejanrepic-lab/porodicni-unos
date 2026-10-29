const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const Database=require('better-sqlite3');
const {relationshipText,restoreFamilyRelationships}=require('../lib/family-relationship');
const {mountFamilyLinks,prepareBranch}=require('../lib/family-links');
const {compareBranch}=require('../lib/family-review');
test('reads Gramps relationship codes, API objects, tuples and custom values without guessing',()=>{
 for(const [raw,label] of [[0,'Brak'],[1,'Vanbračna zajednica'],[2,'Registrovano partnerstvo'],[3,'Nepoznato'],[{_class:'FamilyRelType',value:0,string:''},'Brak'],[[4,'Posebna veza'],'Posebna veza'],[{value:4,string:'Veza po običaju'},'Veza po običaju'],['Married','Brak'],['Unmarried','Vanbračna zajednica'],['Civil Union','Registrovano partnerstvo'],['Unknown','Nepoznato'],[undefined,''],[null,''],[99,'']])assert.equal(relationshipText(raw),label);
});
test('imports each descendant family relationship and retains the original Gramps snapshot',()=>{
 const data={people:[{handle:'p',primary_name:{first_name:'Ana'}},{handle:'c',primary_name:{first_name:'Dijete'}},{handle:'s',primary_name:{first_name:'Partner'}}],families:[{handle:'f',father_handle:'p',type:{value:0,string:''},child_ref_list:[{ref:'c'}]},{handle:'cf',father_handle:'c',mother_handle:'s',type:[4,'Veza po običaju'],child_ref_list:[]}],events:[],places:[],notes:[]},original=JSON.stringify(data);
 const branch=prepareBranch(data,'f');assert.equal(branch.families.find(f=>f.id==='f').relationship,'Brak');assert.equal(branch.families.find(f=>f.id==='cf').relationship,'Veza po običaju');assert.equal(JSON.stringify(data),original);
 delete data.families[0].type;data.families[0].event_ref_list=[{ref:'wedding'}];data.events=[{handle:'wedding',type:'Marriage'}];assert.equal(prepareBranch(data,'f').families[0].relationship,'');
});
function database(t){const db=new Database(':memory:');mountFamilyLinks(express(),{db,adminAuth:(r,s,n)=>n(),client:()=>{}});t.after(()=>db.close());return db;}
function graph(){return {rootFamily:'f',people:[{id:'p',name:'Ana Test',notes:'Sačuvana napomena'}],families:[{id:'f',parents:['p'],children:[],events:[]}],original:{families:[{handle:'f',type:{value:0,string:''}}]}};}
function insert(db,token,baseline,working,previous){
 const id=db.prepare('INSERT INTO family_links(token,label,baseline,working,created,updated,revision) VALUES(?,?,?,?,?,?,2)').run(token,'Test',JSON.stringify(baseline),JSON.stringify(working),'created','updated').lastInsertRowid;
 if(previous)db.prepare('INSERT INTO family_link_history(link_id,previous,changed_by,created) VALUES(?,?,?,?)').run(id,JSON.stringify(previous),'Rođak','history');
 return id;
}
test('restores omitted relationships consistently across old snapshots without new edits or revisions',t=>{
 const db=database(t),base=graph(),working=structuredClone(base);working.families[0].relationship='';
 const id=insert(db,'restore',base,working,working);db.prepare('INSERT INTO family_link_review_snapshots(link_id,revision,snapshot) VALUES(?,?,?)').run(id,2,JSON.stringify(working));db.prepare('INSERT INTO family_link_progress(link_id,reviewed_revision,reviewed_at) VALUES(?,?,?)').run(id,2,'reviewed');
 mountFamilyLinks(express(),{db,adminAuth:(r,s,n)=>n(),client:()=>{}});const row=db.prepare('SELECT * FROM family_links WHERE id=?').get(id),updatedBase=JSON.parse(row.baseline),updatedWorking=JSON.parse(row.working);
 assert.equal(updatedBase.families[0].relationship,'Brak');assert.equal(updatedWorking.families[0].relationship,'Brak');assert.equal(compareBranch(updatedBase,updatedWorking).hasChanges,false);assert.deepEqual(updatedWorking.people,working.people);assert.deepEqual(updatedBase.original,base.original);
 assert.equal(JSON.parse(db.prepare('SELECT previous FROM family_link_history').get().previous).families[0].relationship,'Brak');assert.equal(JSON.parse(db.prepare('SELECT snapshot FROM family_link_review_snapshots').get().snapshot).families[0].relationship,'Brak');assert.equal(row.revision,2);assert.equal(row.updated,'updated');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM family_link_history').get().n,1);assert.equal(db.prepare('SELECT reviewed_revision FROM family_link_progress').get().reviewed_revision,2);
 const snapshot=JSON.stringify(row);restoreFamilyRelationships(db);assert.equal(JSON.stringify(db.prepare('SELECT * FROM family_links WHERE id=?').get(id)),snapshot);
});
test('restoration preserves explicit edits, intentional clears and imports without a known relationship',t=>{
 const db=database(t),base=graph(),edited=structuredClone(base);edited.families[0].relationship='Partnerstvo';const first=insert(db,'edited',base,edited,base);
 const cleared=structuredClone(base);cleared.families[0].relationship='';const second=insert(db,'cleared',base,cleared,edited);
 const known=structuredClone(base);known.families[0].relationship='Brak';const third=insert(db,'known',known,cleared,known);
 const unknown=graph();delete unknown.original.families[0].type;const fourth=insert(db,'missing',unknown,unknown);
 restoreFamilyRelationships(db);
 const read=id=>JSON.parse(db.prepare('SELECT working FROM family_links WHERE id=?').get(id).working).families[0];
 assert.equal(read(first).relationship,'Partnerstvo');assert.equal(read(second).relationship,'');assert.equal(read(third).relationship,'');assert.equal(Object.hasOwn(read(fourth),'relationship'),false);
});
