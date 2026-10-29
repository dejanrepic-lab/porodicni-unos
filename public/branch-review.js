/* A compact view over the shared form: fields and serialization remain authoritative. */
(()=>{
 const form=document.getElementById('familyForm');
 const boot=JSON.parse(document.getElementById('branch-boot').textContent);
 const views=new Map();let editing=null,activeFamily=null,structureChanged=false,switchingFamily=false;
 let familyTrail=[];
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};
 const button=(label,handler)=>{const el=make('button','btn soft',label);el.type='button';el.onclick=handler;return el;};
 const fields=(el,selector)=>Object.fromEntries(Array.from(el.querySelectorAll(selector)).filter(input=>input.closest('.child-card')===el||!input.closest('.child-card')).map(input=>[input.dataset.c||input.dataset.s||input.name.replace(/^(father|mother)_/,''),input]));
 const values=map=>Object.fromEntries(Object.entries(map).map(([key,input])=>[key,input.value.trim()]));
 const name=p=>[p.firstName,p.lastName].filter(Boolean).join(' ');
 const primary=new Set(['firstName','lastName','birthDate','birthPlace']);
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
  if(done){view.done=done;done.textContent='Vrati se na pregled';done.onclick=()=>{closeEditor();view.edit.focus({preventScroll:true});};}
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
  if(card.dataset.reference==='true'){
   const link=make('a','btn soft','Otvori povezanu porodicu');link.href=boot.base+'/form?person='+encodeURIComponent(card.dataset.branchId);view.actions.append(link);
  }else{view.family=button('Porodica',()=>focusDescendant(card));view.actions.append(view.family);}
  return view;
 }
 // The legacy blank row is only a prompt. New rows are created explicitly by the user.
 if(!boot.payload.children.length)children.replaceChildren();
 form.querySelectorAll('.child-card').forEach(card=>attachCard(card));
 const originalAdd=addChild;
 addChild=function(data={},container=children,depth=1){
  const card=originalAdd(data,container,depth),isNew=!data._id&&!name(data)&&!data.name;
  const view=attachCard(card,isNew);
  if(isNew){structureChanged=true;openEditor(view);}refresh();return card;
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
 const familyExtra=make('details','review-root-extra section');familyExtra.append(make('summary','','Veza, napomene i izvor'));
 const relationship=form.querySelector('.relationship-section'),source=form.querySelector('[name=source]').closest('.section');
 relationship.before(familyExtra);familyExtra.append(relationship,source);
 familyExtra.querySelectorAll('.section-toggle').forEach(el=>el.hidden=true);
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
   const count=view.partnerFields?(view.el._pendingDescendants?.length??descendantList(view.el).children.length):0;
   if(view.partnerFields)facts.push('Djeca: '+count);
   view.facts.textContent=facts.filter(Boolean).join(' · ');view.facts.hidden=!view.facts.textContent;
   const absent=[!p.birthDate?'datum rođenja':'',!p.birthPlace?'mjesto rođenja':''].filter(Boolean);
   view.missing.textContent=label&&absent.length?'Nedostaje: '+absent.join(', '):'';view.missing.hidden=!view.missing.textContent;
   view.edit.textContent=label?'Dopuni osobu':view===roots[1]?'＋ Dodaj partnera':'Unesi podatke';
   view.edit.setAttribute('aria-label',view.edit.textContent+(label?' — '+label:''));if(view.done)view.done.textContent='Vrati se na pregled';
   const signature=JSON.stringify(spouse?{...p,spouse}:p),dirty=view.isNew||signature!==view.initial;
   view.el.classList.toggle('review-changed',dirty);view.state.textContent=dirty?'Izmijenjeno · još nije sačuvano':'';view.state.hidden=!dirty;if(dirty)changed++;
   if(view.partnerTitle)view.partnerTitle.textContent=name(spouse)?'Partner / supružnik: '+name(spouse):'＋ Dodaj partnera';
   if(view.family){view.family.textContent='Porodica';view.family.setAttribute('aria-label','Otvori porodicu: '+(label||'nova osoba')+' · djece: '+count);view.family.hidden=view.el===activeFamily;}
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
  const dirty=Boolean(changed||structureChanged||extraSignature()!==extraInitial);status.textContent=dirty?'Ima nesačuvanih izmjena':'Izmjene se čuvaju nakon pregleda';document.dispatchEvent(new CustomEvent('branch:dirty',{detail:dirty}));
  noChildren.hidden=children.children.length>0;
  document.getElementById('familyChildrenHeading').textContent='Djeca · '+children.children.length;
  const selectedView=activeFamily?views.get(activeFamily):null;
  rootName.textContent=selectedView?[name(values(selectedView.fields)),name(values(selectedView.partnerFields))].filter(Boolean).join(' i '):roots.map(view=>name(values(view.fields))).filter(Boolean).join(' i ');
  const map=document.querySelector('.branch-map-link'),focus=activeFamily?.dataset.branchId||boot.personId,currentFamily=activeFamily?.dataset.branchFamily||form.dataset.familyId||'';
  if(map)map.href=boot.base+'?map=1&focus='+encodeURIComponent(focus)+'&returnFamily='+encodeURIComponent(currentFamily)+'#'+encodeURIComponent('tree-person-'+focus);
  const completion=document.querySelector('.branch-completion');if(completion){completion.querySelector('[name=context]').value=focus;completion.querySelector('[name=family]').value=currentFamily;}
 }
 form.addEventListener('input',refresh);form.addEventListener('change',refresh);
 form.addEventListener('click',event=>{if(event.target.closest('.child-remove')){structureChanged=true;queueMicrotask(refresh);}});
 document.addEventListener('branch:saved',()=>{
  structureChanged=false;extraInitial=extraSignature();for(const view of views.values()){const p=values(view.fields);view.initial=JSON.stringify(view.partnerFields?{...p,spouse:values(view.partnerFields)}:p);view.isNew=false;}refresh();
 });
 document.addEventListener('branch:edit-target',event=>{
  const target=event.detail||{},path=target.path||[];
  if(target.role==='father'||target.role==='mother'){
   clearDescendantFocus(form);openEditor(roots[target.role==='father'?0:1],target.field);return;
  }
  if(!path.length){
   clearDescendantFocus(form);
   if(target.field){familyExtra.open=true;const input=form.querySelector('[name='+target.field+']');input?.focus({preventScroll:true});input?.scrollIntoView({behavior:'smooth',block:'center'});}
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
  openEditor(view,target.role==='partner'?'firstName':target.field);
  const input=target.role==='partner'?view.partnerFields[target.field||'firstName']:target.role==='family'&&target.field==='relationship'?view.partnerFields.relationship:view.fields[target.field];
  if(input){for(let parent=input.parentElement;parent&&parent!==card;parent=parent.parentElement)if(parent.tagName==='DETAILS')parent.open=true;input.focus({preventScroll:true});input.scrollIntoView({behavior:'smooth',block:'center'});}
 });
 form.classList.add('compact-review');document.body.classList.add('branch-review');refresh();
})();
