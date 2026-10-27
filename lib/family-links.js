const express = require('express');
const crypto = require('crypto');
const {displayName,navigation,personPath,startingFamilies}=require('./family-navigation');
const { selectDescendantBranch } = require('./gramps-branch');
const {fields,compareBranch,progressStatus}=require('./family-review');
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
  CREATE TABLE IF NOT EXISTS family_link_history(id INTEGER PRIMARY KEY, link_id INTEGER NOT NULL REFERENCES family_links(id) ON DELETE CASCADE, previous TEXT NOT NULL, changed_by TEXT NOT NULL, created TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS family_link_progress(link_id INTEGER PRIMARY KEY REFERENCES family_links(id) ON DELETE CASCADE, submitted_revision INTEGER, submitted_at TEXT, submitted_by TEXT, reviewed_revision INTEGER, reviewed_at TEXT);`);
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
  const progressFor=id=>db.prepare('SELECT * FROM family_link_progress WHERE link_id=?').get(id);
  const dateLabel=value=>value?new Date(value).toLocaleString('hr-HR',{timeZone:process.env.TZ||'Europe/Vienna',dateStyle:'medium',timeStyle:'short'}):'—';
  const rootLabel=data=>startingFamilies(data).map(group=>group.map(p=>[displayName(p,data),p.grampsId&&`(${p.grampsId})`].filter(Boolean).join(' ')).join(' i ')||'Nepoznati roditelji').join(' / ')||'Nije poznata';
  const labelFor=(f,people)=>f.parents.map(id=>people.find(p=>p.id===id)?.name||'Nepoznato').join(' & ') || 'Porodica';
  app.get('/admin/family-links',adminAuth,(req,res)=>{
    const rows=db.prepare('SELECT * FROM family_links ORDER BY id DESC').all();
    const cards=rows.map(r=>{const data=JSON.parse(r.working), diff=compareBranch(JSON.parse(r.baseline),data), progress=progressFor(r.id), last=db.prepare('SELECT changed_by FROM family_link_history WHERE link_id=? ORDER BY id DESC LIMIT 1').get(r.id);return `<section><h2>${esc(r.label)}</h2><p><b>Početna porodica:</b> ${esc(rootLabel(JSON.parse(r.baseline)))}</p><p><b>Link:</b> ${r.active?'Aktivan':'Isključen'} · <b>Obrada:</b> ${esc(progressStatus(r,progress))}</p><p><b>Promjene:</b> ${diff.addedPeople.length} novih osoba · ${diff.changedPeople.length} izmijenjenih osoba · ${diff.addedFamilies.length} novih porodica · ${diff.addedChildren.reduce((n,c)=>n+c.ids.length,0)} djece dodano u postojeće porodice</p><p><small>Zadnje otvaranje: ${esc(dateLabel(r.last_seen))} · Zadnje čuvanje: ${esc(dateLabel(r.updated))}${last?` · Unio/la: ${esc(last.changed_by)}`:''}</small></p><a class="btn" href="/admin/family-links/${r.id}#latest-changes">Pogledaj promjene i status</a></section>`;}).join('');
    res.send(page('Porodični linkovi',`<a href="/admin">← Admin</a><section><a class="btn" href="/admin/family-links/new">Napravi link iz Grampsa</a><p>Izmjene ostaju ovdje do tvog pregleda i ne prenose se automatski u Gramps.</p></section>${cards||'<p>Još nema napravljenih linkova.</p>'}`));
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
    const diff=compareBranch(base,data), progress=progressFor(r.id);
    const history=db.prepare('SELECT previous,changed_by,created FROM family_link_history WHERE link_id=? ORDER BY id DESC').all(r.id);
    let latest=null,latestEntry=null,after=data;
    for(const entry of history){const before=JSON.parse(entry.previous), change=compareBranch(before,after);if(change.hasChanges){latest=change;latestEntry=entry;break;}after=before;}
    const name=id=>displayName(data.people.find(p=>p.id===id),data);
    const personLink=p=>`<a href="/admin/family-links/${r.id}?person=${encodeURIComponent(p.id)}#person-editor">${esc(displayName(p,data))}</a>`;
    const context=p=>{const path=personPath(data,p.id);const route=path.length?path.map(person=>[displayName(person,data),person.grampsId?`(${person.grampsId})`:''].filter(Boolean).join(' ')).join(' → '):'Put od početne porodice nije dostupan';const parents=data.families.filter(f=>f.children.includes(p.id)).map(f=>f.parents.map(name).join(' i ')).filter(Boolean);return `<small>Put od početne porodice: ${esc(route)}${parents.length?`<br>Roditelji: ${esc(parents.join(' / '))}`:''}${p.grampsId?`<br>Gramps ID: ${esc(p.grampsId)}`:' · Nova osoba, još nema Gramps ID'}</small>`;};
    const latestHtml=latest?`<section id="latest-changes"><h2>Posljednje sačuvane promjene</h2><p>${esc(dateLabel(latestEntry.created))} · ${esc(latestEntry.changed_by)}</p>${latest.addedPeople.map(p=>`<article><h3>Nova osoba: ${personLink(p)}</h3><p>${context(p)}</p>${Object.entries(fields).filter(([k])=>k!=='name'&&p[k]).map(([k,l])=>`<p><b>${esc(l)}:</b> ${esc(p[k])}</p>`).join('')}</article>`).join('')}${latest.changedPeople.map(({person,changes})=>`<article><h3>Izmijenjena osoba: ${personLink(person)}</h3><p>${context(person)}</p>${changes.map(c=>`<p><b>${esc(c.label)}</b><br>Prije: ${esc(c.before||'—')}<br>Sada: ${esc(c.after||'—')}</p>`).join('')}</article>`).join('')}${latest.addedFamilies.map(f=>`<p><b>Nova porodica:</b> ${esc(f.parents.map(name).join(' i ')||'Nepoznato')} · Djeca: ${esc(f.children.map(name).join(', ')||'nema upisanih')}</p>`).join('')}${latest.addedChildren.map(({family,ids})=>`<p><b>Djeca dodana u porodicu:</b> ${esc(ids.map(name).join(', '))} · Roditelji: ${esc(family.parents.map(name).join(' i ')||'Nepoznato')}</p>`).join('')}${latest.hasChanges?'':'<p>Pri posljednjem čuvanju sadržaj nije promijenjen. Ranije izmjene vidi ispod.</p>'}<a href="#all-changes">Pogledaj sve promjene</a></section>`:'<section id="latest-changes"><h2>Posljednje sačuvane promjene</h2><p>Još nema sačuvanih promjena.</p></section>';
    const details=diff.addedPeople.map(p=>`<li>${personLink(p)}<br>${context(p)}${Object.entries(fields).filter(([k])=>k!=='name'&&p[k]).map(([k,l])=>`<br><small>${esc(l)}: ${esc(p[k])}</small>`).join('')}</li>`).join('');
    const changed=diff.changedPeople.map(({person,changes})=>`<article><h3>${personLink(person)}</h3><p>${context(person)}</p>${changes.map(c=>`<p><b>${esc(c.label)}</b><br>Prije: ${esc(c.before||'—')}<br>Sada: ${esc(c.after||'—')}</p>`).join('')}</article>`).join('');
    const families=diff.addedFamilies.map(f=>`<li>Roditelji: ${esc(f.parents.map(name).join(' i ')||'Nepoznato')} · Djeca: ${esc(f.children.map(name).join(', ')||'nema upisanih')}</li>`).join('');
    const children=diff.addedChildren.map(({family,ids})=>`<li>${esc(ids.map(name).join(', '))} — porodica: ${esc(family.parents.map(name).join(' i ')||'Nepoznato')}</li>`).join('');
    res.send(page(r.label,`<a href="/admin/family-links">← Linkovi</a><section><h2>Status linka i obrade</h2><p><b>Početna porodica:</b> ${esc(rootLabel(base))}</p><p><b>Link:</b> ${r.active?'Aktivan':'Nacrt / isključen'} · <b>Obrada:</b> ${esc(progressStatus(r,progress))}</p><p>${data.people.length} osoba · ${data.families.length} porodica · Zadnje otvaranje: ${esc(dateLabel(r.last_seen))} · Zadnje čuvanje: ${esc(dateLabel(r.updated))}</p>${progress?.submitted_revision===r.revision?`<p>Obradu označio/la završenom: ${esc(progress.submitted_by)} · ${esc(dateLabel(progress.submitted_at))}</p>`:''}${progress?.reviewed_revision===r.revision?`<p>Pregled označen: ${esc(dateLabel(progress.reviewed_at))}</p>`:''}<p>Pregledano znači da si pogledao/la prijedloge. Podaci se ne prenose automatski u Gramps.</p><form method="post" action="/admin/family-links/${r.id}/review">${hidden('csrf',csrf)}${hidden('revision',r.revision)}<button ${progress?.reviewed_revision===r.revision?'disabled':''}>Označi kao pregledano</button></form><p>Ko ima aktivan link može vidjeti i uređivati pripremljene podatke.</p>${r.active?`<p><a href="/branch/${r.token}">Otvori link za rođaka</a> i kopiraj adresu iz preglednika.</p>`:''}<form method="post" action="/admin/family-links/${r.id}/toggle">${hidden('csrf',csrf)}<button ${r.active?'class="danger"':''}>${r.active?'Isključi link':'Aktiviraj link'}</button></form></section>${latestHtml}<section id="all-changes"><h2>Sve promjene od pripreme linka</h2><p>Poređenje s podacima iz Grampsa u trenutku pripreme linka.</p><h3>Nove osobe (${diff.addedPeople.length})</h3>${details?`<ul>${details}</ul>`:'<p>Nema novih osoba.</p>'}<h3>Izmijenjeni podaci (${diff.changedPeople.length} osoba)</h3>${changed||'<p>Nema izmijenjenih podataka.</p>'}<h3>Nove porodice (${diff.addedFamilies.length})</h3>${families?`<ul>${families}</ul>`:'<p>Nema novih porodica.</p>'}<h3>Djeca dodana u postojeće porodice (${diff.addedChildren.reduce((n,c)=>n+c.ids.length,0)})</h3>${children?`<ul>${children}</ul>`:'<p>Nema dodane djece u postojećim porodicama.</p>'}</section><section><h2>Istorija čuvanja</h2>${history.length?history.map(h=>`<p>${esc(dateLabel(h.created))} · ${esc(h.changed_by)}</p>`).join(''):'<p>Još nema sačuvanih izmjena.</p>'}<small>Ime osobe koja dopunjava podatke unosi se ručno.</small></section>${navigation(data,`/admin/family-links/${r.id}`,String(req.query.person||''),String(req.query.q||'').slice(0,160))}<section id="person-editor"><h2>Podaci odabrane osobe</h2>${data.people.filter(p=>p.id===req.query.person).map(p=>`<details open><summary>${esc(displayName(p,data))}</summary>${Object.entries(fields).map(([k,l])=>`<p><b>${l}:</b> ${esc(p[k]||'—')}</p>`).join('')}${(p.events||[]).map(e=>`<p>${esc(e)}</p>`).join('')}</details>`).join('')||'<p>Odaberi osobu u grani iznad.</p>'}</section>`));
  });
  app.post('/admin/family-links/:id/review',adminAuth,parse,postGuard,adminGuard,(req,res)=>{
    const r=db.prepare('SELECT * FROM family_links WHERE id=?').get(req.params.id);if(!r)return res.sendStatus(404);
    if(String(r.revision)!==String(req.body.revision))return res.status(409).send(page('Podaci su promijenjeni','Otvori pregled ponovo prije označavanja.'));
    db.prepare('INSERT INTO family_link_progress(link_id,reviewed_revision,reviewed_at) VALUES(?,?,?) ON CONFLICT(link_id) DO UPDATE SET reviewed_revision=excluded.reviewed_revision, reviewed_at=excluded.reviewed_at').run(r.id,r.revision,new Date().toISOString());
    res.redirect(`/admin/family-links/${r.id}`);
  });
  const getLink=(req,res,next)=>{const r=db.prepare('SELECT * FROM family_links WHERE token=? AND active=1').get(req.params.token);if(!r)return res.status(404).send(page('Link nije dostupan','Link nije važeći ili je isključen.'));req.link=r;next();};
  app.get('/branch/:token',getLink,(req,res)=>{
    const r=req.link,data=JSON.parse(r.working);db.prepare('UPDATE family_links SET last_seen=? WHERE id=?').run(new Date().toISOString(),r.id);
    const input=(k,value)=>`<label>${fields[k]}${k==='notes'?`<textarea name="${k}" maxlength="10000">${esc(value)}</textarea>`:`<input name="${k}" value="${esc(value)}" maxlength="1000" ${k==='name'?'required':''}>`}</label>`;
    const common=hidden('csrf',publicCsrf(r.token))+hidden('revision',r.revision);
    const selected=data.people.find(p=>p.id===req.query.person);
    const personLabel=id=>displayName(data.people.find(p=>p.id===id),data);
    const editorField='<label>Tvoje ime (ko dopunjava podatke)<input name="editor" required maxlength="160" autocomplete="name"></label>';
    const familySection=p=>{
      const families=data.families.filter(f=>f.parents.includes(p.id));
      return `<section id="person-families"><h2>Porodica osobe ${esc(displayName(p,data))}</h2><p>Ovdje možeš nastaviti ovu granu: dodati partnera i djecu ili dopuniti postojeću porodicu.</p>${families.map(f=>`<details open><summary>${esc(f.parents.filter(id=>id!==p.id).map(personLabel).join(', ')||'Partner nije naveden')}</summary><p><b>Djeca:</b> ${f.children.length?f.children.map(id=>`<a href="/branch/${r.token}?person=${encodeURIComponent(id)}#person-editor">${esc(personLabel(id))}</a>`).join(', '):'Još nema upisane djece.'}</p><details><summary>Dodaj dijete u ovu porodicu</summary><form method="post" action="/branch/${r.token}/add">${common}${hidden('family',f.id)}${hidden('role','child')}${hidden('context',p.id)}${editorField}<div class="grid">${Object.keys(fields).map(k=>input(k,'')).join('')}</div><button>Dodaj dijete</button></form></details></details>`).join('')}${families.length?'':'<p>Za ovu osobu još nije upisana porodica.</p>'}<details><summary>Napravi novu porodicu</summary><p>Partner i prvo dijete nisu obavezni. Nakon čuvanja možeš dodati još djece i dopuniti njihove podatke.</p><form method="post" action="/branch/${r.token}/family">${common}${hidden('person',p.id)}${editorField}<label>Partner koji je već u ovoj grani<select name="existingPartner"><option value="">Nije odabran</option>${data.people.filter(other=>other.id!==p.id).map(other=>`<option value="${esc(other.id)}">${esc(displayName(other,data))}</option>`).join('')}</select></label><label>Ili ime i prezime novog partnera<input name="partnerName" maxlength="1000"></label><label>Ime i prezime prvog djeteta<input name="childName" maxlength="1000"></label><button>Napravi porodicu</button></form></details></section>`;
    };
    const progress=progressFor(r.id);
    const completion=`<section><h2>Status obrade</h2><p>${esc(progressStatus(r,progress))}</p><p>Kada završiš, označi obradu završenom da administrator zna da može pregledati podatke. Ako kasnije nešto promijeniš, obradu treba ponovo označiti završenom.</p><form method="post" action="/branch/${r.token}/completion">${common}<label>Tvoje ime<input name="editor" required maxlength="160" autocomplete="name"></label><button>${progress?.submitted_revision===r.revision?'Ponovo označi obradu završenom':'Završio/la sam obradu'}</button></form></section>`;
    res.send(page(r.label,`<p><b>Početna porodica:</b> ${esc(rootLabel(data))}</p><p>Podaci su pripremljeni iz Grampsa. Odaberi osobu, dopuni njene podatke ili nastavi unos njene porodice. Sačuvaj izmjene prije prelaska dalje.</p>${req.query.saved?'<section>Sačuvano. Prijedlog će pregledati administrator.</section>':''}${!selected?'<section>Odaberi osobu u grani ili je pronađi po prezimenu. Zatim možeš urediti osobu i dodati njenu porodicu.</section>':`<details open id="person-editor"><summary>Podaci osobe: ${esc(displayName(selected,data))}</summary><small>${esc(selected.grampsId)}</small><form method="post" action="/branch/${r.token}/person">${common}${hidden('id',selected.id)}${editorField}<div class="grid">${Object.keys(fields).map(k=>input(k,k==='name'?displayName(selected,data):selected[k])).join('')}</div>${(selected.events||[]).map(e=>`<p><small>${esc(e)}</small></p>`).join('')}<button>Sačuvaj osobu</button></form></details>${familySection(selected)}`}${navigation(data,`/branch/${r.token}`,String(req.query.person||''),String(req.query.q||'').slice(0,160))}${completion} `));
  });
  app.post('/branch/:token/completion',parse,postGuard,getLink,(req,res)=>{
    try {const r=req.link;if(req.body.csrf!==publicCsrf(r.token))return res.sendStatus(403);
      if(String(r.revision)!==String(req.body.revision))return res.status(409).send(page('Podaci su promijenjeni','Otvori link ponovo prije završetka obrade.'));
      const editor=String(req.body.editor||'').trim().slice(0,160);if(!editor)throw Error('Upiši svoje ime.');
      db.prepare('INSERT INTO family_link_progress(link_id,submitted_revision,submitted_at,submitted_by) VALUES(?,?,?,?) ON CONFLICT(link_id) DO UPDATE SET submitted_revision=excluded.submitted_revision,submitted_at=excluded.submitted_at,submitted_by=excluded.submitted_by,reviewed_revision=NULL,reviewed_at=NULL').run(r.id,r.revision,new Date().toISOString(),editor);
      res.redirect(`/branch/${r.token}?saved=1`);
    }catch(e){fail(res,e);}
  });
  function save(req,res,add){
    try {const r=req.link;if(req.body.csrf!==publicCsrf(r.token))return res.sendStatus(403);if(String(r.revision)!==String(req.body.revision))return res.status(409).send(page('Podaci su promijenjeni','Neko je u međuvremenu sačuvao izmjene. Otvori link ponovo prije nove dorade.'));
      const editor=String(req.body.editor||'').trim().slice(0,160);if(!editor)throw Error('Upiši ko vrši doradu.');const data=JSON.parse(r.working);let person;
      if(add){person={id:crypto.randomUUID(),grampsId:'',events:[]};if(req.body.role==='partner'){if(!data.people.some(p=>p.id===req.body.partnerOf))throw Error('Osoba nije pronađena.');data.families.push({id:crypto.randomUUID(),parents:[req.body.partnerOf,person.id],children:[]});}else{const f=data.families.find(f=>f.id===req.body.family);if(!f || (req.body.context && !f.parents.includes(req.body.context)))throw Error('Porodica nije pronađena za ovu osobu.');f.children.push(person.id);}data.people.push(person);}else{person=data.people.find(p=>p.id===req.body.id);if(!person)throw Error('Osoba nije pronađena.');}
      for(const k of Object.keys(fields)){const value=String(req.body[k]||'').trim().slice(0,k==='notes'?10000:1000);if(k==='name' && !add && value===displayName(person,data))continue;person[k]=value;}if(!person.name)throw Error('Upiši ime i prezime.');if(data.people.length>5000)throw Error('Previše osoba u jednoj grani.');
      db.transaction(()=>{const change=db.prepare('UPDATE family_links SET working=?,revision=revision+1,updated=? WHERE id=? AND revision=? AND active=1').run(JSON.stringify(data),new Date().toISOString(),r.id,r.revision);if(change.changes!==1)throw Error('Podaci su promijenjeni. Otvori link ponovo.');db.prepare('INSERT INTO family_link_history(link_id,previous,changed_by,created) VALUES(?,?,?,?)').run(r.id,r.working,editor,new Date().toISOString());})();res.redirect(`/branch/${r.token}?saved=1&person=${encodeURIComponent(req.body.context||person.id)}#${req.body.context?'person-families':'person-editor'}`);
    }catch(e){fail(res,e);}
  }
  app.post('/branch/:token/family',parse,postGuard,getLink,(req,res)=>{
    try {
      const r=req.link;
      if(req.body.csrf!==publicCsrf(r.token))return res.sendStatus(403);
      if(String(r.revision)!==String(req.body.revision))return res.status(409).send(page('Podaci su promijenjeni','Neko je u međuvremenu sačuvao izmjene. Otvori link ponovo prije nove dorade.'));
      const editor=String(req.body.editor||'').trim().slice(0,160);
      if(!editor)throw Error('Upiši ko vrši doradu.');
      const data=JSON.parse(r.working), parent=data.people.find(p=>p.id===req.body.person);
      if(!parent)throw Error('Osoba nije pronađena.');
      const partnerName=String(req.body.partnerName||'').trim().slice(0,1000), childName=String(req.body.childName||'').trim().slice(0,1000), existing=String(req.body.existingPartner||'');
      if(existing && partnerName)throw Error('Odaberi postojećeg partnera ili upiši novog, ne oboje.');
      if(existing && (existing===parent.id || !data.people.some(p=>p.id===existing)))throw Error('Partner nije pronađen.');
      const makePerson=name=>{const person={id:crypto.randomUUID(),grampsId:'',name,birth:'',birthPlace:'',death:'',deathPlace:'',notes:'',events:[]};data.people.push(person);return person.id;};
      const partner=existing||(partnerName?makePerson(partnerName):'');
      if(partner && data.families.some(f=>f.parents.length===2 && f.parents.includes(parent.id) && f.parents.includes(partner)))throw Error('Porodica s ovim partnerom već postoji. Dodaj dijete u postojeću porodicu.');
      const children=childName?[makePerson(childName)]:[];
      if(data.people.length>5000)throw Error('Previše osoba u jednoj grani.');
      data.families.push({id:crypto.randomUUID(),parents:[parent.id,...(partner?[partner]:[])],children,events:[]});
      db.transaction(()=>{const change=db.prepare('UPDATE family_links SET working=?,revision=revision+1,updated=? WHERE id=? AND revision=? AND active=1').run(JSON.stringify(data),new Date().toISOString(),r.id,r.revision);if(change.changes!==1)throw Error('Podaci su promijenjeni. Otvori link ponovo.');db.prepare('INSERT INTO family_link_history(link_id,previous,changed_by,created) VALUES(?,?,?,?)').run(r.id,r.working,editor,new Date().toISOString());})();
      res.redirect(`/branch/${r.token}?saved=1&person=${encodeURIComponent(parent.id)}#person-families`);
    }catch(e){fail(res,e);}
  });
  app.post('/branch/:token/person',parse,postGuard,getLink,(req,res)=>save(req,res,false));app.post('/branch/:token/add',parse,postGuard,getLink,(req,res)=>save(req,res,true));
}
module.exports={mountFamilyLinks,prepareBranch,dateText};
