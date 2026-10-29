/* A compact view over the shared form: fields and serialization remain authoritative. */
(()=>{
 const form=document.getElementById('familyForm');
 const boot=JSON.parse(document.getElementById('branch-boot').textContent);
 const familyMetas=new Set();
 const views=new Map();let editing=null,activeFamily=null,switchingFamily=false;
 let familyTrail=[];
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
 const button=(label,handler)=>{const el=make('button','btn soft',label);el.type='button';el.onclick=handler;return el;};
 const fields=(el,selector)=>Object.fromEntries(Array.from(el.querySelectorAll(selector)).filter(input=>input.closest('.child-card')===el||!input.closest('.child-card')).map(input=>[input.dataset.c||input.dataset.s||input.name.replace(/^(father|mother)_/,''),input]));
 const values=map=>Object.fromEntries(Object.entries(map).map(([key,input])=>[key,input.value.trim()]));
 const name=p=>[p.firstName,p.lastName].filter(Boolean).join(' ');
 const primary=new Set(['firstName','lastName','birthDate','birthPlace']);
 function structureSignature(){
  const shape=[],stack=Array.from(children.children).reverse();
  while(stack.length){const node=stack.pop(),dom=node.nodeType===1;
   const kids=dom?(node._pendingDescendants||Array.from(descendantList(node).children)):(node.children||[]);
   shape.push([dom?(node.dataset.branchId||'new:'+node.dataset.index):node._id,kids.length]);
   for(let i=kids.length-1;i>=0;i--)stack.push(kids[i]);
  }
  return JSON.stringify(shape);
 }

 // Move the original inputs into a small, local family row; there are no shadow values.
 function familyMeta(select,notes){
  const el=make('div','review-family-meta'),row=make('label','review-relationship');
  row.append(make('span','','Vrsta veze'),select);el.append(row);
  select.options[0].value='';select.options[0].textContent='Nije upisana';
  const entries=[];
  for(const [input,label] of notes){
   const details=make('details','review-inline-note'),summary=make('summary'),preview=make('span'),field=make('label','field');
   summary.append(make('strong','',label+': '),preview);field.append(make('span','',label),input);
   input.rows=2;details.append(summary,field);el.append(details);entries.push({input,preview});
  }
  const meta={el,entries};familyMetas.add(meta);return meta;
 }
 function reveal(input){
  if(!input)return;
  for(let parent=input.parentElement;parent&&parent!==form;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
  input.focus({preventScroll:true});input.scrollIntoView({behavior:'smooth',block:'nearest'});
 }

 function moreFields(grid,map){
  const details=make('details','review-more'),summary=make('summary','','Više podataka'),extra=make('div','grid');
  details.append(summary,extra);
  for(const [key,input] of Object.entries(map))if(!primary.has(key)){const field=input.closest('.field');if(field&&grid.contains(field))extra.append(field);}
  if(extra.children.length)grid.append(details);
  return details;
 }
 function closeEditor(){
  if(!editing)return;const view=editing;view.el.classList.remove('review-editing');view.edit.setAttribute('aria-expanded','false');editing=null;refresh();
 }
 function openEditor(view,key){
  closeEditor();editing=view;view.el.classList.remove('user-collapsed');view.el.classList.add('review-editing');view.edit.setAttribute('aria-expanded','true');
  const input=view.fields[key||'firstName'];
  if(input){for(let parent=input.parentElement;parent&&parent!==view.el;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;input.focus({preventScroll:true});}
  view.el.scrollIntoView({behavior:'smooth',block:'start'});
 }
 function viewFor(el,map,isNew=false){
  const view={el,fields:map,initial:JSON.stringify(values(map)),isNew};
  const summary=make('div','review-summary'),person=make('strong','review-name'),facts=make('p','review-facts'),missing=make('p','review-hint'),state=make('span','review-state');
  const actions=make('div','actions review-actions');view.edit=button('Dopuni',()=>openEditor(view));view.edit.setAttribute('aria-expanded','false');actions.append(view.edit);
  summary.append(person,facts,missing,state,actions);view.summary=summary;view.person=person;view.facts=facts;view.missing=missing;view.state=state;view.actions=actions;
  el.classList.add('review-person');el.classList.remove('user-collapsed');
  el.insertBefore(summary,el.querySelector(':scope > .grid'));
  const grid=el.querySelector(':scope > .grid');if(grid)moreFields(grid,map);
  let done=el.querySelector(':scope > .section-toggle,:scope > .actions > .child-collapse');
  if(done){view.done=done;done.textContent='Vrati se na pregled';done.onclick=()=>{if(view.isNew&&!name(values(view.fields))){showToast('Upiši ime osobe prije završetka unosa.');view.fields.firstName.focus();return;}closeEditor();view.edit.focus({preventScroll:true});};}
  views.set(el,view);return view;
 }
 const roots=['father','mother'].map(prefix=>{
  const grid=form.querySelector('[data-prefix='+prefix+']'),section=grid.closest('.section');
  return viewFor(section,fields(section,'[name^='+prefix+'_]'));
 });
 const parents=make('div','review-parents');roots[0].el.before(parents);parents.append(...roots.map(view=>view.el));
 function attachCard(card,isNew=false){
  if(views.has(card))return views.get(card);
  const view=viewFor(card,fields(card,'[data-c]'),isNew);view.partnerFields=fields(card,'[data-s]');
  view.initial=JSON.stringify({...values(view.fields),spouse:values(view.partnerFields)});
  const partner=card.querySelector(':scope > .descendant-partner');
  if(partner){
   const details=make('details','nested descendant-partner'),title=make('summary');details.hidden=partner.hidden;
   partner.querySelector('h3').remove();details.append(title,...partner.childNodes);partner.replaceWith(details);view.partnerTitle=title;
   moreFields(details.querySelector('.grid'),view.partnerFields);
  }
  const noteField=view.fields.notes.closest('.field'),oldSelectField=view.partnerFields.relationship.closest('.field');
  view.familyMeta=familyMeta(view.partnerFields.relationship,[[view.fields.notes,'Napomena porodice']]);
  view.familyMeta.el.hidden=card.dataset.reference==='true';
  card.querySelector(':scope > .descendant-family').before(view.familyMeta.el);noteField.remove();oldSelectField.remove();
  if(card.dataset.reference==='true'){
   const link=make('a','btn soft','Otvori povezanu porodicu');link.href=boot.base+'/form?person='+encodeURIComponent(card.dataset.branchId);view.actions.append(link);
  }else{view.family=button('Porodica',()=>{
   focusDescendant(card);
   if(!name(values(view.partnerFields))&&!descendantList(card).children.length)reveal(view.partnerFields.firstName);
  });view.actions.append(view.family);}
  view.remove=card.querySelector(':scope > .child-head > .child-remove');
  view.actions.append(view.remove);
  view.remove.onclick=event=>{
   const id=card.dataset.branchId;
   if(id){
    event.stopPropagation();
    if(boot.originalPeople.includes(id))return;
    if(form.dataset.branchDirty==='true'){showToast('Prvo sačuvaj ostale izmjene prije brisanja djeteta.');return;}
    const author=form.querySelector('[name=submittedBy]');if(!author.value.trim()){author.focus();author.reportValidity();return;}
    if(!window.confirm('Obriši '+name(values(view.fields))+' i njegove veze iz ovog linka? Gramps baza se ne mijenja.'))return;
    const request=document.createElement('form');request.method='post';request.action=boot.base+'/remove-person';
    for(const [key,value] of Object.entries({csrf:boot.csrf,revision:form.dataset.revision,id,editor:author.value.trim(),confirm:'yes'})){
     const input=document.createElement('input');input.type='hidden';input.name=key;input.value=value;request.append(input);
    }
    document.body.append(request);request.submit();return;
   }

   const list=card.parentElement,next=card.nextElementSibling;
   if(editing?.el===card||card.contains(editing?.el))closeEditor();
   if(activeFamily===card||card.contains(activeFamily)){
    const previous=familyTrail.pop();if(previous?.isConnected)showFamily(previous,false);else clearDescendantFocus(form);
   }
   card.remove();renumberChildren();refresh();
   document.dispatchEvent(new CustomEvent('branch:child-removed',{detail:{label:name(values(view.fields))||'Nova osoba',wasSaved:Boolean(card.dataset.branchId),restore:()=>{
    if(!list.isConnected)return false;list.insertBefore(card,next?.parentElement===list?next:null);renumberChildren();refresh();return true;
   }}}));
  };
  return view;
 }
 // The legacy blank row is only a prompt. New rows are created explicitly by the user.
 if(!boot.payload.children.length)children.replaceChildren();
 form.querySelectorAll('.child-card').forEach(card=>attachCard(card));
 let initialStructure=structureSignature();
 const originalAdd=addChild;
 addChild=function(data={},container=children,depth=1){
  const card=originalAdd(data,container,depth),isNew=!data._id&&!name(data)&&!data.name;
  const view=attachCard(card,isNew);
  if(isNew)openEditor(view);refresh();return card;
 };
 const originalClear=clearDescendantFocus;
 clearDescendantFocus=function(target){
  originalClear(target);if(target!==form)return;
  activeFamily=null;if(!switchingFamily){closeEditor();familyTrail=[];}form.querySelectorAll('.review-family-open').forEach(el=>el.classList.remove('review-family-open'));refresh();
 };
 const originalFocus=focusDescendant;
 function showFamily(card,push=true){
  if(push&&activeFamily!==card)familyTrail.push(activeFamily);
  closeEditor();switchingFamily=true;try{originalFocus(card);}finally{switchingFamily=false;}activeFamily=card;card.classList.add('review-family-open');
  const toolbar=form.querySelector('.descendant-focus-toolbar'),back=toolbar?.querySelector('button');
  if(back){const previous=familyTrail[familyTrail.length-1];back.textContent=previous?'← Nazad: '+pairDisplayName(previous,1):'← Početna porodica';back.onclick=()=>{const previous=familyTrail.pop();if(previous?.isConnected)showFamily(previous,false);else clearDescendantFocus(form);};}
  if(familyTrail.some(Boolean))toolbar.append(button('Početna porodica',()=>clearDescendantFocus(form)));
  refresh();
 }
 focusDescendant=card=>showFamily(card);
 const relationship=form.querySelector('.relationship-section'),source=form.querySelector('[name=source]').closest('.section');
 const rootMeta=familyMeta(form.querySelector('[name=primaryRelationship]'),[[form.querySelector('[name=source]'),'Izvor'],[form.querySelector('[name=notes]'),'Napomena porodice']]);
 rootMeta.el.classList.add('review-root-extra','section');parents.after(rootMeta.el);relationship.remove();source.remove();
 const childrenSection=document.getElementById('familyChildrenHeading').closest('.section');
 childrenSection.querySelector(':scope > .section-toggle').hidden=true;
 childrenSection.querySelector(':scope > .subtle').textContent='Odaberi dijete za dopunu ili otvori njegovu porodicu.';
 const noChildren=make('p','review-empty','Nema upisane djece. Ako ih ima, dodaj ih ispod.');children.before(noChildren);
 const missingBox=make('details','review-missing section'),missingTitle=make('summary'),missingHint=make('p','subtle','Ovo su moguća mjesta za dopunu. Popuni samo ono što znaš.'),missingList=make('div','review-missing-list');missingBox.append(missingTitle,missingHint,missingList);childrenSection.before(missingBox);
 const savebar=form.querySelector(':scope > .actions');savebar.classList.add('review-savebar');
 savebar.querySelector('button').textContent='Pregledaj i sačuvaj';
 const status=make('span','review-save-status');status.setAttribute('role','status');savebar.prepend(status);
 const extraSignature=()=>JSON.stringify(['primaryRelationship','source','notes'].map(key=>form.querySelector('[name='+key+']').value));
 let extraInitial=extraSignature();
 const sender=form.querySelector('.sender-section');savebar.before(sender);
 document.querySelector('.family-title').hidden=true;
 document.querySelector('.hero h1').textContent='Pregled porodice';
 document.querySelector('.hero .lead').textContent='Pregledaj poznate podatke. Otvori samo osobu ili porodicu koju želiš dopuniti.';
 document.getElementById('editBanner').textContent='Dopunjavaš kopiju podataka u ovom linku. Izmjene sačuvaj nakon pregleda.';
 const rootName=make('p','review-root-name');document.querySelector('.hero h1').after(rootName);
 function currentPeople(){
  const owner=activeFamily?views.get(activeFamily):null;
  const people=owner?[owner]:[...roots];
  if(owner&&name(values(owner.partnerFields)))people.push({el:owner.el,fields:owner.partnerFields,owner});
  const list=activeFamily?descendantList(activeFamily):children;
  for(const card of list.children){const view=views.get(card);if(view)people.push(view);}
  return people;
 }
 function refresh(){
  if(!missingList)return;
  let changed=0;
  for(const view of views.values()){
   if(!view.el.isConnected)continue;
   const p=values(view.fields),spouse=view.partnerFields?values(view.partnerFields):null;
   const label=name(p);view.person.textContent=label||(view===roots[1]?'Partner nije upisan':'Nova osoba');
   const shown=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)?d.split('-').reverse().join('.'):d;
   const facts=[p.birthDate?'Rođ. '+shown(p.birthDate):'',p.birthPlace,p.deathDate?'Preminuo/la '+shown(p.deathDate):''];
   if(spouse&&name(spouse))facts.push('Partner: '+name(spouse));
   if(spouse?.relationship)facts.push('Veza: '+spouse.relationship);
   const count=view.partnerFields?(view.el._pendingDescendants?.length??descendantList(view.el).children.length):0;
   if(view.partnerFields)facts.push('Djeca: '+count);
   view.facts.textContent=facts.filter(Boolean).join(' · ');view.facts.hidden=!view.facts.textContent;
   const absent=[!p.birthDate?'datum rođenja':'',!p.birthPlace?'mjesto rođenja':''].filter(Boolean);
   view.missing.textContent=label&&absent.length?'Nedostaje: '+absent.join(', '):'';view.missing.hidden=!view.missing.textContent;
   view.edit.textContent=label?'Dopuni osobu':view===roots[1]?'＋ Dodaj partnera':'Unesi podatke';
   view.edit.setAttribute('aria-label',view.edit.textContent+(label?' — '+label:''));if(view.done)view.done.textContent=view.doneLabel||(view.isNew?'Gotovo — dodaj u porodicu':'Gotovo — vrati se na porodicu');
   const signature=JSON.stringify(spouse?{...p,spouse}:p),dirty=view.isNew||signature!==view.initial;
   view.el.classList.toggle('review-changed',dirty);view.state.textContent=dirty?(view.isNew?'Novo · nije sačuvano':'Izmijenjeno · još nije sačuvano'):'';view.state.hidden=!dirty;if(dirty)changed++;
   if(view.partnerTitle)view.partnerTitle.textContent=name(spouse)?'Partner / supružnik: '+name(spouse):'＋ Dodaj partnera';
   if(view.remove){view.remove.hidden=boot.originalPeople.includes(view.el.dataset.branchId);view.remove.textContent=view.el.dataset.branchId?'Obriši dodano dijete':'Odustani od dodavanja';}
   if(view.family){view.family.textContent=!name(spouse)&&!count?'+ Dodaj partnera':'Porodica';view.family.setAttribute('aria-label','Otvori porodicu: '+(label||'nova osoba')+' · djece: '+count);view.family.hidden=view.el===activeFamily;view.family.disabled=!label;}
  }
  missingList.replaceChildren();let missingCount=0;
  for(const view of currentPeople()){
   const p=values(view.fields);if(!name(p))continue;
   for(const [key,label] of [['birthDate','datum rođenja'],['birthPlace','mjesto rođenja']])if(!p[key]){
    const action=button(name(p)+' — dodaj '+label,()=>{
     const owner=view.owner||view;openEditor(owner);
     const input=view.fields[key];for(let parent=input.parentElement;parent&&parent!==owner.el;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;
     input.focus({preventScroll:true});input.scrollIntoView({behavior:'smooth',block:'center'});
    });missingList.append(action);missingCount++;
   }
  }
  missingTitle.textContent=missingCount?'Šta nedostaje u ovoj porodici · '+missingCount:'Osnovni podaci ove porodice su popunjeni';
  missingBox.hidden=missingCount===0;
  const dirty=Boolean(changed||structureSignature()!==initialStructure||extraSignature()!==extraInitial);form.dataset.branchDirty=String(dirty);document.dispatchEvent(new CustomEvent('branch:dirty',{detail:dirty}));
  noChildren.hidden=children.children.length>0;
  document.getElementById('familyChildrenHeading').textContent='Djeca · '+children.children.length;
  document.getElementById('addChild').textContent='+ Dodaj dijete za '+roots.map(view=>name(values(view.fields))).filter(Boolean).join(' i ');
  const selectedView=activeFamily?views.get(activeFamily):null;
  rootName.textContent=selectedView?[name(values(selectedView.fields)),name(values(selectedView.partnerFields))].filter(Boolean).join(' i '):roots.map(view=>name(values(view.fields))).filter(Boolean).join(' i ');
  for(const meta of familyMetas)if(meta.el.isConnected)for(const {input,preview} of meta.entries)preview.textContent=input.value.trim()||'+ Dodaj';
  const map=document.querySelector('.branch-map-link'),focus=activeFamily?.dataset.branchId||boot.personId,currentFamily=activeFamily?(activeFamily.dataset.branchFamily||''):(form.dataset.familyId||'');
  if(map)map.href=boot.base+'?map=1&focus='+encodeURIComponent(focus)+'&returnFamily='+encodeURIComponent(currentFamily)+'#'+encodeURIComponent('tree-person-'+focus);
  form.dataset.branchPerson=activeFamily?(activeFamily.dataset.branchId||''):boot.personId;form.dataset.branchFamily=currentFamily;
  document.dispatchEvent(new CustomEvent('branch:context',{detail:{personId:activeFamily?(activeFamily.dataset.branchId||''):boot.personId,familyId:currentFamily,label:rootName.textContent}}));
 }
 form.addEventListener('input',refresh);form.addEventListener('change',refresh);
 form.addEventListener('click',event=>{if(event.target.closest('.child-remove'))queueMicrotask(refresh);});
 document.addEventListener('branch:saved',()=>{
  initialStructure=structureSignature();extraInitial=extraSignature();for(const view of views.values()){const p=values(view.fields);view.initial=JSON.stringify(view.partnerFields?{...p,spouse:values(view.partnerFields)}:p);view.isNew=false;}refresh();
 });
 document.addEventListener('branch:edit-target',event=>{
  const target=event.detail||{},path=target.path||[];
  if(target.role==='father'||target.role==='mother'){
   clearDescendantFocus(form);openEditor(roots[target.role==='father'?0:1],target.field);return;
  }
  if(!path.length){
   clearDescendantFocus(form);
   if(target.field)reveal(form.querySelector('[name='+target.field+']'));
   else childrenSection.scrollIntoView({behavior:'smooth',block:'start'});
   return;
  }
  let list=children,card,owner=null;
  for(const index of path){if(card){owner=card;ensureDescendantChildren(card);list=descendantList(card);}card=list.children[index];if(!card)return;}
  if(target.role==='family'&&!target.field){focusDescendant(card);return;}
  const view=views.get(card);if(!view)return;
  const hasFamily=card.dataset.branchFamily||card._pendingDescendants?.length||descendantList(card).children.length||name(values(view.partnerFields));
  if(target.role==='partner'||target.role==='family'||hasFamily)focusDescendant(card);
  else if(owner)focusDescendant(owner);else clearDescendantFocus(form);
  if(target.role==='family'){reveal(target.field==='relationship'?view.partnerFields.relationship:view.fields[target.field]);return;}
  openEditor(view,target.role==='partner'?'firstName':target.field);
  const input=target.role==='partner'?view.partnerFields[target.field||'firstName']:view.fields[target.field];
  if(input){for(let parent=input.parentElement;parent&&parent!==card;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;input.focus({preventScroll:true});input.scrollIntoView({behavior:'smooth',block:'center'});}
 });
 document.addEventListener('branch:remove-target',event=>{
  const path=event.detail?.path;if(!path?.length)return;let list=children,card;
  for(const index of path){if(card){ensureDescendantChildren(card);list=descendantList(card);}card=list.children[index];if(!card)return;}
  if(!card.dataset.branchId)views.get(card)?.remove.click();
 });
 form.classList.add('compact-review');document.body.classList.add('branch-review');refresh();
 if(boot.familyId==='new'){
  const hero=document.querySelector('.hero'),heading=hero.querySelector('h1'),lead=hero.querySelector('.lead');
  heading.textContent='Dodavanje drugog partnera';document.title=heading.textContent;
  lead.textContent='Unesi novog partnera i njihovu djecu. Postojeća porodica ostaje sačuvana. Odustajanje ne čuva ovaj unos.';
  const cancel=make('a','btn soft branch-cancel-partner','Odustani — nazad na postojeću porodicu');cancel.href=boot.cancelUrl;hero.querySelector('nav').prepend(cancel);
  roots[1].el.querySelector('h2').textContent='Novi partner / supružnik';roots[1].doneLabel='Gotovo — dodaj partnera';roots[1].done.textContent=roots[1].doneLabel;
  const inlineCancel=cancel.cloneNode(true);inlineCancel.className='btn soft branch-cancel-partner-inline';inlineCancel.textContent='Odustani od novog partnera';roots[1].done.after(inlineCancel);openEditor(roots[1]);
  document.addEventListener('branch:saved',()=>{cancel.remove();inlineCancel.remove();roots[1].doneLabel='';roots[1].done.textContent='Gotovo — vrati se na porodicu';roots[1].el.querySelector('h2').textContent='Partner / supružnik';heading.textContent='Pregled porodice';lead.textContent='Izmjene su sačuvane. Možeš nastaviti dopunu ove porodice.';document.title='Porodica – dopuna podataka';},{once:true});
 }

})();
