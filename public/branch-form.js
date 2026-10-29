/* Adapter for the existing family form. The original form, cards and preview stay shared. */
(()=>{
 const boot=JSON.parse(document.getElementById('branch-boot').textContent);
 let revision=boot.revision,familyId=boot.familyId,rootIds={},returnY=0;
 const form=document.getElementById('familyForm');
 const banner=document.getElementById('editBanner');
 banner.style.display='block';banner.textContent='Uređuješ kopiju porodične grane. Prvo pregledaj unos, zatim sačuvaj izmjene u ovom linku.';
 const nav=document.createElement('nav');nav.className='actions';
 const tree=document.createElement('a');tree.className='btn soft branch-map-link';tree.href=boot.base+'?map=1&focus='+encodeURIComponent(boot.personId)+'#'+encodeURIComponent('tree-person-'+boot.personId);tree.textContent='Mapa cijele grane';nav.appendChild(tree);
 if(boot.isStartFamily===false){const home=document.createElement('a');home.className='btn soft';home.href=boot.base;home.textContent='Početna porodica';nav.prepend(home);}
 if(boot.parentFamily){const parent=document.createElement('a');parent.className='btn soft';parent.href=boot.parentFamily.url;parent.textContent='Roditeljska porodica: '+boot.parentFamily.label;nav.appendChild(parent);}
 for(const f of boot.families){if(f.id===familyId)continue;const a=document.createElement('a');a.className='btn soft';a.href=boot.base+'/form?person='+encodeURIComponent(boot.personId)+'&family='+encodeURIComponent(f.id);a.textContent='Druga porodica: '+f.label;nav.appendChild(a);}
 document.querySelector('.hero').appendChild(nav);
 document.querySelector('.hero h1').textContent='Porodica – pregled i dopuna';
 document.querySelector('.choice').hidden=true;document.querySelector('.choice').style.display='none';
 // Example names and dates can be mistaken for imported data in a prefilled branch.
 form.querySelectorAll('[placeholder]').forEach(field=>field.removeAttribute('placeholder'));
 // Attachments use a separate storage flow and are not silently accepted here.
 document.querySelectorAll('input[type=file]').forEach(input=>{const section=input.closest('.section');if(section){section.hidden=true;section.style.display='none';}input.disabled=true;});
 document.getElementById('draftStatus').hidden=true;
 form.querySelector('[name=submittedBy]').required=true;
 const initial={...boot.payload,submittedBy:''};fillFamily(initial);updateSenderLabelForEditMode(true);
 for(const [prefix,title] of [['father','Prva osoba'],['mother','Partner / supružnik']]){const section=form.querySelector('[data-prefix='+prefix+']').closest('.section');section.dataset.baseTitle=title;section.querySelector('h2').textContent=title;const button=section.querySelector('.section-toggle');if(button)button.textContent='Završi unos';}
 for(const prefix of ['father','mother']){const grid=form.querySelector('[data-prefix='+prefix+']');for(const [key,label] of [['maidenName','Djevojačko prezime'],['notes','Napomene osobe']]){if(form.querySelector('[name='+prefix+'_'+key+']'))continue;const wrap=document.createElement('div');wrap.className='field';const title=document.createElement('label');title.textContent=label;const input=document.createElement(key==='notes'?'textarea':'input');input.name=prefix+'_'+key;input.value=initial[prefix]?.[key]||'';wrap.append(title,input);grid.appendChild(wrap);}}
 const partnerAction=document.createElement('details');partnerAction.className='branch-other-partner';
 const partnerSummary=document.createElement('summary');partnerSummary.textContent='Drugi partner / druga veza';partnerAction.appendChild(partnerSummary);
 const partnerHint=document.createElement('p');partnerHint.textContent='Koristi samo ako ova osoba ima još jednog partnera. Otvara se zaseban unos za tu vezu i njihovu djecu.';partnerAction.appendChild(partnerHint);
 const partnerActions=document.createElement('div');partnerActions.className='actions';const newPartner=document.createElement('a');newPartner.className='btn soft';newPartner.href=boot.base+'/form?person='+encodeURIComponent(boot.personId)+'&family=new&returnFamily='+encodeURIComponent(familyId||'');newPartner.textContent='＋ Dodaj drugog partnera';partnerActions.appendChild(newPartner);partnerAction.appendChild(partnerActions);
 const firstPersonSection=form.querySelector('[data-prefix=father]').closest('.section');firstPersonSection.insertBefore(partnerAction,firstPersonSection.querySelector(':scope > .section-toggle'));
 function updatePartnerAction(payload){partnerAction.hidden=!familyId||familyId==='new'||!payload.mother?._id;}
 updatePartnerAction(initial);
 filesReport=()=>'';
 const originalReport=familyReport;familyReport=payload=>{const notes=[['Prva osoba',payload.father],['Partner / supružnik',payload.mother]].filter(([,p])=>p?.notes);return originalReport(payload)+(notes.length?'<h3>Napomene o osobama</h3>'+notes.map(([label,p])=>row(label,p.notes)).join(''):'')+(payload.father?.maidenName?row('Djevojačko prezime prve osobe',payload.father.maidenName):'');};
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
 function updateRemoval(){form.dataset.revision=revision;form.dataset.familyId=familyId;removal.hidden=!familyId||familyId==='new'||boot.originalFamilies.includes(familyId);removalFields.family.value=familyId;removalFields.revision.value=revision;personFields.revision.value=revision;}
 updateRemoval();
 document.addEventListener('branch:context',event=>{
  const {personId:person,familyId:selected,label}=event.detail;
  removal.hidden=!selected||selected==='new'||boot.originalFamilies.includes(selected);
  removalFields.family.value=selected;removalFields.person.value=person;
  removalText.textContent='Porodica: '+label+'. Uklanjaju se njene veze. Osobe ostaju dostupne u ovom linku.';
  personRemoval.hidden=!person||boot.originalPeople.includes(person);personFields.id.value=person;
 });
 const ownFamilyData=familyData;
 function stampNode(card,c){
  card.dataset.branchId=c._id||'';card.dataset.branchPartner=c.spouse?._id||'';card.dataset.branchFamily=c._family||'';card.dataset.reference=c._reference?'true':'false';
  let link=card.querySelector(':scope > .actions > .branch-continue');if(!link){link=document.createElement('a');link.className='branch-continue btn soft';card.querySelector(':scope > .actions').appendChild(link);}link.textContent='Otvori ovu granu zasebno';link.hidden=!c._id;link.style.display=c._id?'':'none';link.href=boot.base+'/form?person='+encodeURIComponent(c._id||'');
  if(card._pendingDescendants){card._pendingDescendants=structuredClone(c.children||[]);return;}
  Array.from(descendantList(card).children).forEach((child,i)=>stampNode(child,c.children?.[i]||{}));
 }
 function stamp(payload){rootIds={father:payload.father?._id||'',mother:payload.mother?._id||''};Array.from(children.children).forEach((card,i)=>stampNode(card,payload.children[i]||{}));}
 stamp(initial);
 familyData=()=>{const payload=ownFamilyData();payload.father._id=rootIds.father;payload.mother._id=rootIds.mother;for(const prefix of ['father','mother'])for(const key of ['maidenName','notes'])payload[prefix][key]=form.querySelector('[name='+prefix+'_'+key+']').value.trim();return payload;};
 form.onsubmit=e=>{e.preventDefault();returnY=window.scrollY;return show(familyData());};
 document.getElementById('backBtn').onclick=()=>{document.getElementById('previewBox').style.display='none';window.scrollTo(0,returnY);};
 document.getElementById('sendBtn').textContent='Sačuvaj izmjene u linku';
 document.getElementById('sendBtn').onclick=async()=>{
  if(!currentPreview)return;const button=document.getElementById('sendBtn'),status=document.getElementById('sendStatus');button.disabled=true;status.textContent='Čuvam izmjene…';
  try{
   const response=await fetch(boot.base+'/form-save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({csrf:boot.csrf,revision,personId:boot.personId,familyId,payload:currentPreview})});
   const result=await response.json().catch(()=>({error:'Link više nije dostupan ili sesija nije važeća. Sačuvaj svoj unos prije osvježavanja.'}));if(!response.ok)throw Error(result.error||'Čuvanje nije uspjelo.');revision=result.revision;familyId=result.familyId;stamp(result.payload);updateRemoval();updatePartnerAction(result.payload);
   document.getElementById('previewBox').style.display='none';status.textContent='';showToast('Izmjene su sačuvane. Nastavi tamo gdje si stao.');banner.textContent='Sačuvano. Možeš nastaviti unos u ovoj porodici.';document.dispatchEvent(new CustomEvent('branch:saved'));window.scrollTo(0,returnY);
  }catch(e){status.textContent=e.message;}finally{button.disabled=false;}
 };
 // Warn before abandoning unsaved edits while changing families or returning to the tree.
 let dirty=false;form.addEventListener('input',event=>{if(event.target.name!=='submittedBy')dirty=true;});form.addEventListener('change',event=>{if(event.target.name!=='submittedBy')dirty=true;});
 document.addEventListener('branch:dirty',event=>{dirty=Boolean(event.detail);});
 form.addEventListener('click',event=>{if(event.target.closest('#addChild,.add-grandchild,.remove,.child-remove'))dirty=true;});
 const send=document.getElementById('sendBtn'),saveHandler=send.onclick;send.onclick=async()=>{const before=revision;await saveHandler();if(revision!==before)dirty=false;};
 window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
 document.title='Porodica – dopuna podataka';document.querySelector('.footer-note').textContent='Porodični link – pregled i dopuna podataka';
})();
