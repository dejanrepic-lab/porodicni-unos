const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const Database=require('better-sqlite3');
const {mountFamilyLinks}=require('../lib/family-links');

test('family entry keeps children and their details in the selected branch',async t=>{
 const db=new Database(':memory:');db.pragma('foreign_keys = ON');
 const app=express();mountFamilyLinks(app,{db,adminAuth:(req,res,next)=>next(),client:()=>{}});
 const snapshot={rootFamily:'root',people:[{id:'p',grampsId:'I1',name:'Ana',birth:'1900',events:[]},{id:'c',grampsId:'I2',name:'Marko',events:[]}],families:[{id:'root',parents:['p'],children:['c'],events:[]}],original:{people:[]}};
 const data=JSON.stringify(snapshot),token='abc123';db.prepare('INSERT INTO family_links(token,label,baseline,working,created,active) VALUES(?,?,?,?,?,1)').run(token,'Test',data,data,'2026-01-01');
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.close();db.close();});
 const base=`http://127.0.0.1:${server.address().port}/branch/${token}`,html=await (await fetch(base+'?person=c')).text();
 const vm=require('node:vm'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1],handlers={},writes={};
 const node={dataset:{familyId:'root'},open:false},form={addEventListener(name,fn){handlers[name]=fn;}};let scrollTo;
 const ctx={location:{pathname:'/branch/abc123',search:'?saved=1'},URLSearchParams,Number,Array,JSON,window:{scrollY:240,scrollTo:(x,y)=>{scrollTo=y;}},requestAnimationFrame:fn=>fn(),sessionStorage:{getItem(){return JSON.stringify({open:['root'],scroll:180});},setItem(k,v){writes[k]=v;}},document:{querySelectorAll(selector){return selector==='[data-family-id]'?[node]:selector==='form[method=post]'?[form]:selector==='[data-family-id][open]'&&node.open?[node]:[];}}};
 vm.runInNewContext(script,ctx);assert.equal(node.open,true);assert.equal(scrollTo,180);handlers.submit();assert.deepEqual(JSON.parse(writes['branch-view:/branch/abc123']),{open:['root'],scroll:240});
 const csrf=html.match(/name="csrf" value="([^"]+)"/)[1];assert.match(html,/add-family-child/);assert.match(html,/childBirthPlace/);
 const body=new URLSearchParams({csrf,revision:'0',person:'c',editor:'Test',partnerName:'Ivana',partnerBirth:'1985'});
 for(const [name,birth,place] of [['Prvo','2010','Beč'],['Drugo','2013','Salzburg']]){body.append('childName',name);body.append('childBirth',birth);body.append('childBirthPlace',place);body.append('childDeath','');body.append('childDeathPlace','');body.append('childNotes','');}
 const saved=await fetch(base+'/family',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});assert.equal(saved.status,302);assert.match(saved.headers.get('location'),/person=c&family=.*#person-families/);
 const row=db.prepare('SELECT baseline,working,revision FROM family_links WHERE token=?').get(token),result=JSON.parse(row.working);assert.equal(row.baseline,data);assert.equal(row.revision,1);
 const family=result.families.find(f=>f.id!=='root');assert.equal(family.parents[0],'c');assert.equal(result.people.find(p=>p.id===family.parents[1]).birth,'1985');
 assert.deepEqual(family.children.map(id=>{const p=result.people.find(p=>p.id===id);return [p.name,p.birth,p.birthPlace];}),[['Prvo','2010','Beč'],['Drugo','2013','Salzburg']]);
 const childPage=await (await fetch(base+'?person='+family.children[0])).text();assert.match(childPage,/Dodaj partnera \/ novu porodicu/);assert.match(childPage,/value="2010"/);
 const invalid=new URLSearchParams({csrf,revision:'1',person:'c',editor:'Test',childName:'',childBirth:'2000'});assert.equal((await fetch(base+'/family',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:invalid})).status,400);assert.equal(db.prepare('SELECT revision FROM family_links WHERE token=?').get(token).revision,1);
});
