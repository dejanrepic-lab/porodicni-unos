const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {adminHead,loginPage}=require('../lib/admin-chrome');
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');
test('the public form and the admin are separate installable apps with launcher-safe icons',()=>{
 const pub=JSON.parse(read('public/manifest.webmanifest')),admin=JSON.parse(read('public/admin.webmanifest'));
 assert.equal(pub.start_url,'/');assert.equal(admin.start_url,'/admin');assert.equal(admin.scope,'/admin');assert.notEqual(admin.id,pub.id);
 for(const m of [pub,admin]){
  assert.equal(m.display,'standalone');
  // Separate "any" and "maskable" icons: a combined purpose lets Android crop the "any" artwork.
  assert.ok(m.icons.every(i=>i.purpose==='any'||i.purpose==='maskable'));
  assert.ok(m.icons.some(i=>i.purpose==='any'&&i.sizes==='192x192'));assert.ok(m.icons.some(i=>i.purpose==='any'&&i.sizes==='512x512'));assert.ok(m.icons.some(i=>i.purpose==='maskable'&&i.sizes==='512x512'));
  assert.ok(m.icons.every(i=>/\?v=\d+$/.test(i.src)));
 }
 // Launcher icons are built from artwork without transparent corners or a frame of its own.
 const full=read('public/icons/porodicni-unos-full.svg');assert.match(full,/<rect width="512" height="512" fill="url\(#bg\)"\/>/);assert.doesNotMatch(full,/rx=/);
 const maskable=read('public/icons/porodicni-unos-maskable.svg');assert.match(maskable,/<rect width="512" height="512" fill="url\(#bg\)"\/>/);assert.match(maskable,/scale\(0\.8\d?\)/);
 const docker=read('Dockerfile');assert.match(docker,/porodicni-unos-maskable\.svg -o icon-maskable-512\.png/);for(const icon of ['icon-192.png','icon-512.png','apple-touch-icon.png'])assert.match(docker,new RegExp('porodicni-unos-full\\.svg -o '+icon.replace('.','\\.')));
 assert.doesNotMatch(docker,/prepare-pwa/);
 for(const html of [adminHead,loginPage()]){assert.match(html,/rel="manifest" href="\/admin\.webmanifest"/);assert.match(html,/apple-touch-icon\.png\?v=\d/);assert.match(html,/serviceWorker\.register\('\/admin-sw\.js',\{scope:'\/admin'\}\)/);}
 const index=read('public/index.html');assert.match(index,/rel="manifest" href="\/manifest\.webmanifest"/);assert.match(index,/apple-touch-icon\.png\?v=\d/);
 // The admin worker caches nothing: it only answers navigations that fail without a network.
 const worker=read('public/admin-sw.js');assert.doesNotMatch(worker,/caches\./);assert.match(worker,/mode !== 'navigate'/);
});
