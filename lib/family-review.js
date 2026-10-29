const fields = {name:'Prezime, ime', birth:'Datum rođenja', birthPlace:'Mjesto rođenja', death:'Datum smrti', deathPlace:'Mjesto smrti', notes:'Napomene / izvor informacije',nickname:'Nadimak',maidenName:'Djevojačko prezime'};
const value = v => String(v ?? '');
function compareBranch(base, current) {
  const oldPeople=new Map(base.people.map(p=>[p.id,p]));
  const oldFamilies=new Map(base.families.map(f=>[f.id,f]));
  const addedPeople=current.people.filter(p=>!oldPeople.has(p.id));
  const currentPeople=new Set(current.people.map(p=>p.id));
  const removedPeople=base.people.filter(p=>!currentPeople.has(p.id));
  const changedPeople=current.people.flatMap(p=>{
    const old=oldPeople.get(p.id); if(!old)return [];
    const changes=Object.entries(fields).filter(([key])=>value(old[key])!==value(p[key])).map(([key,label])=>({label, before:value(old[key]), after:value(p[key])}));
    return changes.length?[{person:p,changes}]:[];
  });
  const addedFamilies=current.families.filter(f=>!oldFamilies.has(f.id));
  const addedChildren=current.families.flatMap(f=>{const old=oldFamilies.get(f.id);if(!old)return [];const ids=f.children.filter(id=>!old.children.includes(id));return ids.length?[{family:f,ids}]:[];});
  const currentFamilyIds=new Set(current.families.map(f=>f.id));
  const removedFamilies=base.families.filter(f=>!currentFamilyIds.has(f.id));
  const removedLinks=current.families.flatMap(f=>{const old=oldFamilies.get(f.id);if(!old)return [];const children=old.children.filter(id=>!f.children.includes(id));const parents=old.parents.filter(id=>!f.parents.includes(id));return children.length||parents.length?[{family:f,children,parents}]:[];});
  const changedFamilies=current.families.flatMap(f=>{const old=oldFamilies.get(f.id);if(!old)return [];const changes=['relationship','notes','source'].filter(k=>value(old[k])!==value(f[k])).map(k=>({label:{relationship:'Vrsta veze',notes:'Napomene porodice',source:'Izvor'}[k],before:value(old[k]),after:value(f[k])}));const parents=f.parents.filter(id=>!old.parents.includes(id));if(parents.length)changes.push({label:'Dodani roditelji / partneri',before:old.parents.map(id=>base.people.find(p=>p.id===id)?.name||'Nepoznato').join(', '),after:f.parents.map(id=>current.people.find(p=>p.id===id)?.name||'Nepoznato').join(', ')});return changes.length?[{family:f,changes}]:[];});
  return {changedFamilies,addedPeople,changedPeople,addedFamilies,addedChildren,removedPeople,removedFamilies,removedLinks,hasChanges:Boolean(changedFamilies.length||addedPeople.length||changedPeople.length||addedFamilies.length||addedChildren.length||removedPeople.length||removedFamilies.length||removedLinks.length)};
}
function progressStatus(link, progress) {
  if(progress?.reviewed_revision===link.revision)return 'Pregledano';
  if(progress?.submitted_revision===link.revision)return 'Završeno — čeka pregled';
  if(!progress&&link.refreshed_at&&link.baseline===link.working)return link.last_seen?'Otvoren, bez novih izmjena':'Spreman za nove dopune';
  if(link.revision>0)return 'U toku';
  return link.last_seen?'Otvoren, bez izmjena':'Još nije otvoren';
}
module.exports={fields,compareBranch,progressStatus};
