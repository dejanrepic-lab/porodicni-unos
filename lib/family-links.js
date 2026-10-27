const express = require('express');
const crypto = require('crypto');
const {displayName,navigation}=require('./family-navigation');
const { selectDescendantBranch } = require('./gramps-branch');
const fields = {name:'Prezime, ime', birth:'Datum rođenja', birthPlace:'Mjesto rođenja', death:'Datum smrti', deathPlace:'Mjesto smrti', notes:'Napomene / izvor informacije'};
const esc = (x='') => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function personName(p) { const n=p?.primary_name || {}; return [(n.surname_list||[]).map(s=>s.surname).filter(Boolean).join(' '),n.first_name].filter(Boolean).join(', ') || p?.gramps_id || 'Nepoznato'; }
function dateText(d) {
  if (!d) return '';
  if(d.text) return d.text;
  const a=d.dateval || [];
  const value=[a[2],a[1] && String(a[1]).padStart(2,'0'),a[0] && String(a[0]).padStart(2,'0')].filter(Boolean).join('-');
  const modifiers={1:'prije',2:'poslije',3:'oko',4:'raspon',5:'od/do'};
  const end=a.length>=7?[a[6],a[5],a[4]].filter(Boolean).join('-'):'';
  return [modifiers[d.modifier]||'',value,end&&`– ${end}`,d.calendar?`(kalendar ${d.calendar})`:''].filter(Boolean).join(' ');
}
function prepareBranch(data, root) {
  const branch=selectDescendantBranch(root,data.people,data.families);
  const events=new Map((data.events||[]).map(e=>[e.handle,e]));
  const places=new Map((data.places||[]).map(p=>[p.handle,p]));
  const notes=new Map((data.notes||[]).map(n=>[n.handle,n.text?.string || n.text || '']));
  const people=branch.people.map(p=>{
    const eventList=(p.event_ref_list||[]).map(r=>events.get(r.ref)).filter(Boolean);
    const detail=t=>eventList.find(e=>String(e.type).toLowerCase()===t);
    const place=e=>{ const p=places.get(e?.place); return p?.title || p?.name?.value || ''; };
    return {id:p.handle, grampsId:p.gramps_id || '', name:personName(p),birth:dateText(detail('birth')?.date),birthPlace:place(detail('birth')),death:dateText(detail('death')?.date),deathPlace:place(detail('death')),notes:(p.note_list||[]).map(h=>notes.get(h)).filter(Boolean).join('\n\n'),events:eventList.map(e=>[e.type,dateText(e.date),place(e),e.description].filter(Boolean).join(' · '))};
  });
  return {rootFamily:root, people, families:branch.families.map(f=>({id:f.handle,parents:[f.father_handle,f.mother_handle].filter(Boolean),children:(f.child_ref_list||[]).map(c=>c.ref),events:(f.event_ref_list||[]).map(r=>events.get(r.ref)).filter(Boolean).map(e=>[e.type,dateText(e.date),places.get(e.place)?.title,e.description].filter(Boolean).join(' · '))})), original:{...branch, events:[...events.values()].filter(e=>branch.people.some(p=>(p.event_ref_list||[]).some(r=>r.ref===e.handle)) || branch.families.some(f=>(f.event_ref_list||[]).some(r=>r.ref===e.handle)))}};
}
function mountFamilyLinks(app,{db,adminAuth,client}) {
  db.exec(`CREATE TABLE IF NOT EXISTS family_links(id INTEGER PRIMARY KEY, token TEXT UNIQUE NOT NULL, label TEXT NOT NULL, baseline TEXT NOT NULL, working TEXT NOT NULL, created TEXT NOT NULL, last_seen TEXT, updated TEXT, active INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS family_link_history(id INTEGER PRIMARY KEY, link_id INTEGER NOT NULL REFERENCES family_links(id) ON DELETE CASCADE, previous TEXT NOT NULL, changed_by TEXT NOT NULL, created TEXT NOT NULL);`);
  const csrf=crypto.randomBytes(32).toString('hex');
  const publicCsrf=token=>crypto.createHmac('sha256',csrf).update(token).digest('hex');
  const parse=express.urlencoded({extended:false,limit:'100kb'});
  const postGuard=(req,res,next)=>{
    if(req.get('sec-fetch-site')==='cross-site') return res.status(403).send('Zahtjev nije dozvoljen.');
    next();
  };
  const adminGuard=(req,res,next)=>req.body.csrf===csrf?next():res.status(403).send('Osvježi stranicu i pokušaj ponovo.');
  const hidden=(key,value)=>`<input type="hidden" name="${key}" value="${esc(value)}">`;
  function page(title,body) {return `<!doctype html><html lang="bs"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f7fb;color:#1f2937;font:16px system-ui}main{max-width:960px;margin:auto;padding:20px}section,details{background:white;border:1px solid #dfe5ee;border-radius:14px;padding:18px;margin:14px 0}summary{cursor:pointer;font-weight:700}label{display:block;margin:12px 0}input,textarea,select{display:block;width:100%;padding:12px;border:1px solid #cfd6e2;border-radius:8px;font:inherit}textarea{min-height:100px}button,.btn{display:inline-block;padding:12px 16px;border:0;border-radius:9px;background:#2f6feb;color:white;text-decoration:none;cursor:pointer;margin:8px 6px 8px 0;font:inherit}a{color:#2254b0}small{color:#667085}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 16px}.danger{background:#b42318}pre{white-space:pre-wrap;overflow-wrap:anywhere}td,th{padding:10px;text-align:left;border-bottom:1px solid #eee;overflow-wrap:anywhere}.table{overflow-x:auto} @media(max-width:600px){.grid{grid-template-columns:1fr}main{padding:12px}section,details{padding:14px}}.person-link{display:block;padding:10px;margin:6px 0;border:1px solid #dfe5ee;border-radius:8px;text-decoration:none;background:#fff}.person-link small{display:block}.person-link.selected{border-color:#2f6feb;background:#eaf1ff}.descendants{list-style:none;border-left:2px solid #c9d7eb;margin:10px 0 0 8px;padding-left:14px}.descendants>li{margin:12px 0}.family-node{margin:10px 0;padding:12px;background:#fbfcfe}.couple{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}.family-tree{overflow-wrap:anywhere}.search-results{max-height:360px;overflow:auto}@media(max-width:600px){.family-node{padding:8px}.descendants{margin-left:0;padding-left:8px}.couple{grid-template-columns:1fr}} </style><main><h1>${esc(title)}</h1>${body}</main></html>`;}
  const noCache=(req,res,next)=>{res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');next();};
  app.use('/branch',noCache);app.use('/admin/family-links',noCache);
  const fail=(res,error)=>res.status(400).send(page('Zahtjev nije uspio',`<p>${esc(error.message)}</p><p>Vrati se nazad; podaci nisu promijenjeni.</p>`));
  const labelFor=(f,people)=>f.parents.map(id=>people.find(p=>p.id===id)?.name||'Nepoznato').join(' & ') || 'Porodica';
  app.get('/admin/family-links',adminAuth,(req,res)=>{
    const rows=db.prepare('SELECT * FROM family_links ORDER BY id DESC').all();
    res.send(page('Porodični linkovi',`<a href="/admin">← Admin</a><section><a class="btn" href="/admin/family-links/new">Napravi link iz Grampsa</a><p>Pripremi postojeće podatke za rođaka. Izmjene ostaju ovdje do tvog pregleda.</p></section>${rows.map(r=>`<section><h2>${esc(r.label)}</h2><p>${r.active?'Aktivan':'Isključen'} · Zadnja posjeta: ${esc(r.last_seen||'Još nije otvaran')} · Zadnja izmjena: ${esc(r.updated||'Nema')}</p><a class="btn" href="/admin/family-links/${r.id}">Pregled i izmjene</a><form method="post" action="/admin/family-links/${r.id}/toggle">${hidden('csrf',csrf)}<button ${r.active?'class="danger"':''}>${r.active?'Isključi link':'Aktiviraj link'}</button></form></section>`).join('')||'<p>Još nema napravljenih linkova.</p>'}`));
  });
  app.get('/admin/family-links/new',adminAuth,async(req,res)=>{
    try {const data=await client().snapshot();res.send(page('Pripremi porodični link',`<a href="/admin/family-links">← Linkovi</a><form method="post" action="/admin/family-links/prepare">${hidden('csrf',csrf)}<label>Kome je namijenjen?<input name="label" required maxlength="160"></label><label>Početna porodica<select name="family" required>${data.families.map(f=>`<option value="${esc(f.handle)}">${esc([f.father_handle,f.mother_handle].filter(Boolean).map(id=>personName(data.people.find(p=>p.handle===id))).join(' & ')||f.gramps_id)}</option>`).join('')}</select></label><button>Pripremi i pregledaj podatke</button></form>`));}catch(e){fail(res,e);}
  });
  // Preparation creates an inactive draft. The admin must explicitly activate it.
  app.post('/admin/family-links/prepare',adminAuth,parse,postGuard,adminGuard,async(req,res)=>{
    try {const label=String(req.body.label||'').trim().slice(0,160);if(!label)throw Error('Upiši kome je link namijenjen.');const data=await client().snapshot();const branch=prepareBranch(data,String(req.body.family||''));const json=JSON.stringify(branch);const result=db.prepare('INSERT INTO family_links(token,label,baseline,working,created,active) VALUES(?,?,?,?,?,0)').run(crypto.randomBytes(32).toString('hex'),label,json,json,new Date().toISOString());res.redirect(`/admin/family-links/${result.lastInsertRowid}`);}catch(e){fail(res,e);}
  });
  app.post('/admin/family-links/:id/toggle',adminAuth,parse,postGuard,adminGuard,(req,res)=>{db.prepare('UPDATE family_links SET active=1-active WHERE id=?').run(req.params.id);res.redirect(`/admin/family-links/${req.params.id}`);});
  function overview(data){return data.families.map(f=>`<details open><summary>${esc(labelFor(f,data.people))}</summary><p>Djeca: ${f.children.map(id=>esc(data.people.find(p=>p.id===id)?.name||'Nepoznato')).join(', ')||'Nema upisanih'}</p>${(f.events||[]).map(e=>`<p>${esc(e)}</p>`).join('')}</details>`).join('');}
  app.get('/admin/family-links/:id',adminAuth,(req,res)=>{
    const r=db.prepare('SELECT * FROM family_links WHERE id=?').get(req.params.id);if(!r)return res.sendStatus(404);
    const base=JSON.parse(r.baseline),data=JSON.parse(r.working);
    const changes=data.people.flatMap(p=>Object.entries(fields).flatMap(([k,label])=>{const old=base.people.find(x=>x.id===p.id);return old?.[k]===p[k]?[]:[`<tr><td>${esc(p.name)}</td><td>${esc(label)}</td><td>${esc(old?.[k]||'—')}</td><td>${esc(p[k]||'—')}</td></tr>`];}));
    const history=db.prepare('SELECT changed_by,created FROM family_link_history WHERE link_id=? ORDER BY id DESC').all(r.id);
    res.send(page(r.label,`<a href="/admin/family-links">← Linkovi</a><section><p>${data.people.length} osoba · ${data.families.length} porodica · ${r.active?'Aktivan':'Nacrt / isključen'}</p><p>Provjeri sadržaj prije aktiviranja, posebno podatke živih osoba. Ko ima link može ih vidjeti i uređivati.</p>${r.active?`<label>Privatni link (kopiraj cijelu adresu iz preglednika nakon otvaranja)<a href="/branch/${r.token}">Otvori link za rođaka</a></label>`:''}<form method="post" action="/admin/family-links/${r.id}/toggle">${hidden('csrf',csrf)}<button>${r.active?'Isključi link':'Aktiviraj link'}</button></form></section>${navigation(data,`/admin/family-links/${r.id}`,String(req.query.person||''),String(req.query.q||'').slice(0,160))}<section id="person-editor"><h2>Pripremljeni podaci</h2>${data.people.filter(p=>p.id===req.query.person).map(p=>`<details open><summary>${esc(displayName(p,data))}</summary>${Object.entries(fields).map(([k,l])=>`<p><b>${l}:</b> ${esc(p[k]||'—')}</p>`).join('')}${p.events.map(e=>`<p>${esc(e)}</p>`).join('')}</details>`).join('')}</section><section><h2>Predložene izmjene</h2><div class="table"><table><tr><th>Osoba</th><th>Podatak</th><th>Gramps pri pripremi</th><th>Prijedlog</th></tr>${changes.join('')}</table></div>${changes.length?'':'Nema izmjena.'}<h3>Istorija čuvanja</h3>${history.map(h=>`<p>${esc(h.created)} · ${esc(h.changed_by)}</p>`).join('')}</section>`));
  });
  const getLink=(req,res,next)=>{const r=db.prepare('SELECT * FROM family_links WHERE token=? AND active=1').get(req.params.token);if(!r)return res.status(404).send(page('Link nije dostupan','Link nije važeći ili je isključen.'));req.link=r;next();};
  app.get('/branch/:token',getLink,(req,res)=>{
    const r=req.link,data=JSON.parse(r.working);db.prepare('UPDATE family_links SET last_seen=? WHERE id=?').run(new Date().toISOString(),r.id);
    const input=(k,value)=>`<label>${fields[k]}${k==='notes'?`<textarea name="${k}" maxlength="10000">${esc(value)}</textarea>`:`<input name="${k}" value="${esc(value)}" maxlength="1000" ${k==='name'?'required':''}>`}</label>`;
    const common=hidden('csrf',publicCsrf(r.token))+hidden('revision',r.revision);
    res.send(page(r.label,`<p>Podaci su pripremljeni iz Grampsa. Provjeri ih i dopuni ono što znaš. Sačuvaj svaku uređenu osobu prije prelaska dalje. Isti link služi za nastavak.</p>${req.query.saved?'<section>Sačuvano. Prijedlog će pregledati administrator.</section>':''}${navigation(data,`/branch/${r.token}`,String(req.query.person||''),String(req.query.q||'').slice(0,160))}${!req.query.person?'<section>Odaberi osobu u grani ili je pronađi po prezimenu. Obrazac se otvara samo za odabranu osobu.</section>':''}${data.people.filter(p=>p.id===req.query.person).map(p=>`<details open id="person-editor"><summary>${esc(displayName(p,data))}</summary><small>${esc(p.grampsId)}</small><form method="post" action="/branch/${r.token}/person">${common}${hidden('id',p.id)}<label>Doradu vrši<input name="editor" required maxlength="160" autocomplete="name"></label><div class="grid">${Object.keys(fields).map(k=>input(k,k==='name'?displayName(p,data):p[k])).join('')}</div>${p.events.map(e=>`<p><small>${esc(e)}</small></p>`).join('')}<button>Sačuvaj osobu</button></form></details>`).join('')}<section><details><summary>Dodaj člana porodice</summary><form method="post" action="/branch/${r.token}/add">${common}<label>Doradu vrši<input name="editor" required maxlength="160"></label><label>Porodica<select name="family">${data.families.map(f=>`<option value="${esc(f.id)}">${esc(labelFor(f,data.people))}</option>`).join('')}</select></label><label>Dodaj kao<select name="role"><option value="child">Dijete</option><option value="partner">Partner/supružnik odabrane osobe</option></select></label><label>Za novog partnera odaberi osobu<select name="partnerOf">${data.people.map(p=>`<option value="${esc(p.id)}">${esc(displayName(p,data))}</option>`).join('')}</select></label>${Object.keys(fields).map(k=>input(k,'')).join('')}<button>Dodaj i sačuvaj</button></form></details></section>`));
  });
  function save(req,res,add){
    try {const r=req.link;if(req.body.csrf!==publicCsrf(r.token))return res.sendStatus(403);if(String(r.revision)!==String(req.body.revision))return res.status(409).send(page('Podaci su promijenjeni','Neko je u međuvremenu sačuvao izmjene. Otvori link ponovo prije nove dorade.'));
      const editor=String(req.body.editor||'').trim().slice(0,160);if(!editor)throw Error('Upiši ko vrši doradu.');const data=JSON.parse(r.working);let person;
      if(add){person={id:crypto.randomUUID(),grampsId:'',events:[]};if(req.body.role==='partner'){if(!data.people.some(p=>p.id===req.body.partnerOf))throw Error('Osoba nije pronađena.');data.families.push({id:crypto.randomUUID(),parents:[req.body.partnerOf,person.id],children:[]});}else{const f=data.families.find(f=>f.id===req.body.family);if(!f)throw Error('Porodica nije pronađena.');f.children.push(person.id);}data.people.push(person);}else{person=data.people.find(p=>p.id===req.body.id);if(!person)throw Error('Osoba nije pronađena.');}
      for(const k of Object.keys(fields)){const value=String(req.body[k]||'').trim().slice(0,k==='notes'?10000:1000);if(k==='name' && !add && value===displayName(person,data))continue;person[k]=value;}if(!person.name)throw Error('Upiši ime i prezime.');if(data.people.length>5000)throw Error('Previše osoba u jednoj grani.');
      db.transaction(()=>{const change=db.prepare('UPDATE family_links SET working=?,revision=revision+1,updated=? WHERE id=? AND revision=? AND active=1').run(JSON.stringify(data),new Date().toISOString(),r.id,r.revision);if(change.changes!==1)throw Error('Podaci su promijenjeni. Otvori link ponovo.');db.prepare('INSERT INTO family_link_history(link_id,previous,changed_by,created) VALUES(?,?,?,?)').run(r.id,r.working,editor,new Date().toISOString());})();res.redirect(`/branch/${r.token}?saved=1&person=${encodeURIComponent(person.id)}#person-editor`);
    }catch(e){fail(res,e);}
  }
  app.post('/branch/:token/person',parse,postGuard,getLink,(req,res)=>save(req,res,false));app.post('/branch/:token/add',parse,postGuard,getLink,(req,res)=>save(req,res,true));
}
module.exports={mountFamilyLinks,prepareBranch,dateText};
