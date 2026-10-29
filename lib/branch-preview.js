const {compareBranch,fields}=require('./family-review');
const name=p=>p?([p.firstName,p.lastName].filter(Boolean).join(' ')||String(p.name||'').split(',').reverse().map(s=>s.trim()).join(' ')):'Nepoznata osoba';
const inputKeys={name:'firstName',birth:'birthDate',death:'deathDate'};
// Called on the same accepted, in-memory graph as a save; never mutates storage.
function branchPreview(before,after,result){
 const diff=compareBranch(before,after),people=new Map([...before.people,...after.people].map(p=>[p.id,p]));
 const families=new Map([...before.families,...after.families].map(f=>[f.id,f]));
 const label=f=>f?.parents.map(id=>name(people.get(id))).join(' i ')||'Početna porodica';
 const locations=new Map(),familyLocations=new Map(),root=result.familyId;
 familyLocations.set(root,{target:{role:'family',path:[]},trail:'Početna porodica'});
 const remember=(id,entry)=>{if(id&&!locations.has(id))locations.set(id,entry);};
 remember(result.payload.father?._id,{family:root,target:{role:'father',path:[]}});
 remember(result.payload.mother?._id,{family:root,target:{role:'mother',path:[]}});
 const stack=result.payload.children.map((node,i)=>({node,path:[i],family:root,trail:[label(families.get(root))]})).reverse();
 while(stack.length){
  const {node,path,family,trail}=stack.pop(),own=node._family||family;
  remember(node._id,{family:own,target:{role:'person',path}});
  if(node._reference)continue;
  remember(node.spouse?._id,{family:own,target:{role:'partner',path}});
  if(node._family&&!familyLocations.has(own))familyLocations.set(own,{target:{role:'family',path},trail:trail.join(' → ')});
  for(let i=(node.children||[]).length-1;i>=0;i--)stack.push({node:node.children[i],path:[...path,i],family:own,trail:[...trail,name(people.get(node._id))]});
 }
 const groups=new Map();
 function group(id){
  if(!groups.has(id)){const f=families.get(id),location=familyLocations.get(id);groups.set(id,{id,label:label(f),trail:location?.trail||'U ovoj porodičnoj grani',items:[]});}
  return groups.get(id);
 }
 const targetFor=(location,key)=>({...location?.target,field:key==='notes'&&location?.target.role==='person'?'personNotes':inputKeys[key]||key});
 for(const entry of diff.changedPeople){
  const location=locations.get(entry.person.id)||{family:root},first=entry.changes[0];
  const key=Object.keys(fields).find(k=>fields[k]===first?.label);
  group(location.family).items.push({kind:'changed-person',name:name(entry.person),changes:entry.changes.map(c=>({...c,label:c.label===fields.name?'Ime i prezime':c.label})),target:targetFor(location,key)});
 }
 for(const person of diff.addedPeople){
  const location=locations.get(person.id)||{family:root};
  group(location.family).items.push({kind:'new-person',personId:person.id,name:name(person),changes:Object.entries(fields).filter(([key])=>key!=='name'&&person[key]).map(([key,label])=>({label,before:'',after:String(person[key])})),target:targetFor(location,'firstName')});
 }
 function familyItem(f){
  const g=group(f.id);let item=g.items.find(i=>i.kind==='family');
  if(!item){item={kind:'family',name:'Podaci i veze porodice',changes:[],addedChildren:[],removedChildren:[],removedParents:[],target:familyLocations.get(f.id)?.target||{role:'family',path:[]}};g.items.push(item);}return item;
 }
 for(const {family,changes} of diff.changedFamilies){const item=familyItem(family);item.changes.push(...changes);const first=changes[0];item.target={...item.target,field:{'Vrsta veze':item.target.path.length?'relationship':'primaryRelationship','Napomene porodice':'notes','Izvor':'source'}[first?.label]};}
 for(const family of diff.addedFamilies){const item=familyItem(family);item.isNew=true;item.name='Nova porodica';item.changes.push({label:'Roditelji / partneri',before:'',after:family.parents.map(id=>name(people.get(id))).join(' i ')});item.addedChildIds=family.children;item.addedChildren=family.children.map(id=>name(people.get(id)));for(const [key,fieldLabel] of [['relationship','Vrsta veze'],['notes','Napomena porodice'],['source','Izvor']])if(family[key])item.changes.push({label:fieldLabel,before:'',after:String(family[key])});}
 for(const {family,ids} of diff.addedChildren){const item=familyItem(family);item.addedChildIds=ids;item.addedChildren=ids.map(id=>name(people.get(id)));}
 for(const {family,children,parents} of diff.removedLinks){const item=familyItem(family);item.removedChildren=children.map(id=>name(people.get(id)));item.removedParents=parents.map(id=>name(people.get(id)));}
 return {hasChanges:diff.hasChanges,counts:{peopleChanged:diff.changedPeople.length,peopleAdded:diff.addedPeople.length,familiesAdded:diff.addedFamilies.length,linksRemoved:diff.removedLinks.reduce((sum,x)=>sum+x.children.length+x.parents.length,0)},groups:Array.from(groups.values())};
}
module.exports={branchPreview};
