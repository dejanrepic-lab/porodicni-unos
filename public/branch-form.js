/* Adapter for the existing family form. The original form, cards and preview stay shared. */
(()=>{
 const boot=JSON.parse(document.getElementById('branch-boot').textContent);
 let revision=boot.revision,familyId=boot.familyId,rootIds={},returnY=0;
 const form=document.getElementById('familyForm');
 const banner=document.getElementById('editBanner');
 banner.style.display='block';banner.textContent='Uređuješ kopiju porodične grane. Prvo pregledaj unos, zatim sačuvaj izmjene u ovom linku.';
 const nav=document.createElement('nav');nav.className='actions';
 const tree=document.createElement('a');tree.className='btn soft';tree.href=boot.base+'?focus='+encodeURIComponent(boot.personId)+'#'+encodeURIComponent('tree-person-'+boot.personId);tree.textContent='← Stablo kod ove osobe';nav.appendChild(tree);
 for(const f of boot.families){const a=document.createElement('a');a.className='btn soft';a.href=boot.base+'/form?person='+encodeURIComponent(boot.personId)+'&family='+encodeURIComponent(f.id);a.textContent=f.label;nav.appendChild(a);}
 const newFamily=document.createElement('a');newFamily.className='btn soft';newFamily.href=boot.base+'/form?person='+encodeURIComponent(boot.personId)+'&family=new';newFamily.textContent='＋ Nova porodica ove osobe';nav.appendChild(newFamily);
 document.querySelector('.hero').appendChild(nav);
 document.querySelector('.hero h1').textContent='Porodica – pregled i dopuna';
 document.querySelector('.choice').hidden=true;document.querySelector('.choice').style.display='none';
 // Attachments use a separate storage flow and are not silently accepted here.
 document.querySelectorAll('input[type=file]').forEach(input=>{const section=input.closest('.section');if(section){section.hidden=true;section.style.display='none';}input.disabled=true;});
 document.getElementById('draftStatus').hidden=true;
 form.querySelector('[name=submittedBy]').required=true;
 const originalAddChild=addChild;
 addChild=(data={})=>{
  originalAddChild(data);
  const card=children.lastElementChild,actions=card.querySelector(':scope > .actions');
  actions.classList.add('branch-child-actions');
  const details=document.createElement('details'),summary=document.createElement('summary'),field=document.createElement('div'),label=document.createElement('label'),input=document.createElement('textarea');
  details.className='branch-child-notes';field.className='field';summary.textContent='Napomene o djetetu';label.textContent='Napomene osobe';input.id='branch-person-notes-'+card.dataset.index;label.htmlFor=input.id;input.dataset.c='personNotes';input.value=data.personNotes||'';
  field.append(label,input);details.append(summary,field);card.insertBefore(details,actions);
 };
 const initial={...boot.payload,submittedBy:''};fillFamily(initial);updateSenderLabelForEditMode(true);
 for(const [prefix,title] of [['father','Prva osoba'],['mother','Partner / supružnik']]){const section=form.querySelector('[data-prefix='+prefix+']').closest('.section');section.dataset.baseTitle=title;section.querySelector('h2').textContent=title;const button=section.querySelector('.section-toggle');if(button)button.textContent='Završi unos';}
 for(const prefix of ['father','mother']){const grid=form.querySelector('[data-prefix='+prefix+']');for(const [key,label] of [['maidenName','Djevojačko prezime'],['notes','Napomene osobe']]){if(form.querySelector('[name='+prefix+'_'+key+']'))continue;const wrap=document.createElement('div');wrap.className='field';const title=document.createElement('label');title.textContent=label;const input=document.createElement(key==='notes'?'textarea':'input');input.name=prefix+'_'+key;input.value=initial[prefix]?.[key]||'';wrap.append(title,input);grid.appendChild(wrap);}}
 filesReport=()=>'';
 const originalReport=familyReport;familyReport=payload=>{const notes=[['Prva osoba',payload.father],['Partner / supružnik',payload.mother],...payload.children.map(c=>[[c.firstName,c.lastName].filter(Boolean).join(' ')||'Dijete',{notes:c.personNotes}])].filter(([,p])=>p?.notes);return originalReport(payload)+(notes.length?'<h3>Napomene o osobama</h3>'+notes.map(([label,p])=>row(label,p.notes)).join(''):'')+(payload.father?.maidenName?row('Djevojačko prezime prve osobe',payload.father.maidenName):'');};
 const removal=document.createElement('details');removal.className='section';const removalSummary=document.createElement('summary');removalSummary.textContent='Ukloni porodicu iz ove kopije';removal.appendChild(removalSummary);
 const removalText=document.createElement('p');removalText.textContent='Uklanjaju se veze ove porodice. Osobe ostaju dostupne u porodičnom linku.';removal.appendChild(removalText);
 const removalForm=document.createElement('form');removalForm.method='post';removalForm.action=boot.base+'/remove-family';
 const removalFields={};for(const [name,value] of Object.entries({csrf:boot.csrf,revision,family:familyId,person:boot.personId,editor:''})){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;removalForm.appendChild(input);removalFields[name]=input;}
 removalForm.addEventListener('submit',event=>{const editor=form.querySelector('[name=submittedBy]');if(!editor.value.trim()){event.preventDefault();editor.reportValidity();editor.focus();return;}removalFields.editor.value=editor.value.trim();});
 const removalLabel=document.createElement('label'),confirm=document.createElement('input');confirm.type='checkbox';confirm.name='confirm';confirm.value='yes';confirm.required=true;removalLabel.append(confirm,document.createTextNode(' Potvrđujem uklanjanje porodice.'));removalForm.appendChild(removalLabel);
 const deleteButton=document.createElement('button');deleteButton.type='submit';deleteButton.className='btn dark';deleteButton.textContent='Ukloni porodicu';deleteButton.style.background='#b42318';removalForm.appendChild(deleteButton);removal.appendChild(removalForm);form.after(removal);
 const personRemoval=document.createElement('details');personRemoval.className='section';personRemoval.hidden=boot.originalPeople.includes(boot.personId);
 const personSummary=document.createElement('summary');personSummary.textContent='Ukloni ovu osobu iz kopije';personRemoval.appendChild(personSummary);
 const personText=document.createElement('p');personText.textContent='Osoba i njene veze uklanjaju se iz ovog linka. Ako je jedini roditelj upisane djece, prvo ispravi njihove porodične veze.';personRemoval.appendChild(personText);
 const personRemovalForm=document.createElement('form');personRemovalForm.method='post';personRemovalForm.action=boot.base+'/remove-person';const personFields={};for(const [name,value] of Object.entries({csrf:boot.csrf,revision,id:boot.personId,editor:''})){const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;personRemovalForm.appendChild(input);personFields[name]=input;}
 const personLabel=document.createElement('label'),personConfirm=document.createElement('input');personConfirm.type='checkbox';personConfirm.name='confirm';personConfirm.value='yes';personConfirm.required=true;personLabel.append(personConfirm,document.createTextNode(' Potvrđujem uklanjanje osobe i njenih veza.'));personRemovalForm.appendChild(personLabel);const personButton=document.createElement('button');personButton.type='submit';personButton.className='btn dark';personButton.textContent='Ukloni osobu';personButton.style.background='#b42318';personRemovalForm.appendChild(personButton);personRemoval.appendChild(personRemovalForm);removal.after(personRemoval);
 personRemovalForm.addEventListener('submit',event=>{const editor=form.querySelector('[name=submittedBy]');if(!editor.value.trim()){event.preventDefault();editor.reportValidity();editor.focus();return;}personFields.editor.value=editor.value.trim();});
 function updateRemoval(){removal.hidden=!familyId||familyId==='new'||boot.originalFamilies.includes(familyId);removalFields.family.value=familyId;removalFields.revision.value=revision;personFields.revision.value=revision;}
 updateRemoval();
 const ownFamilyData=familyData;
 function stamp(payload){
  rootIds={father:payload.father?._id||'',mother:payload.mother?._id||''};
  Array.from(children.children).forEach((card,i)=>{const c=payload.children[i]||{};card.dataset.branchId=c._id||'';card.dataset.branchPartner=c.spouse?._id||'';card.dataset.branchFamily=c._family||'';
   Array.from(card.querySelectorAll('.grandchild')).forEach((row,j)=>row.dataset.branchId=c.children?.[j]?._id||'');
   let link=card.querySelector('.branch-continue');if(!link){link=document.createElement('a');link.className='branch-continue btn soft';card.querySelector('.branch-child-actions').appendChild(link);}link.textContent='Otvori porodicu ovog djeteta';link.hidden=!c._id;link.style.display=c._id?'':'none';link.href=boot.base+'/form?person='+encodeURIComponent(c._id||'');
  });
 }
 stamp(initial);
 familyData=()=>{const payload=ownFamilyData();payload.father._id=rootIds.father;payload.mother._id=rootIds.mother;for(const prefix of ['father','mother'])for(const key of ['maidenName','notes'])payload[prefix][key]=form.querySelector('[name='+prefix+'_'+key+']').value.trim();Array.from(children.children).forEach((card,i)=>{const c=payload.children[i];c._id=card.dataset.branchId||'';c.spouse._id=card.dataset.branchPartner||'';c._family=card.dataset.branchFamily||'';Array.from(card.querySelectorAll('.grandchild')).forEach((row,j)=>c.children[j]._id=row.dataset.branchId||'');});return payload;};
 form.onsubmit=e=>{e.preventDefault();returnY=window.scrollY;show(familyData());};
 document.getElementById('backBtn').onclick=()=>{document.getElementById('previewBox').style.display='none';window.scrollTo(0,returnY);};
 document.getElementById('sendBtn').textContent='Sačuvaj izmjene u linku';
 document.getElementById('sendBtn').onclick=async()=>{
  if(!currentPreview)return;const button=document.getElementById('sendBtn'),status=document.getElementById('sendStatus');button.disabled=true;status.textContent='Čuvam izmjene…';
  try{
   const response=await fetch(boot.base+'/form-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf:boot.csrf,revision,personId:boot.personId,familyId,payload:currentPreview})});
   const result=await response.json().catch(()=>({error:'Link više nije dostupan ili sesija nije važeća. Sačuvaj svoj unos prije osvježavanja.'}));if(!response.ok)throw Error(result.error||'Čuvanje nije uspjelo.');revision=result.revision;familyId=result.familyId;stamp(result.payload);updateRemoval();
   document.getElementById('previewBox').style.display='none';status.textContent='';showToast('Izmjene su sačuvane. Nastavi tamo gdje si stao.');banner.textContent='Sačuvano. Možeš nastaviti unos u ovoj porodici.';window.scrollTo(0,returnY);
  }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
 };
 // Warn before abandoning unsaved edits while changing families or returning to the tree.
 let dirty=false;form.addEventListener('input',()=>dirty=true);form.addEventListener('change',()=>dirty=true);
 form.addEventListener('click',event=>{if(event.target.closest('#addChild,.add-grandchild,.remove,.child-remove'))dirty=true;});
 const send=document.getElementById('sendBtn'),saveHandler=send.onclick;send.onclick=async()=>{const before=revision;await saveHandler();if(revision!==before)dirty=false;};
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 document.title='Porodica – dopuna podataka';document.querySelector('.footer-note').textContent='Porodični link – pregled i dopuna podataka';
})();
