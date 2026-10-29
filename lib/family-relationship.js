// Gramps 6 FamilyRelType: 0 Married, 1 Unmarried, 2 Civil Union, 3 Unknown, 4 Custom.
// https://github.com/gramps-project/gramps/blob/v6.0.8/gramps/gen/lib/familyreltype.py
const labels=['Brak','Vanbračna zajednica','Registrovano partnerstvo','Nepoznato'];
function relationshipText(type){
 if(type==null)return '';
 if(Array.isArray(type))return type[0]===4?String(type[1]||'').trim():relationshipText(type[0]);
 if(typeof type==='object')return type.value===4?String(type.string||'').trim():relationshipText(type.value??type.string);
 if(typeof type==='number')return labels[type]||'';
 if(typeof type==='string'){const text=type.trim();return {'married':labels[0],'unmarried':labels[1],'civil union':labels[2],'unknown':labels[3]}[text.toLowerCase()]||text;}
 return '';
}
function restoreFamilyRelationships(db){
 // Enrich legacy snapshots from their retained import, without attributing an edit to a relative.
 db.transaction(()=>{
  for(const row of db.prepare('SELECT id,baseline,working FROM family_links').all()){
   const baseline=JSON.parse(row.baseline),raw=new Map((baseline.original?.families||[]).map(f=>[f.handle,f]));
   const recover=new Map((baseline.families||[]).filter(f=>!Object.hasOwn(f,'relationship')).flatMap(f=>{const value=relationshipText(raw.get(f.id)?.type);return value?[[f.id,value]]:[];}));
   if(!recover.size)continue;
   const history=db.prepare('SELECT id,previous FROM family_link_history WHERE link_id=?').all(row.id),review=db.prepare('SELECT snapshot FROM family_link_review_snapshots WHERE link_id=?').get(row.id);
   const snapshots=[{kind:'baseline',data:baseline},{kind:'working',data:JSON.parse(row.working)},...history.map(h=>({kind:'history',id:h.id,data:JSON.parse(h.previous)})),...(review?[{kind:'review',data:JSON.parse(review.snapshot)}]:[])];
   // A value anywhere in the editing history means a later empty value may be intentional.
   const edited=new Set(snapshots.filter(s=>s.kind!=='baseline').flatMap(s=>(s.data.families||[]).filter(f=>String(f.relationship||'').trim()).map(f=>f.id)));
   for(const snapshot of snapshots){
    let changed=false;
    for(const family of snapshot.data.families||[])if(recover.has(family.id)&&(!Object.hasOwn(family,'relationship')||(family.relationship===''&&!edited.has(family.id)))){family.relationship=recover.get(family.id);changed=true;}
    if(!changed)continue;const json=JSON.stringify(snapshot.data);
    if(snapshot.kind==='baseline')db.prepare('UPDATE family_links SET baseline=? WHERE id=?').run(json,row.id);
    else if(snapshot.kind==='working')db.prepare('UPDATE family_links SET working=? WHERE id=?').run(json,row.id);
    else if(snapshot.kind==='history')db.prepare('UPDATE family_link_history SET previous=? WHERE id=?').run(json,snapshot.id);
    else db.prepare('UPDATE family_link_review_snapshots SET snapshot=? WHERE link_id=?').run(json,row.id);
   }
  }
 })();
}
module.exports={relationshipText,restoreFamilyRelationships};
