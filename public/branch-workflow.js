/* One contributor identity and clear save/finish states for the shared family form. */
(()=>{
 const boot=JSON.parse(document.getElementById('branch-boot').textContent),form=document.getElementById('familyForm');
 const author=form.querySelector('[name=submittedBy]'),sender=author.closest('.sender-section');
 const bar=form.querySelector('.review-savebar'),review=bar.querySelector('button'),status=bar.querySelector('.review-save-status');
 let dirty=form.dataset.branchDirty==='true',busy=false,progress=boot.progress||'Otvoren, bez izmjena',saved=false;
 const make=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;if(text)el.textContent=text;return el;};
 sender.classList.add('branch-author');sender.querySelector('h2').textContent='Tvoja dopuna';
 author.id='branch-author';author.autocomplete='name';author.maxLength=160;
 const label=author.closest('.field').querySelector('label');label.textContent='Tvoje ime i prezime';label.htmlFor=author.id;
 const storageKey='branch-author:'+boot.base;
 try{if(!author.value)author.value=sessionStorage.getItem(storageKey)||'';}catch{}
 // Remember only the name in this tab, separately for each private link.
 author.addEventListener('input',()=>{try{sessionStorage.setItem(storageKey,author.value);}catch{}syncAuthor();});
 const progressLabel=make('p','branch-progress');progressLabel.setAttribute('role','status');document.querySelector('.hero').append(progressLabel);
 const message=make('p','branch-workflow-message');message.hidden=true;message.setAttribute('role','alert');bar.before(message);
 const completion=make('div','branch-completion');completion.hidden=true;
 const completionForm=document.createElement('form');completionForm.id='branch-finish-form';completionForm.method='post';completionForm.action=boot.base+'/completion';
 for(const [name,value] of Object.entries({csrf:boot.csrf,revision:form.dataset.revision||boot.revision,context:form.dataset.branchPerson??boot.personId,family:form.dataset.branchFamily??form.dataset.familyId??boot.familyId??'',editor:''})){
  const input=document.createElement('input');input.type='hidden';input.name=name;input.value=value;completionForm.append(input);
 }
 completion.append(completionForm);form.after(completion);
 const finish=make('button','btn soft branch-finish','Završi dopunu');finish.type='submit';finish.setAttribute('form',completionForm.id);bar.append(finish);
 const hint=make('p','subtle branch-finish-hint');sender.append(hint);
 function syncAuthor(){completionForm.elements.editor.value=author.value.trim();}
 function showError(text){message.textContent=text;message.hidden=false;}
 function render(){
  progressLabel.textContent='Status dopune: '+progress;
  status.textContent=dirty?'Ima nesačuvanih izmjena':saved?'Sve izmjene su sačuvane':'Nema nesačuvanih izmjena';
  review.disabled=!dirty||busy;review.textContent='Pregledaj izmjene';
  const done=/^(Završeno|Pregledano)/.test(progress);
  finish.disabled=dirty||busy||done;finish.textContent=busy?'Završavam…':done?'Dopuna završena':'Završi dopunu';
  hint.textContent=dirty?'Prvo pregledaj i sačuvaj izmjene. Zatim možeš nastaviti ili završiti dopunu.':done?'Dopuna je završena. Ako se sjetiš još nečega, možeš nastaviti uređivanje.':'Kada dopuniš sve što znaš u ovom linku, odaberi „Završi dopunu”.';
 }
 document.addEventListener('branch:dirty',event=>{dirty=Boolean(event.detail);if(dirty)message.hidden=true;render();});
 document.addEventListener('branch:context',event=>{
  completionForm.elements.context.value=event.detail.personId;completionForm.elements.family.value=event.detail.familyId;
 });
 document.addEventListener('branch:saved',()=>{
  saved=true;progress='U toku';message.hidden=true;
  completionForm.elements.revision.value=form.dataset.revision;
  render();
 });
 completionForm.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  if(dirty){showError('Prvo pregledaj i sačuvaj izmjene.');review.focus();return;}
  if(!author.value.trim()){showError('Upiši svoje ime uz dopunu.');author.focus();author.scrollIntoView({block:'center'});author.reportValidity();return;}
  syncAuthor();busy=true;message.hidden=true;render();
  try{
   const response=await fetch(completionForm.action,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},body:new URLSearchParams(new FormData(completionForm))});
   const result=await response.json().catch(()=>({error:'Dopuna nije označena završenom. Pokušaj ponovo.'}));
   if(!response.ok||typeof result.progress!=='string')throw Error(result.error||'Dopuna nije označena završenom.');
   progress=result.progress;document.dispatchEvent(new CustomEvent('branch:completed',{detail:result}));showToast('Dopuna je završena i čeka pregled administratora.');
  }catch(error){showError(error.message);}finally{busy=false;render();}
 });
 for(const destructive of document.querySelectorAll('form[action$="/remove-family"],form[action$="/remove-person"]')){
  destructive.addEventListener('submit',event=>{if(dirty){event.preventDefault();showError('Prvo sačuvaj nesačuvane izmjene prije uklanjanja.');review.focus();}});
 }
 const undo=make('div','branch-undo');undo.hidden=true;bar.before(undo);
 document.addEventListener('branch:child-removed',event=>{
  undo.replaceChildren(document.createTextNode(event.detail.wasSaved?event.detail.label+' · uklonjeno iz ove porodice. ':'Dodavanje je otkazano. '));
  const restore=make('button','btn soft','Vrati');restore.type='button';
  restore.onclick=()=>{if(event.detail.restore())undo.hidden=true;};undo.append(restore);undo.hidden=false;
 });
 document.addEventListener('branch:saved',()=>{undo.hidden=true;undo.replaceChildren();});
 syncAuthor();render();
})();
