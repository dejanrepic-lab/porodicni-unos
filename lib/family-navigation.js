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
function navigation(data,base,selected='',query=''){
 const people=new Map(data.people.map(p=>[p.id,p]));
 const familiesByParent=new Map();
 for(const f of data.families)for(const id of f.parents){if(!familiesByParent.has(id))familiesByParent.set(id,[]);familiesByParent.get(id).push(f);}
 const link=p=>`<a class="person-link ${p.id===selected?'selected':''}" href="${esc(base)}?person=${encodeURIComponent(p.id)}#person-editor"><strong>${esc(displayName(p,data))}</strong><small>${esc([p.birth&&`rođ. ${p.birth}`,p.death&&`umr. ${p.death}`].filter(Boolean).join(' · '))}</small></a>`;
 const visited=new Set();
 function family(f,depth,path){
  if(visited.has(f.id))return `<p class="muted">Porodica je prikazana u drugoj grani.</p>`;
  visited.add(f.id);
  const ancestors=new Set(path);ancestors.add(f.id);
  let contains=f.parents.includes(selected)||f.children.includes(selected);
  const childHtml=f.children.map(id=>{const p=people.get(id);if(!p)return '';
   const subs=(familiesByParent.get(id)||[]).filter(g=>!ancestors.has(g.id)).map(g=>family(g,depth+1,ancestors));
   if(subs.some(s=>s.contains))contains=true;
   return `<li>${link(p)}${subs.map(s=>typeof s==='string'?s:s.html).join('')}</li>`;
  }).join('');
  const title=f.parents.map(id=>displayName(people.get(id),data)).join(' & ')||'Porodica';
  return {contains,html:`<details class="family-node" ${depth===0||contains?'open':''}><summary>${esc(title)} <small>· ${f.children.length} djece</small></summary><div class="couple">${f.parents.map(id=>people.get(id)).filter(Boolean).map(link).join('')}</div>${f.events?.map(e=>`<small>${esc(e)}</small>`).join('')||''}${childHtml?`<ul class="descendants">${childHtml}</ul>`:'<p class="muted">Nema upisane djece.</p>'}</details>`};
 }
 const trees=rootFamilies(data).map(f=>family(f,0,new Set())).map(s=>typeof s==='string'?s:s.html).join('');
 const q=query.trim().toLocaleLowerCase();
 const results=q?data.people.filter(p=>displayName(p,data).toLocaleLowerCase().includes(q)).sort((a,b)=>displayName(a,data).localeCompare(displayName(b,data),'hr')).map(link).join(''):'';
 return `<section><h2>Pronađi osobu</h2><form method="get" action="${esc(base)}"><label>Prezime ili ime<input name="q" value="${esc(query)}" maxlength="160" placeholder="Pretraži ovu porodičnu granu"></label><button>Traži</button> <a href="${esc(base)}">Prikaži granu</a></form>${q?`<div class="search-results">${results||'<p>Nema pronađenih osoba.</p>'}</div>`:''}</section><section class="family-tree"><h2>Porodična grana</h2><p>Otvori granu strelicom uz porodicu. Odaberi osobu da otvoriš njene podatke.</p>${trees}</section>`;
}
module.exports={displayName,rootFamilies,navigation};
