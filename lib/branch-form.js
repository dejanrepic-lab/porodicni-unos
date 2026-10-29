const fs=require('fs');
const {versionPublicAssets}=require('./public-assets');
const path=require('path');
const crypto=require('crypto');
const express=require('express');
const {branchPreview}=require('./branch-preview');
const {rootFamilies,givenName}=require('./family-navigation');
const {progressStatus}=require('./family-review');
const text=x=>String(x??'').trim().slice(0,10000);
const keys=['firstName','lastName','maidenName','nickname','birthDate','birthPlace','deathDate','deathPlace'];
function personFields(person,data){
 if(!person)return {};
 const original=data.original?.people?.find(p=>p.handle===person.id)?.primary_name;
 let firstName=person.firstName,lastName=person.lastName;
 if(firstName===undefined||lastName===undefined||[lastName,firstName].filter(Boolean).join(', ')!==person.name){
  const split=person.name.indexOf(',');
  if(split>=0){lastName=person.name.slice(0,split).trim();firstName=person.name.slice(split+1).trim();}
  else if(original && [original.first_name,(original.surname_list||[]).map(s=>s.surname).join(' ')].filter(Boolean).join(' ')===person.name){firstName=original.first_name||'';lastName=(original.surname_list||[]).map(s=>s.surname).join(' ');}
  else {firstName=person.name;lastName='';}
 }
 return {_id:person.id,firstName,lastName,maidenName:person.maidenName||'',nickname:person.nickname||'',notes:person.notes||'',birthDate:person.birth||'',birthPlace:person.birthPlace||'',deathDate:person.death||'',deathPlace:person.deathPlace||''};
}
function scopeFor(data,personId,familyId=''){
 const person=data.people.find(p=>p.id===personId);if(!person)throw Error('Osoba nije pronađena.');
 const family=familyId==='new'?null:familyId?data.families.find(f=>f.id===familyId && f.parents.includes(personId)):data.families.find(f=>f.parents.includes(personId));
 if(familyId&&familyId!=='new'&&!family)throw Error('Porodica nije pronađena za odabranu osobu.');
 const get=id=>data.people.find(p=>p.id===id);
 const parentIds=family?[personId,...family.parents.filter(id=>id!==personId)]:[personId];
 const nodes=new Set(parentIds),families=new Set(family?[family.id]:[]);
 const payload={type:'porodica',father:personFields(get(parentIds[0]),data),mother:personFields(get(parentIds[1]),data),primaryRelationship:family?.relationship||'',notes:family?.notes||'',source:family?.source||'',children:[]};
 const expanded=new Set(family?[family.id]:[]);
 function project(id){const p=get(id);if(!p)return null;nodes.add(id);if(nodes.size>5000)throw Error('Previše osoba u jednoj grani.');const child={...personFields(p,data),notes:'',personNotes:p.notes||'',spouse:{},children:[]};const own=data.families.find(f=>f.parents.includes(id));
  if(own){child.notes=own.notes||'';child._family=own.id;if(expanded.has(own.id)){child._reference=true;return child;}expanded.add(own.id);families.add(own.id);const partner=own.parents.find(x=>x!==id);if(partner){nodes.add(partner);child.spouse=personFields(get(partner),data);}child.spouse.relationship=own.relationship||'';child.children=own.children.map(project).filter(Boolean);}
  return child;
 }
 payload.children=(family?.children||[]).map(project).filter(Boolean);
 return {person,family,payload,nodes,families};
}
function applyForm(data,personId,familyId,payload){
 if(!payload||payload.type!=='porodica'||!Array.isArray(payload.children)||payload.children.length>1000)throw Error('Neispravan obrazac porodice.');
 const scope=scopeFor(data,personId,familyId),accepted=structuredClone(payload),written=new Map();
 const get=id=>data.people.find(p=>p.id===id);
 function upsert(value,short=false){
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Neispravni podaci osobe.');
  let id=text(value._id),p=id?get(id):null;
  if(id&&(!p||!scope.nodes.has(id)))throw Error('Osoba ne pripada otvorenom obrascu.');
  const values=short?{name:text(value.name),birth:text(value.birthDate),birthPlace:text(value.birthPlace)}:{firstName:text(value.firstName),lastName:text(value.lastName),maidenName:text(value.maidenName),nickname:text(value.nickname),notes:text(value.notes),birth:text(value.birthDate),birthPlace:text(value.birthPlace),death:text(value.deathDate),deathPlace:text(value.deathPlace)};
  const name=short?values.name:[values.lastName,values.firstName].filter(Boolean).join(', ');
  if(!name){if(Object.values(values).some(Boolean))throw Error('Upiši ime osobe kojoj dodaješ podatke.');value._id='';return null;}
  if(!id){id=crypto.randomUUID();p={id,name:'',grampsId:'',events:[],notes:''};data.people.push(p);scope.nodes.add(id);}
  // The browser trims fields. Treat that as unchanged so imported names keep their spelling and order.
  if(!short){const old=personFields(p,data);values.name=p.name&&text(old.firstName)===values.firstName&&text(old.lastName)===values.lastName?p.name:name;}
  if(!short){if(value.maidenName===undefined)values.maidenName=p.maidenName||'';if(value.notes===undefined)values.notes=p.notes||'';}
  const signature=JSON.stringify(values);if(written.has(id)&&written.get(id)!==signature)throw Error('Ista osoba ima različite podatke na dva mjesta u obrascu.');written.set(id,signature);
  Object.assign(p,values);value._id=id;return id;
 }
 function setFamily(id,parents,children,extra){
  parents=parents.filter(Boolean);children=children.filter(Boolean);
  if(new Set([...parents,...children]).size!==parents.length+children.length)throw Error('Osoba ne može biti vlastiti partner ili dijete.');
  let f=id?data.families.find(f=>f.id===id):null;
  if(id&&(!f||!scope.families.has(id)))throw Error('Porodica ne pripada obrascu.');
  if(!parents.length){if(children.length)throw Error('Upiši roditelja prije dodavanja djece.');return null;}
  if(!f){if(!children.length&&parents.length<2&&!extra.relationship&&!extra.notes&&!extra.source)return null;
   if(data.families.some(x=>x.parents.length===parents.length&&parents.every(p=>x.parents.includes(p))))throw Error('Porodica ovog para već postoji. Otvori postojeću porodicu.');
   f={id:crypto.randomUUID(),events:[]};data.families.push(f);scope.families.add(f.id);
  }
  Object.assign(f,{parents,children,...extra});return f.id;
 }
 // Root slots are bound to their prefilled identities, not to editable array positions.
 for(const [key,index] of [['father',0],['mother',1]]){const expected=scope.payload[key]?._id||'';if(text(accepted[key]?._id)!==String(expected||''))throw Error('Identitet roditelja je promijenjen. Osvježi obrazac.');}
 const father=upsert(accepted.father||{}),mother=upsert(accepted.mother||{});
 if(![father,mother].includes(personId))throw Error('Odabrana osoba mora ostati u ovoj porodici.');
 let count=0;
 function applyChild(child){
  if(++count>5000)throw Error('Previše osoba u jednom unosu.');
  const personValue={...child};delete personValue.notes;if(child.personNotes!==undefined)personValue.notes=child.personNotes;
  const short=child.firstName===undefined&&child.lastName===undefined&&child.name!==undefined;
  const childId=upsert(personValue,short);child._id=personValue._id;
  if(!childId){if(text(child.notes)||keys.some(k=>text(child.spouse?.[k]))||(child.children||[]).length)throw Error('Upiši ime djeteta prije nastavka njegove porodice.');return null;}
  if(child._reference)return childId;
  // Older saved entries used name-only grandchildren and had no family editor there.
  if(short&&!Object.hasOwn(child,'children')&&!Object.hasOwn(child,'spouse'))return childId;
  const spouse=child.spouse||(child.spouse={}),partner=upsert(spouse);
  if(!Array.isArray(child.children)||child.children.length>1000)throw Error('Neispravan spisak djece.');
  const descendants=child.children.map(applyChild).filter(Boolean);
  child._family=setFamily(text(child._family),[childId,partner],descendants,{relationship:text(spouse.relationship),notes:text(child.notes)})||'';
  return childId;
 }
 const childIds=accepted.children.map(applyChild).filter(Boolean);
 const root=setFamily(scope.family?.id,[father,mother],childIds,{relationship:text(accepted.primaryRelationship),notes:text(accepted.notes),source:text(accepted.source)});
 if(data.people.length>5000)throw Error('Previše osoba u jednoj grani.');
 return {payload:accepted,familyId:root||(familyId==='new'?'new':'')};
}
function mountBranchForm(app,{db,getLink,publicCsrf,postGuard}){
 const original=fs.readFileSync(path.join(__dirname,'../public/index.html'),'utf8');
 app.get('/branch/:token/form',getLink,(req,res)=>{
  try{const r=req.link,data=JSON.parse(r.working),personId=String(req.query.person||''),scope=scopeFor(data,personId,String(req.query.family||''));
   db.prepare('UPDATE family_links SET last_seen=? WHERE id=?').run(new Date().toISOString(),r.id);
   const boot={csrf:publicCsrf(r.token),revision:r.revision,personId,familyId:scope.family?.id||(req.query.family==='new'?'new':''),originalFamilies:JSON.parse(r.baseline).families.map(f=>f.id),originalPeople:JSON.parse(r.baseline).people.map(p=>p.id),payload:scope.payload,base:`/branch/${r.token}`,families:data.families.filter(f=>f.parents.includes(personId)).map(f=>({id:f.id,label:f.parents.map(id=>data.people.find(p=>p.id===id)?.name||'Nepoznato').join(' i ')}))};
   const root=rootFamilies(data)[0],parentFamily=data.families.find(f=>f.children.includes(personId));
   boot.isStartFamily=root?scope.family?.id===root.id:personId===data.people[0]?.id;
   boot.parentFamily=parentFamily?.parents.length?{label:parentFamily.parents.map(id=>givenName(data.people.find(p=>p.id===id))).join(' i '),url:`/branch/${r.token}/form?person=${encodeURIComponent(parentFamily.parents[0])}&family=${encodeURIComponent(parentFamily.id)}`}:null;
   const previous=data.families.find(f=>f.id===req.query.returnFamily&&f.parents.includes(personId))||data.families.find(f=>f.parents.includes(personId));
   boot.cancelUrl=boot.base+'/form?person='+encodeURIComponent(personId)+(previous?'&family='+encodeURIComponent(previous.id):'');
   boot.progress=progressStatus({...r,last_seen:r.last_seen||new Date().toISOString()},db.prepare('SELECT * FROM family_link_progress WHERE link_id=?').get(r.id));
   boot.families=boot.families.map(f=>({...f,label:data.families.find(x=>x.id===f.id).parents.map(id=>givenName(data.people.find(p=>p.id===id))).join(' i ')}));
   const json=JSON.stringify(boot).replace(/</g,'\\u003c');
   const html=original.replace('<!-- BRANCH_FORM_BOOT -->',`<script id="branch-boot" type="application/json">${json}</script>`).replace('</head>','<link rel="stylesheet" href="/branch-review.css"></head>').replace('</body>','<script src="/branch-form.js"></script><script src="/branch-preview.js"></script><script src="/branch-review.js"></script><script src="/branch-workflow.js"></script></body>');
   res.send(versionPublicAssets(html));
  }catch(e){res.status(400).send('Obrazac nije otvoren: '+String(e.message));}
 });
 const handle=previewOnly=>(req,res)=>{
  try{const r=req.link;if(req.body.csrf!==publicCsrf(r.token))return res.status(403).json({error:'Osvježi obrazac prije čuvanja.'});
   if(String(r.revision)!==String(req.body.revision))return res.status(409).json({error:'Neko je u međuvremenu sačuvao izmjene. Sačuvaj svoje podatke prije osvježavanja obrasca.'});
   const payload=req.body.payload,editor=text(payload?.submittedBy).slice(0,160);if(!editor)throw Error('Upiši ko dopunjava podatke.');
   const data=JSON.parse(r.working),result=applyForm(data,text(req.body.personId),text(req.body.familyId),payload);
   if(previewOnly)return res.json(branchPreview(JSON.parse(r.working),data,result));
   db.transaction(()=>{const changed=db.prepare('UPDATE family_links SET working=?,revision=revision+1,updated=? WHERE id=? AND revision=? AND active=1').run(JSON.stringify(data),new Date().toISOString(),r.id,r.revision);if(changed.changes!==1)throw Error('Podaci su promijenjeni.');db.prepare('INSERT INTO family_link_history(link_id,previous,changed_by,created) VALUES(?,?,?,?)').run(r.id,r.working,editor,new Date().toISOString());})();
   res.json({...result,revision:r.revision+1});
  }catch(e){res.status(400).json({error:String(e.message)});}
 };
 app.post('/branch/:token/form-preview',express.json({limit:'500kb'}),postGuard,getLink,handle(true));
 app.post('/branch/:token/form-save',express.json({limit:'500kb'}),postGuard,getLink,handle(false));
}
module.exports={mountBranchForm,personFields,scopeFor,applyForm};
