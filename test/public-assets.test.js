const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const express=require('express');
const Database=require('better-sqlite3');
const {createAssetVersioner}=require('../lib/public-assets');
const {mountFamilyLinks}=require('../lib/family-links');

test('a new application build changes only the URLs of modified assets',t=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'family-assets-'));
 t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 fs.writeFileSync(path.join(directory,'review.js'),'old review');
 fs.writeFileSync(path.join(directory,'app.css'),'same styles');
 const html='<script src="/review.js"></script><link href="/app.css?v=old">';
 const before=createAssetVersioner(directory)(html);
 assert.notEqual(before,html);
 assert.equal(createAssetVersioner(directory)(html),before);
 assert.equal(createAssetVersioner(directory)(before),before);
 fs.writeFileSync(path.join(directory,'review.js'),'new review with local relationship row');
 const after=createAssetVersioner(directory)(html);
 assert.notEqual(after.match(/src="([^"]+)"/)[1],before.match(/src="([^"]+)"/)[1]);
 assert.equal(after.match(/href="([^"]+)"/)[1],before.match(/href="([^"]+)"/)[1]);
 const unrelated='<a href="/branch/private">Branch</a><script src="https://example.org/app.js"></script><img src="/image.png"><script src="/missing.js"></script>';
 assert.equal(createAssetVersioner(directory)(unrelated),unrelated);
});

test('uncached family pages load versioned scripts and styles even when the old script URL is stale',async t=>{
 const db=new Database(':memory:'),app=express();
 mountFamilyLinks(app,{db,adminAuth:(req,res,next)=>next(),client:()=>{}});
 // Reproduce a proxy/browser cache containing the previous script at its old URL.
 app.get('/branch-review.js',(req,res,next)=>{
  if(req.query.v)return next();
  res.set('Cache-Control','public, max-age=14400').type('js').send('old cached script');
 });
 const directory=path.join(__dirname,'../public');
 app.use(express.static(directory));
 const data={rootFamily:'f',people:[{id:'a',name:'Test, Ana'}],families:[{id:'f',parents:['a'],children:[],relationship:'Brak'}],original:{people:[]}};
 const json=JSON.stringify(data);
 db.prepare('INSERT INTO family_links(token,label,baseline,working,created,active) VALUES(?,?,?,?,?,1)').run('cache-test','Test',json,json,'2026-01-01');
 const server=app.listen(0,'127.0.0.1');
 await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>{server.close();db.close();});
 const origin='http://127.0.0.1:'+server.address().port;
 assert.equal(await (await fetch(origin+'/branch-review.js')).text(),'old cached script');
 for(const url of ['/branch/cache-test/form?person=a','/branch/cache-test?map=1']){
  const response=await fetch(origin+url),html=await response.text();
  assert.equal(response.headers.get('cache-control'),'no-store');
  const assets=Array.from(html.matchAll(/\b(?:src|href)="(\/[^"]+\.(?:css|js)(?:\?[^"]*)?)"/g),match=>match[1]);
  assert.equal(assets.length,url.includes('/form?')?7:2);
  for(const asset of assets){
   const parsed=new URL(asset,origin);
   const expected=fs.readFileSync(path.join(directory,parsed.pathname.slice(1)));
   assert.equal(parsed.searchParams.get('v'),crypto.createHash('sha256').update(expected).digest('hex').slice(0,16));
   assert.equal(await (await fetch(origin+asset)).text(),expected.toString());
  }
 }
 assert.equal(db.prepare('SELECT working FROM family_links').get().working,json);
});
