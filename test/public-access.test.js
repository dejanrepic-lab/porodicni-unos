const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {spawn}=require('child_process');
test('the shared family password page explains a wrong password and serves a versioned form',async t=>{
 const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'porodicni-access-'));const port=23000+(process.pid%1000),base=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),DATA_DIR:dataDir,ADMIN_PASSWORD:'x',ADMIN_SESSION_SECRET:'s',FORM_ACCESS_PASSWORD:'porodica-šifra'},stdio:['ignore','pipe','pipe']});
 t.after(()=>{child.kill('SIGTERM');fs.rmSync(dataDir,{recursive:true,force:true});});
 for(let i=0;i<50;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const gate=await fetch(base+'/',{redirect:'manual'});assert.equal(gate.status,302);
 const pageHtml=await (await fetch(base+'/access')).text();assert.match(pageHtml,/Pristupna šifra/);assert.match(pageHtml,/name="password"/);
 const post=password=>fetch(base+'/access',{method:'POST',redirect:'manual',headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password,next:'/'})});
 // Same number of letters as the real password but more bytes: answered as wrong, not as a server error.
 const wrong=await post('porodica-šifrč');assert.equal(wrong.status,401);assert.match(await wrong.text(),/Pristupna šifra nije ispravna/);
 const ok=await post('porodica-šifra');assert.equal(ok.status,302);const cookie=ok.headers.get('set-cookie').split(';')[0];
 const form=await (await fetch(base+'/',{headers:{cookie}})).text();
 assert.match(form,/<body class="public-form">/);assert.match(form,/href="\/public-form\.css\?v=[0-9a-f]{16}"/);assert.match(form,/src="\/public-form\.js\?v=[0-9a-f]{16}"/);assert.match(form,/href="\/app\.css\?v=[0-9a-f]{16}"/);
});
