/* Public form only: shorter person cards and the same look as the family link.
   Family links reuse index.html with their own review adapter, so this script stays out of them. */
(()=>{
 if(document.getElementById('branch-boot'))return;
 const secondary=new Set(['marriedName','maidenName','nickname','deathDate','deathPlace']);
 const keyOf=input=>(input.dataset.c||input.dataset.s||input.name||'').replace(/^(father|mother|partner)_/,'');
 const filled=root=>Array.from(root.querySelectorAll('input,select,textarea')).some(input=>input.type!=='file'&&input.value.trim());
 const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text)el.textContent=text;return el;};

 const hintNames={marriedName:'prezime po udaji',maidenName:'djevojačko prezime',nickname:'nadimak',deathDate:'smrt',deathPlace:'smrt'};
 const hintFor=fields=>[...new Set(fields.flatMap(field=>Array.from(field.querySelectorAll('input,select')).map(input=>hintNames[keyOf(input)]).filter(Boolean)))].join(', ');
 // Name, surname, birth date and place stay visible; the rest of a person waits behind "Više podataka".
 function compact(grid){
  if(!grid||grid.dataset.compact)return;grid.dataset.compact='1';
  const extra=Array.from(grid.children).filter(field=>field.classList.contains('field')&&Array.from(field.querySelectorAll('input,select')).some(input=>secondary.has(keyOf(input))&&!input.classList.contains('title-watch')));
  if(!extra.length)return;
  const details=make('details','more-fields'),summary=make('summary','','Više podataka'),hint=make('span','more-fields-hint',hintFor(extra)),inner=make('div','grid');
  summary.append(hint);details.append(summary,inner);extra.forEach(field=>inner.append(field));grid.append(details);
  details.open=filled(inner);
 }
 // A child's partner opens on request, or by itself when it already has data.
 function partner(block){
  if(!block||block.dataset.compact)return;block.dataset.compact='1';
  const open=make('button','btn soft spouse-open','＋ Dodaj supružnika / partnera');open.type='button';
  open.onclick=()=>{block.classList.remove('is-collapsed');block.querySelector('input,select')?.focus();};
  block.prepend(open);block.classList.toggle('is-collapsed',!filled(block));
 }
 // The family note of a child is optional; it opens like the person's own notes.
 function note(el){
  const field=el.querySelector(':scope > .field.full');const area=field?.querySelector('textarea[data-c="notes"]');if(!area||field.dataset.compact)return;field.dataset.compact='1';
  const details=make('details','more-fields child-note'),summary=make('summary','','Napomena za ovu porodicu');details.append(summary);field.before(details);details.append(field);details.open=Boolean(area.value.trim());
 }
 function card(el){compact(el.querySelector(':scope > .grid'));const spouse=el.querySelector(':scope > .descendant-partner');compact(spouse?.querySelector(':scope > .grid'));partner(spouse);note(el);}
 function refresh(){
  document.querySelectorAll('.more-fields').forEach(d=>{if(filled(d))d.open=true;});
  document.querySelectorAll('.descendant-partner.is-collapsed').forEach(b=>{if(filled(b))b.classList.remove('is-collapsed');});
 }

 document.querySelectorAll('#familyForm .person-fields, #personForm .section > .grid').forEach(compact);
 document.querySelectorAll('.child-card').forEach(card);
 const watch=new MutationObserver(records=>{for(const r of records)for(const node of r.addedNodes)if(node.nodeType===1){if(node.classList.contains('child-card'))card(node);node.querySelectorAll?.('.child-card').forEach(card);}});
 for(const list of [document.getElementById('children'),document.getElementById('personChildren')])if(list)watch.observe(list,{childList:true,subtree:true});
 // Drafts and edits fill fields after load; open whatever now holds data.
 for(const name of ['fillFamily','fillPerson']){const original=window[name];if(typeof original==='function')window[name]=function(...args){const result=original.apply(this,args);refresh();return result;};}

 // Header: the same three short steps as the family link.
 const hero=document.querySelector('.hero');
 if(hero&&!hero.querySelector('.public-steps')){
  const steps=make('ol','public-steps');steps.setAttribute('aria-label','Kako popuniti');
  for(const text of ['Upiši svoje ime.','Popuni samo ono što znaš.','Dodirni „Pregled unosa“, provjeri i pošalji.'])steps.append(make('li','',text));
  hero.querySelector('.choice')?.before(steps);
 }
})();
