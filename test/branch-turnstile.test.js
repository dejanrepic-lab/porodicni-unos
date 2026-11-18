const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const express=require('express');
const Database=require('better-sqlite3');
const {mountFamilyLinks}=require('../lib/family-links');
test('family links leave out the public form\'s Turnstile widget while the public form keeps it',async t=>{
 const db=new Database(':memory:'),app=express();mountFamilyLinks(app,{db,adminAuth:(req,res,next)=>next(),client:()=>{}});
 const json=JSON.stringify({rootFamily:'f',people:[{id:'a',name:'Test, Ana'},{id:'b',name:'Test, Marko'}],families:[{id:'f',parents:['a','b'],children:[]}],original:{people:[]}});
 db.prepare('INSERT INTO family_links(token,label,baseline,working,created,active) VALUES(?,?,?,?,?,1)').run('captcha','Test',json,json,'2026-01-01');
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.close();db.close();});
 const page=await (await fetch(`http://127.0.0.1:${server.address().port}/branch/captcha/form?person=a`)).text();
 assert.doesNotMatch(page,/<script[^>]*challenges\.cloudflare\.com/);assert.doesNotMatch(page,/<div id="cf-turnstile-widget"/);assert.match(page,/id="previewBox"/);assert.doesNotMatch(page,/public-form\.(css|js)|class="public-form"/);assert.match(page,/id="sendBtn"/);
 const publicForm=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 assert.match(publicForm,/challenges\.cloudflare\.com\/turnstile/);assert.match(publicForm,/id="cf-turnstile-widget"/);assert.match(publicForm,/href="\/public-form\.css"/);assert.match(publicForm,/src="\/public-form\.js"/);
});
