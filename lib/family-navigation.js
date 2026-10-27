const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function displayName(person,data){
 if(!person)return 'Nepoznato';
 if(person.name.includes(','))return person.name;
 const original=data.original?.people?.find(p=>p.handle===person.id);
 const n=original?.primary_name;
 if(n){const surname=(n.surname_list||[]).map(s=>s.surname).filter(Boolean).join(' ');const full=[n.first_name,surname].filter(Boolean).join(' ');if(full===person.name)return [surname,n.first_name].filter(Boolean).join(', ');}
 return person.name;
}
function rootFamilies(data){
 if(data.rootFamily && data.families.some(f=>f.id===data.rootFamily))return data.families.filter(f=>f.id===data.rootFamily);
 const children=new Set(data.families.flatMap(f=>f.children));
 const roots=data.families.filter(f=>!f.parents.some(p=>children.has(p)));
 return roots.length?roots:data.families.slice(0,1);
}
// Finds the shortest path from the original family's parents to an individual.
// Partners are included as endpoints, but their unrelated ancestry is not followed.
function personPath(data,id){
 const roots=rootFamilies(data), people=new Map(data.people.map(p=>[p.id,p]));
 const queue=[], seen=new Set();
 for(const f of roots){for(const p of f.parents){if(people.has(p)&&!seen.has(p)){seen.add(p);queue.push([p]);}}if(!f.parents.length)for(const c of f.children){if(people.has(c)&&!seen.has(c)){seen.add(c);queue.push([c]);}}}
 if(seen.has(id))return [people.get(id)];
 for(let i=0;i<queue.length;i++){
  const path=queue[i],current=path[path.length-1];if(current===id)return path.map(p=>people.get(p));
  for(const f of data.families.filter(f=>f.parents.includes(current))){
   for(const child of f.children){if(people.has(child)&&!seen.has(child)){seen.add(child);queue.push([...path,child]);}}
   if(f.parents.includes(id)&&people.has(id))return [...path,id].map(p=>people.get(p));
  }
 }
 return [];
}
function startingFamilies(data){return rootFamilies(data).map(f=>f.parents.map(id=>data.people.find(p=>p.id===id)).filter(Boolean));}
function navigation(data,base,selected='',query='',review=null){
 const people=new Map(data.people.map(p=>[p.id,p]));
 const familiesByParent=new Map();
 for(const f of data.families)for(const id of f.parents){if(!familiesByParent.has(id))familiesByParent.set(id,[]);familiesByParent.get(id).push(f);}
 const link=p=>`<a class="person-link ${p.id===selected?'selected':''} ${review?.people.has(p.id)?'has-change':''}" href="${esc(base)}?person=${encodeURIComponent(p.id)}#person-editor"><strong>${esc(displayName(p,data))}</strong>${review?.people.has(p.id)?` <span class="change-badge">${review.people.get(p.id)==='new'?'Nova osoba':'Izmijenjeno'}</span>`:''}<small>${esc([p.birth&&`rođ. ${p.birth}`,p.death&&`umr. ${p.death}`].filter(Boolean).join(' · '))}</small></a>`;
 const visited=new Set();
 function family(f,depth,path){
  if(visited.has(f.id))return `<p class="muted">Porodica je prikazana u drugoj grani.</p>`;
  visited.add(f.id);
  const ancestors=new Set(path);ancestors.add(f.id);
  let contains=f.parents.includes(selected)||f.children.includes(selected)||review?.selectedFamily===f.id;
  let hasChanges=Boolean(review && (review.families.has(f.id)||[...f.parents,...f.children].some(id=>review.people.has(id))));
  const childHtml=f.children.map(id=>{const p=people.get(id);if(!p)return '';
   const subs=(familiesByParent.get(id)||[]).filter(g=>!ancestors.has(g.id)).map(g=>family(g,depth+1,ancestors));
   if(subs.some(s=>s.contains))contains=true;
   if(subs.some(s=>s.hasChanges))hasChanges=true;
   return `<li>${link(p)}${subs.map(s=>typeof s==='string'?s:s.html).join('')}</li>`;
  }).join('');
  const title=f.parents.map(id=>displayName(people.get(id),data)).join(' & ')||'Porodica';
  return {contains,hasChanges,html:`<details class="family-node ${hasChanges?'branch-changed':''}" ${depth===0||contains?'open':''}><summary>${esc(title)} <small>· ${f.children.length} djece</small>${hasChanges?' <span class="change-badge">Izmjene u grani</span>':''}</summary>${review?.families.has(f.id)?`<p><a class="family-change" href="${esc(base)}?family=${encodeURIComponent(f.id)}#family-review">${review.families.get(f.id)==='new'?'Nova porodica – pregledaj':'Dodana djeca – pregledaj'}</a></p>`:''}<div class="couple">${f.parents.map(id=>people.get(id)).filter(Boolean).map(link).join('')}</div>${f.events?.map(e=>`<small>${esc(e)}</small>`).join('')||''}${childHtml?`<ul class="descendants">${childHtml}</ul>`:'<p class="muted">Nema upisane djece.</p>'}</details>`};
 }
 const roots=rootFamilies(data);
 const rootParents=new Set(roots.flatMap(f=>f.parents));
 const extraRoots=data.families.filter(f=>!roots.includes(f)&&f.parents.some(id=>rootParents.has(id)));
 const trees=[...roots,...extraRoots].map(f=>visited.has(f.id)?'':family(f,0,new Set())).map(s=>typeof s==='string'?s:s.html).join('');
 const q=query.trim().toLocaleLowerCase();
 const results=q?data.people.filter(p=>displayName(p,data).toLocaleLowerCase().includes(q)).sort((a,b)=>displayName(a,data).localeCompare(displayName(b,data),'hr')).map(link).join(''):'';
 return `<section><h2>Pronađi osobu</h2><form method="get" action="${esc(base)}"><label>Prezime ili ime<input name="q" value="${esc(query)}" maxlength="160" placeholder="Pretraži ovu porodičnu granu"></label><button>Traži</button> <a href="${esc(base)}">Prikaži granu</a></form>${q?`<div class="search-results">${results||'<p>Nema pronađenih osoba.</p>'}</div>`:''}</section><section class="family-tree" id="family-tree"><h2>Porodična grana</h2><p>Otvori granu strelicom uz porodicu. Odaberi osobu da otvoriš njene podatke.</p>${review?'<p><span class="change-badge">Izmjene u grani</span> označava porodicu koja sadrži promjene. Odaberi označenu osobu ili porodicu za detalje.</p>':''}${trees}</section>`;
}
module.exports={displayName,rootFamilies,navigation,personPath,startingFamilies};
