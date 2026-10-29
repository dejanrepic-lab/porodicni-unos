const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const Database=require('better-sqlite3');
const {mountFamilyLinks}=require('../lib/family-links');
test('shared links open the family editor and use a separate consistently named navigation map',async t=>{
 const db=new Database(':memory:'),app=express();mountFamilyLinks(app,{db,adminAuth:(r,s,n)=>n(),client:()=>{}});
 const data={rootFamily:'root',people:[{id:'p',name:'Test, Ana'},{id:'c',name:'Test, Marko'},{id:'u',name:'Druga, Ivana'}],families:[{id:'root',parents:['p'],children:['c']},{id:'child',parents:['c','u'],children:[]},{id:'second',parents:['c'],children:[]}],original:{people:[]}};
 const json=JSON.stringify(data);db.prepare('INSERT INTO family_links(token,label,baseline,working,created,active) VALUES(?,?,?,?,?,1)').run('entry','Test',json,json,'2026-01-01');
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.close();db.close();});const base=`http://127.0.0.1:${server.address().port}/branch/entry`;
 let response=await fetch(base,{redirect:'manual'});assert.equal(response.status,302);assert.equal(response.headers.get('location'),'/branch/entry/form?person=p&family=root');
 const form=await (await fetch(base+'/form?person=c&family=second')).text(),boot=JSON.parse(form.match(/<script id="branch-boot" type="application\/json">([\s\S]*?)<\/script>/)[1]);assert.equal(boot.isStartFamily,false);assert.match(boot.parentFamily.url,/person=p&family=root/);assert.match(boot.progress,/Otvoren/);
 const map=await (await fetch(base+'?map=1&focus=c&returnFamily=second')).text();assert.match(map,/href="\/app.css\?v=[a-f0-9]{16}"/);assert.match(map,/Mapa porodične grane/);assert.match(map,/Marko Test/);assert.doesNotMatch(map,/Test, Marko/);assert.match(map,/\/form\?person=c&amp;family=second/);assert.match(map,/\/form\?person=u/);assert.doesNotMatch(map,/action="[^\"]+\/person"/);
 const search=await (await fetch(base+'?q=Ivana')).text();assert.match(search,/name="map" value="1"/);assert.match(search,/Ivana Druga/);
 response=await fetch(base+'/completion',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf:boot.csrf,revision:'0',editor:'Rođak',context:'c',family:'second'})});assert.equal(response.status,302);assert.match(response.headers.get('location'),/person=c&family=second/);
 const reopened=await (await fetch(base+'/form?person=c&family=second')).text(),next=JSON.parse(reopened.match(/<script id="branch-boot" type="application\/json">([\s\S]*?)<\/script>/)[1]);assert.match(next.progress,/Završeno/);assert.equal(db.prepare('SELECT working FROM family_links').get().working,json);assert.equal(db.prepare('SELECT revision FROM family_links').get().revision,0);
 db.prepare('UPDATE family_links SET active=0').run();assert.equal((await fetch(base,{redirect:'manual'})).status,404);assert.equal((await fetch(base+'?map=1')).status,404);
});
