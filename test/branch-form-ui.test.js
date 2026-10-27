const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const express=require('express');
const Database=require('better-sqlite3');
const {JSDOM,VirtualConsole}=require('jsdom');
const {mountFamilyLinks}=require('../lib/family-links');

test('the original cards, preview and save edit a branch without reloading or duplicating people',async t=>{
 const db=new Database(':memory:'),app=express();mountFamilyLinks(app,{db,adminAuth:(req,res,next)=>next(),client:()=>{}});
 const initial={rootFamily:'f',people:[{id:'a',name:'Test, Ana',notes:'Važna napomena',events:[]},{id:'b',name:'Test, Marko',events:[]},{id:'c',name:'Test, Dijete',notes:'Napomena djeteta',events:[]}],families:[{id:'f',parents:['a','b'],children:['c'],events:[]}],original:{people:[]}};
 const json=JSON.stringify(initial);db.prepare('INSERT INTO family_links(token,label,baseline,working,created,active) VALUES(?,?,?,?,?,1)').run('ui','Test',json,json,'2026-01-01');
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.close();db.close();});
 const origin=`http://127.0.0.1:${server.address().port}`,url=origin+'/branch/ui/form?person=a';
 const source=await (await fetch(url)).text(),adapter=fs.readFileSync(path.join(__dirname,'../public/branch-form.js'),'utf8'),errors=[];
 const console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(source.replace('<script src="/branch-form.js"></script>',()=>`<script>${adapter}</script>`),{url,runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse(window){
  window.fetch=(url,options)=>fetch(new URL(url,origin),options);
  window.HTMLElement.prototype.scrollIntoView=function(){};
  window.scrollTo=(x,y)=>{Object.defineProperty(window,'scrollY',{value:typeof x==='object'?x.top:y,writable:true,configurable:true});};
 }});t.after(()=>dom.window.close());const {document,Event}=dom.window;
 assert.deepEqual(errors,[]);assert.equal(document.querySelector('[name=father_firstName]').value,'Ana');assert.equal(document.querySelector('[name=father_notes]').value,'Važna napomena');assert.equal(document.querySelector('[data-c=personNotes]').value,'Napomena djeteta');assert.equal(document.querySelector('.choice').hidden,true);assert.equal(dom.window.getComputedStyle(document.querySelector('.choice')).display,'none');
 const put=(selector,value)=>{const e=document.querySelector(selector);e.value=value;e.dispatchEvent(new Event('input',{bubbles:true}));};
 put('[name=submittedBy]','Rođak');put('[data-s=firstName]','Partner');put('[data-s=lastName]','Novi');document.querySelector('.add-grandchild').click();put('[data-g=name]','Unuče');put('[data-g=birthDate]','2020');
 document.querySelector('#addChild').click();const cards=document.querySelectorAll('.child-card');assert.equal(cards.length,2);cards[1].querySelector('[data-c=firstName]').value='Drugo';cards[1].querySelector('[data-c=lastName]').value='Test';
 dom.window.scrollTo(0,740);document.querySelector('#familyForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));assert.equal(document.querySelector('#previewBox').style.display,'block');assert.match(document.querySelector('#result').textContent,/Partner/);assert.match(document.querySelector('#result').textContent,/Unuče/);assert.match(document.querySelector('#result').textContent,/Važna napomena/);
 await document.querySelector('#sendBtn').onclick();assert.deepEqual(errors,[]);assert.equal(document.querySelector('#previewBox').style.display,'none');assert.equal(dom.window.scrollY,740);assert.equal(dom.window.location.href,url);
 let row=db.prepare('SELECT * FROM family_links').get(),saved=JSON.parse(row.working);assert.equal(row.revision,1);assert.equal(saved.people.length,6);assert.equal(saved.people.find(p=>p.id==='c').notes,'Napomena djeteta');assert.equal(saved.people.find(p=>p.id==='a').notes,'Važna napomena');assert.equal(row.baseline,json);assert.ok(document.querySelector('.branch-continue').href.includes('person=c'));
 const count=saved.people.length;document.querySelector('#familyForm').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await document.querySelector('#sendBtn').onclick();row=db.prepare('SELECT * FROM family_links').get();assert.equal(row.revision,2);assert.equal(JSON.parse(row.working).people.length,count);assert.deepEqual(errors,[]);
});

test('the standalone original form still opens and switches to individual entry',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8'),errors=[],console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(source,{url:'http://localhost/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse(window){window.HTMLElement.prototype.scrollIntoView=function(){};window.scrollTo=()=>{};}});
 try{const document=dom.window.document;assert.deepEqual(errors,[]);assert.equal(document.querySelectorAll('#children > .child-card').length,1);document.querySelector('#personBtn').click();assert.equal(document.querySelector('#personForm').style.display,'block');assert.equal(document.querySelector('#familyForm').style.display,'none');assert.equal(document.querySelector('#branch-boot'),null);}finally{dom.window.close();}
});
