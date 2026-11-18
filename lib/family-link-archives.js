// Readable view, download and deletion of the archives a Gramps replacement leaves behind.
// An archive keeps the replaced copy, its save history and its review state; deleting one never touches the live link.
const {compareBranch}=require('./family-review');
const {displayName}=require('./family-navigation');

function mountArchives(app,{db,adminAuth,parse,postGuard,adminGuard,csrf,hidden,esc,page}){
 const url=(id,archive)=>`/admin/family-links/${id}/archives/${archive}`;
 const when=value=>value?new Date(value).toLocaleString('hr-HR',{timeZone:process.env.TZ||'Europe/Vienna',dateStyle:'medium',timeStyle:'short'}):'—';
 const load=req=>{
  const row=db.prepare('SELECT * FROM family_link_archives WHERE id=? AND link_id=?').get(req.params.archive,req.params.id);
  if(!row)return null;
  let content={};try{content=JSON.parse(row.content);}catch{}
  return {row,content};
 };

 function summary(content){
  const link=content.link||{};
  let base,current;
  try{base=JSON.parse(link.baseline);current=JSON.parse(link.working);}catch{return '<p>Podaci u ovoj arhivi nisu čitljivi. Preuzmi JSON za ručni pregled.</p>';}
  const diff=compareBranch(base,current);
  const name=(id,data=current)=>esc(displayName(data.people.find(p=>p.id===id),data));
  const facts=p=>[p.birth&&`rođ. ${p.birth}`,p.birthPlace,p.death&&`umr. ${p.death}`,p.deathPlace].filter(Boolean).map(esc).join(' · ');
  const parts=[];
  if(diff.addedPeople.length)parts.push(`<section class="ar-block"><h2>Nove osobe <span>${diff.addedPeople.length}</span></h2><ul>${diff.addedPeople.map(p=>`<li><b>${name(p.id)}</b>${facts(p)?` <small>${facts(p)}</small>`:''}</li>`).join('')}</ul></section>`);
  if(diff.changedPeople.length)parts.push(`<section class="ar-block"><h2>Izmijenjene osobe <span>${diff.changedPeople.length}</span></h2>${diff.changedPeople.map(({person,changes})=>`<article class="ar-person"><h3>${name(person.id)}</h3>${changes.map(c=>`<div class="ar-change"><strong>${esc(c.label)}</strong><span class="ar-before">${c.before?esc(c.before):'<i>prazno</i>'}</span><span class="ar-arrow" aria-hidden="true">→</span><span class="ar-after">${c.after?esc(c.after):'<i>uklonjeno</i>'}</span></div>`).join('')}</article>`).join('')}</section>`);
  if(diff.addedFamilies.length)parts.push(`<section class="ar-block"><h2>Nove porodice <span>${diff.addedFamilies.length}</span></h2><ul>${diff.addedFamilies.map(f=>`<li><b>${f.parents.map(id=>name(id)).join(' i ')||'Nepoznati roditelji'}</b>${f.children.length?` <small>djeca: ${f.children.map(id=>name(id)).join(', ')}</small>`:''}</li>`).join('')}</ul></section>`);
  if(diff.addedChildren.length)parts.push(`<section class="ar-block"><h2>Djeca dodana u postojeće porodice <span>${diff.addedChildren.reduce((n,c)=>n+c.ids.length,0)}</span></h2><ul>${diff.addedChildren.map(({family,ids})=>`<li><b>${ids.map(id=>name(id)).join(', ')}</b> <small>porodica: ${family.parents.map(id=>name(id)).join(' i ')}</small></li>`).join('')}</ul></section>`);
  if(diff.changedFamilies.length)parts.push(`<section class="ar-block"><h2>Izmjene porodica <span>${diff.changedFamilies.length}</span></h2>${diff.changedFamilies.map(({family,changes})=>`<article class="ar-person"><h3>${family.parents.map(id=>name(id)).join(' i ')}</h3>${changes.map(c=>`<div class="ar-change"><strong>${esc(c.label)}</strong><span class="ar-before">${c.before?esc(c.before):'<i>prazno</i>'}</span><span class="ar-arrow" aria-hidden="true">→</span><span class="ar-after">${c.after?esc(c.after):'<i>uklonjeno</i>'}</span></div>`).join('')}</article>`).join('')}</section>`);
  const removed=diff.removedLinks.filter(x=>x.children.length||x.parents.length);
  if(removed.length||diff.removedPeople.length||diff.removedFamilies.length)parts.push(`<section class="ar-block"><h2>Uklonjeno</h2><ul>${diff.removedPeople.map(p=>`<li>Osoba: <b>${name(p.id,base)}</b></li>`).join('')}${diff.removedFamilies.map(f=>`<li>Porodica: <b>${f.parents.map(id=>name(id,base)).join(' i ')||'Nepoznato'}</b></li>`).join('')}${removed.map(x=>`<li>Iz porodice <b>${x.family.parents.map(id=>name(id)).join(' i ')}</b>: ${[...x.parents,...x.children].map(id=>name(id,base)).join(', ')}</li>`).join('')}</ul></section>`);
  return parts.join('')||'<section class="ar-block"><p>U ovom krugu nije bilo dopuna — podaci su bili isti kao pri uvozu iz Grampsa.</p></section>';
 }

 app.get('/admin/family-links/:id/archives/:archive',adminAuth,(req,res)=>{
  const found=load(req);if(!found)return res.sendStatus(404);
  const {row,content}=found,link=content.link||{},history=Array.isArray(content.history)?content.history:[],progress=content.progress;
  const editors=[...history.reduce((map,h)=>{const key=h.changed_by||'Nepoznato';const e=map.get(key)||{count:0,last:''};e.count++;if(String(h.created)>e.last)e.last=h.created;return map.set(key,e);},new Map())];
  const who=editors.length?`<ul class="ar-editors">${editors.map(([name,e])=>`<li><b>${esc(name)}</b> <small>${e.count} ${e.count===1?'čuvanje':'čuvanja'} · zadnje ${esc(when(e.last))}</small></li>`).join('')}</ul>`:'<p><small>Nema zapisa o čuvanju u ovom krugu.</small></p>';
  const status=[progress?.submitted_at&&`Dopunu završio/la ${esc(progress.submitted_by||'nepoznato')} · ${esc(when(progress.submitted_at))}`,progress?.reviewed_at&&`Pregled označen ${esc(when(progress.reviewed_at))}`].filter(Boolean).map(t=>`<li>${t}</li>`).join('');
  res.send(page(`Arhiva · ${link.label||'porodični link'}`,`<a href="/admin/family-links/${row.link_id}#gramps-refresh">← Nazad na link</a>
<section class="ar-head"><p class="ar-meta"><span class="fl-chip">Zamijenjeno iz Grampsa ${esc(when(row.created))}</span><span class="fl-chip">Revizija ${esc(row.revision)}</span>${content.transferConfirmed?'<span class="fl-chip add">Prenos u Gramps potvrđen</span>':''}</p><p>Ovo su podaci koje je link imao <b>prije</b> zamjene: šta su rođaci dopunili u odnosu na uvoz iz Grampsa i ko je čuvao izmjene.</p><h2>Ko je dopunjavao</h2>${who}${status?`<ul class="ar-status">${status}</ul>`:''}</section>
${summary(content)}
<section class="ar-actions"><a class="btn" href="${url(row.link_id,row.id)}/download">Preuzmi JSON</a>
<details class="ar-delete"><summary>Obriši ovu arhivu</summary><form method="post" action="${url(row.link_id,row.id)}/delete">${hidden('csrf',csrf)}<p>Briše se samo ova arhiva. Link, njegovi sadašnji podaci i ostale arhive ostaju. Brisanje se ne može poništiti.</p><label><input type="checkbox" name="confirm" value="yes" required> Razumijem i želim trajno obrisati ovu arhivu.</label><button class="danger">Obriši arhivu</button></form></details></section>`));
 });
 app.get('/admin/family-links/:id/archives/:archive/download',adminAuth,(req,res)=>{
  const found=load(req);if(!found)return res.sendStatus(404);
  res.attachment('porodicni-link-arhiva-'+Number(found.row.id)+'.json').type('json').send(found.row.content);
 });
 app.post('/admin/family-links/:id/archives/:archive/delete',adminAuth,parse,postGuard,adminGuard,(req,res)=>{
  if(req.body.confirm!=='yes')return res.status(400).send(page('Potvrda je potrebna','<p>Označi potvrdu prije brisanja arhive. Arhiva nije obrisana.</p><a href="'+esc(url(req.params.id,req.params.archive))+'">← Nazad na arhivu</a>'));
  const deleted=db.prepare('DELETE FROM family_link_archives WHERE id=? AND link_id=?').run(req.params.archive,req.params.id);
  if(deleted.changes!==1)return res.sendStatus(404);
  res.redirect(`/admin/family-links/${Number(req.params.id)}?archiveDeleted=1#gramps-refresh`);
 });
}
module.exports={mountArchives};
