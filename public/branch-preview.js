/* Review exactly the changes accepted by the save mapper, grouped by family. */
(()=>{
 const boot=JSON.parse(document.getElementById('branch-boot').textContent);
 const box=document.getElementById('previewBox'),result=document.getElementById('result'),send=document.getElementById('sendBtn'),status=document.getElementById('sendStatus');
 status.setAttribute('role','status');
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;};
 let requestId=0;
 box.querySelector('h2').textContent='Provjeri izmjene prije čuvanja';
 box.querySelector(':scope > .subtle').textContent='Ovo su samo nove izmjene u ovom unosu. Sačuvat će se u porodičnom linku, za pregled administratora.';
 send.textContent='Sačuvaj ove izmjene';document.getElementById('backBtn').textContent='Nastavi uređivanje';
 const back=document.getElementById('backBtn'),originalBack=back.onclick;
 back.onclick=()=>{requestId++;document.body.classList.remove('branch-preview-open');currentPreview=null;originalBack();};
 document.addEventListener('branch:saved',()=>{requestId++;document.body.classList.remove('branch-preview-open');currentPreview=null;});
 const save=send.onclick;send.onclick=async()=>{
  if(send.disabled||!currentPreview)return;back.disabled=true;result.querySelectorAll('button').forEach(button=>button.disabled=true);
  try{await save();}finally{back.disabled=false;result.querySelectorAll('button').forEach(button=>button.disabled=false);}
 };
 function correction(target){
  const button=make('button','btn soft preview-correct','Ispravi');button.type='button';button.onclick=()=>{back.onclick();document.dispatchEvent(new CustomEvent('branch:edit-target',{detail:target}));};return button;
 }
 function changeRow(change,added=false){
  const row=make('div','preview-change');row.append(make('strong','',change.label));
  if(added){row.append(make('div','preview-added-value',change.after));return row;}
  const pair=make('div','preview-values');
  for(const [label,value,cls] of [['Bilo',change.before,'preview-before'],['Sada',change.after,'preview-after']]){
   const cell=make('div',cls);cell.append(make('span','preview-value-label',label),make('div','',value||(label==='Bilo'?'Nije bilo podatka':'Podatak se uklanja')));pair.append(cell);
  }
  row.append(pair);return row;
 }
 function render(preview){
  result.replaceChildren();
  if(!preview.hasChanges){result.append(make('p','preview-empty','Nema novih izmjena za čuvanje. Poznati podaci ostaju isti.'));currentPreview=null;return;}
  const summary=make('div','preview-totals');
  result.append(make('p','subtle','Podatke dopunjava: '+currentPreview.submittedBy));
  for(const [key,label] of [['peopleChanged','Osobe s izmjenama'],['peopleAdded','Nove osobe'],['familiesAdded','Nove porodice'],['linksRemoved','Uklonjene veze']])if(preview.counts[key])summary.append(make('span','',label+': '+preview.counts[key]));
  result.append(summary);
  const newPeople=new Set(preview.groups.flatMap(group=>group.items.filter(item=>item.kind==='new-person').map(item=>item.personId)));
  const childFamilies=new Map();for(const group of preview.groups)for(const item of group.items)for(const id of item.addedChildIds||[])childFamilies.set(id,group.label);
  for(const group of preview.groups){
   const section=make('section','preview-family');section.append(make('h3','','Porodica: '+group.label));
   if(group.trail)section.append(make('p','preview-trail',group.trail));
   for(const original of group.items){
    const item={...original,addedChildren:(original.addedChildren||[]).filter((_,i)=>!newPeople.has(original.addedChildIds?.[i]))};
    if(item.kind==='family'&&!item.isNew&&!item.changes.length&&!item.addedChildren.length&&!item.removedChildren?.length&&!item.removedParents?.length)continue;
    const card=make('article','preview-item'),head=make('div','preview-item-head');
    const title=make('div');title.append(make('span','preview-kind',item.kind==='new-person'?'Nova osoba':item.kind==='changed-person'?'Izmijenjeni podaci':item.isNew?'Nova porodica':'Porodične veze i podaci'),make('h4','',item.name));
    head.append(title,correction(item.target));card.append(head);
    if(item.kind==='new-person'&&childFamilies.has(item.personId)){
     card.append(make('p','subtle','Dodaješ dijete u porodicu: '+childFamilies.get(item.personId)));
     const cancel=make('button','btn soft preview-cancel','Odustani od dodavanja');cancel.type='button';
     cancel.onclick=()=>{back.onclick();document.dispatchEvent(new CustomEvent('branch:remove-target',{detail:item.target}));};card.append(cancel);
    }
    for(const change of item.changes)card.append(changeRow(change,item.kind==='new-person'||item.isNew));
    for(const [key,label,cls] of [['addedChildren','Dodano dijete','preview-added-link'],['removedChildren','Dijete se uklanja iz ove porodice','preview-removed-link'],['removedParents','Partner / roditelj se uklanja iz ove porodice','preview-removed-link']])for(const person of item[key]||[])card.append(make('p',cls,label+': '+person));
    if(item.removedChildren?.length||item.removedParents?.length)card.append(make('p','subtle','Uklanja se porodična veza. Osoba i njeni ostali podaci ostaju u ovom linku.'));
    section.append(card);
   }
   if(section.querySelector('.preview-item'))result.append(section);
  }
  send.disabled=false;
 }
 show=async payload=>{
  const id=++requestId;currentPreview=structuredClone(payload);send.disabled=true;status.textContent='';
  result.replaceChildren(make('p','','Pripremam pregled izmjena…'));box.style.display='block';document.getElementById('receiptBox').style.display='none';document.body.classList.add('branch-preview-open');box.scrollIntoView({behavior:'smooth',block:'start'});
  try{
   const response=await fetch(boot.base+'/form-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf:boot.csrf,revision:document.querySelector('#familyForm').dataset.revision||boot.revision,personId:boot.personId,familyId:document.querySelector('#familyForm').dataset.familyId??boot.familyId,payload:currentPreview})});
   const preview=await response.json().catch(()=>({error:'Pregled nije dostupan. Vrati se na unos i pokušaj ponovo.'}));if(id!==requestId)return;
   if(!response.ok||typeof preview.hasChanges!=='boolean'||!Array.isArray(preview.groups))throw Error(preview.error||'Pregled nije pripremljen. Pokušaj ponovo.');render(preview);
  }catch(error){if(id!==requestId)return;currentPreview=null;result.replaceChildren(make('p','preview-error','Izmjene nisu sačuvane. Unos je zadržan; možeš se vratiti na uređivanje.'));status.textContent=error.message;}
 };
})();
