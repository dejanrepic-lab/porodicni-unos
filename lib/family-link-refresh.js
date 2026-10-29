const crypto=require('crypto');
function mountRefresh(app,{db,adminAuth,parse,postGuard,adminGuard,csrf,hidden,esc,page,client,prepareBranch,personName}){
 if(!db.prepare('PRAGMA table_info(family_links)').all().some(c=>c.name==='locked'))db.exec('ALTER TABLE family_links ADD COLUMN locked INTEGER NOT NULL DEFAULT 0');
 if(!db.prepare('PRAGMA table_info(family_links)').all().some(c=>c.name==='refreshed_at'))db.exec('ALTER TABLE family_links ADD COLUMN refreshed_at TEXT');
 db.exec('CREATE TABLE IF NOT EXISTS family_link_refresh_drafts(link_id INTEGER PRIMARY KEY REFERENCES family_links(id) ON DELETE CASCADE, nonce TEXT NOT NULL, revision INTEGER NOT NULL, snapshot TEXT NOT NULL); CREATE TABLE IF NOT EXISTS family_link_archives(id INTEGER PRIMARY KEY,link_id INTEGER NOT NULL REFERENCES family_links(id) ON DELETE CASCADE,created TEXT NOT NULL,revision INTEGER NOT NULL,content TEXT NOT NULL)');
 const get=id=>db.prepare('SELECT * FROM family_links WHERE id=?').get(id);
 const url=id=>'/admin/family-links/'+id;
 const checked=req=>{
  const r=get(req.params.id);if(!r)throw Error('Link nije pronađen.');
  if(String(r.revision)!==String(req.body.revision))throw Error('Link je promijenjen. Otvori pregled ponovo.');
  return r;
 };
 const fail=(res,e)=>res.status(409).send(page('Podaci nisu zamijenjeni','<p>'+esc(e.message)+'</p><p>Postojeći podaci i zaključavanje ostaju nepromijenjeni. Vrati se na pregled linka.</p>'));
 function controls(r){
  const archives=db.prepare('SELECT id,created,revision FROM family_link_archives WHERE link_id=? ORDER BY id DESC').all(r.id);
  return '<section id="gramps-refresh"><h2>Usklađivanje s Grampsom</h2>'+(r.refreshed_at?'<p>Posljednja potvrđena zamjena iz Grampsa: '+esc(new Date(r.refreshed_at).toLocaleString('hr-HR',{timeZone:process.env.TZ||'Europe/Vienna'}))+'</p>':'')+'<p><b>'+ (r.locked?'Zaključan za dopune':'Otvoren za dopune')+'</b></p><p>Zaključaj link prije prenosa dopuna u Gramps. Zatim pripremi novi uvoz, pregledaj ga i zamijeni podatke. Adresa linka ostaje ista.</p><form method="post" action="'+url(r.id)+'/lock">'+hidden('csrf',csrf)+hidden('revision',r.revision)+hidden('locked',r.locked?'0':'1')+'<button>'+(r.locked?'Otključaj za nove dopune':'Zaključaj za prenos u Gramps')+'</button></form>'+(r.locked?'<a class="btn" href="'+url(r.id)+'/refresh">Pripremi zamjenu iz Grampsa</a>':'')+(archives.length?'<h3>Arhive prije zamjene</h3><p>Prethodne dopune, početna kopija i istorija ostaju u arhivi.</p>'+archives.map(a=>'<p><a href="'+url(r.id)+'/archives/'+a.id+'">Preuzmi arhivu · '+esc(a.created)+' · revizija '+a.revision+'</a></p>').join(''):'')+'</section>';
 }
 app.post('/admin/family-links/:id/lock',adminAuth,parse,postGuard,adminGuard,(req,res)=>{
  try{const r=checked(req);if(!['0','1'].includes(req.body.locked))throw Error('Neispravno zaključavanje.');
   db.transaction(()=>{const change=db.prepare('UPDATE family_links SET locked=?,revision=revision+1 WHERE id=? AND revision=?').run(Number(req.body.locked),r.id,r.revision);if(change.changes!==1)throw Error('Link je promijenjen.');db.prepare('DELETE FROM family_link_refresh_drafts WHERE link_id=?').run(r.id);})();res.redirect(url(r.id)+'#gramps-refresh');
  }catch(e){fail(res,e);}
 });
 app.get('/admin/family-links/:id/refresh',adminAuth,async(req,res)=>{
  try{const r=get(req.params.id);if(!r||!r.locked)throw Error('Prvo zaključaj link za dopune.');const data=await client().snapshot(),root=JSON.parse(r.baseline).rootFamily;
   const options=data.families.map(f=>'<option value="'+esc(f.handle)+'" '+(f.handle===root?'selected':'')+'>'+esc([f.father_handle,f.mother_handle].filter(Boolean).map(id=>personName(data.people.find(p=>p.handle===id))).join(' i ')||f.gramps_id||f.handle)+'</option>').join('');
   res.send(page('Novi uvoz za postojeći link','<a href="'+url(r.id)+'">← Nazad na link</a><p>Provjeri početnu porodicu. Uvoze se ona i svi njeni potomci, prema trenutnom Grampsu.</p>'+(!data.families.some(f=>f.handle===root)?'<p role="alert">Prethodna početna porodica nije pronađena. Izaberi odgovarajuću porodicu.</p>':'')+'<form method="post" action="'+url(r.id)+'/refresh/prepare">'+hidden('csrf',csrf)+hidden('revision',r.revision)+'<label>Početna porodica<select name="family" required><option value="">Odaberi porodicu</option>'+options+'</select></label><button>Uvezi za pregled</button></form>'));
  }catch(e){fail(res,e);}
 });
 app.post('/admin/family-links/:id/refresh/prepare',adminAuth,parse,postGuard,adminGuard,async(req,res)=>{
  try{const r=checked(req);if(!r.locked)throw Error('Prvo zaključaj link.');db.prepare('DELETE FROM family_link_refresh_drafts WHERE link_id=?').run(r.id);const data=await client().snapshot(),branch=prepareBranch(data,String(req.body.family||'')),nonce=crypto.randomBytes(24).toString('hex');
   db.transaction(()=>{const now=get(r.id);if(!now||!now.locked||now.revision!==r.revision)throw Error('Link je promijenjen tokom uvoza. Ponovi pripremu.');db.prepare('INSERT INTO family_link_refresh_drafts(link_id,nonce,revision,snapshot) VALUES(?,?,?,?) ON CONFLICT(link_id) DO UPDATE SET nonce=excluded.nonce,revision=excluded.revision,snapshot=excluded.snapshot').run(r.id,nonce,r.revision,JSON.stringify(branch));})();
   res.redirect(url(r.id)+'/refresh/preview');
  }catch(e){fail(res,e);}
 });
 app.get('/admin/family-links/:id/refresh/preview',adminAuth,(req,res)=>{
  const r=get(req.params.id),draft=r&&db.prepare('SELECT * FROM family_link_refresh_drafts WHERE link_id=?').get(r.id);
  if(!r?.locked||!draft||draft.revision!==r.revision)return fail(res,Error('Pripremi novi uvoz za pregled.'));
  const data=JSON.parse(draft.snapshot),old=JSON.parse(r.working),people=new Map(data.people.map(p=>[p.id,p]));
  const families=data.families.map(f=>'<details><summary>'+esc(f.parents.map(id=>people.get(id)?.name||'Nepoznato').join(' i '))+'</summary><p>Djeca: '+esc(f.children.map(id=>people.get(id)?.name||'Nepoznato').join(', ')||'Nema upisanih')+'</p></details>').join('');
  res.send(page('Pregled zamjene iz Grampsa','<a href="'+url(r.id)+'">Odustani — zadrži postojeće podatke</a><section><p>Trenutno: '+old.people.length+' osoba · '+old.families.length+' porodica</p><p>Novi uvoz: '+data.people.length+' osoba · '+data.families.length+' porodica</p><p><b>Svi podaci linka biće zamijenjeni ovim uvozom.</b> Stare dopune se ne vraćaju preko Gramps podataka. Prethodno stanje se arhivira. Oznake promjena i obrade se čiste, a link ostaje zaključan do tvog otključavanja.</p><form method="post" action="'+url(r.id)+'/refresh/commit">'+hidden('csrf',csrf)+hidden('revision',r.revision)+hidden('nonce',draft.nonce)+'<label><input type="checkbox" name="confirm" value="yes" required> Prenio/la sam potrebne dopune u Gramps i potvrđujem zamjenu podataka ovog linka.</label><button class="danger">Arhiviraj staro i zamijeni iz Grampsa</button></form></section>'+families));
 });
 app.post('/admin/family-links/:id/refresh/commit',adminAuth,parse,postGuard,adminGuard,(req,res)=>{
  try{db.transaction(()=>{const r=checked(req),draft=db.prepare('SELECT * FROM family_link_refresh_drafts WHERE link_id=?').get(r.id);
   if(!r.locked||!draft||draft.revision!==r.revision||draft.nonce!==req.body.nonce)throw Error('Priprema više nije važeća. Ponovi uvoz.');
   if(req.body.confirm!=='yes')throw Error('Potvrdi prenos dopuna i zamjenu podataka.');
   const archive={formatVersion:1,action:'replaced_from_gramps',transferConfirmed:true,link:r,history:db.prepare('SELECT * FROM family_link_history WHERE link_id=? ORDER BY id').all(r.id),progress:db.prepare('SELECT * FROM family_link_progress WHERE link_id=?').get(r.id)||null,review:db.prepare('SELECT * FROM family_link_review_snapshots WHERE link_id=?').get(r.id)||null};
   const now=new Date().toISOString();db.prepare('INSERT INTO family_link_archives(link_id,created,revision,content) VALUES(?,?,?,?)').run(r.id,now,r.revision,JSON.stringify(archive));
   const change=db.prepare('UPDATE family_links SET baseline=?,working=?,revision=revision+1,updated=?,refreshed_at=?,last_seen=NULL WHERE id=? AND revision=? AND locked=1').run(draft.snapshot,draft.snapshot,now,now,r.id,r.revision);if(change.changes!==1)throw Error('Link je promijenjen.');
   for(const table of ['family_link_history','family_link_progress','family_link_review_snapshots','family_link_refresh_drafts'])db.prepare('DELETE FROM '+table+' WHERE link_id=?').run(r.id);
  })();res.redirect(url(req.params.id)+'?refreshed=1#gramps-refresh');
  }catch(e){fail(res,e);}
 });
 app.get('/admin/family-links/:id/archives/:archive',adminAuth,(req,res)=>{
  const archive=db.prepare('SELECT content FROM family_link_archives WHERE id=? AND link_id=?').get(req.params.archive,req.params.id);if(!archive)return res.sendStatus(404);
  res.attachment('porodicni-link-arhiva-'+Number(req.params.archive)+'.json').type('json').send(archive.content);
 });
 return {controls};
}
module.exports={mountRefresh};
