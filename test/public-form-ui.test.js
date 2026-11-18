const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const asset=file=>fs.readFileSync(path.join(__dirname,'../public',file),'utf8');
function page(){
 let html=asset('index.html').replace(/<script src="https:\/\/challenges[^>]*><\/script>/,'');
 for(const file of ['surnames.js','descendant-data.js','public-form.js'])html=html.replace(`<script src="/${file}"></script>`,()=>'<script>'+asset(file)+'</script>');
 const errors=[],console=new VirtualConsole();console.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM(html,{url:'https://example.test/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console,beforeParse(w){w.structuredClone=structuredClone;w.HTMLElement.prototype.scrollIntoView=function(){};w.scrollTo=()=>{};}});
 return {dom,w:dom.window,d:dom.window.document,errors};
}
test('the public form shows the main fields of each person and keeps the rest one tap away',async t=>{
 const {w,d,errors}=page();t.after(()=>w.close());await new Promise(r=>setTimeout(r,0));
 assert.ok(d.body.classList.contains('public-form'));assert.doesNotMatch(d.querySelector('.footer-note').textContent,/v\d|usklađeni/);assert.equal(d.querySelectorAll('.public-steps li').length,3);
 const father=d.querySelector('[data-prefix=father]');assert.ok(father.querySelector('.more-fields [name=father_nickname]'));assert.ok(father.querySelector('.more-fields [name=father_deathPlace]'));assert.equal(father.querySelector('[name=father_birthPlace]').closest('.more-fields'),null);
 const mother=d.querySelector('[data-prefix=mother]');assert.equal(mother.querySelector('[name=mother_lastName]').closest('.more-fields'),null);assert.ok(mother.querySelector('.more-fields [name=mother_marriedName]'));assert.equal(mother.querySelector('.more-fields-hint').textContent,'prezime po udaji, nadimak, smrt');
 assert.equal(mother.querySelector('[name=mother_lastName]').closest('.field').querySelector('label').textContent,'Prezime (rođeno)');assert.equal(d.querySelector('[name=mother_maidenName]'),null);
 const child=d.querySelector('#children > .child-card');assert.ok(child.querySelector(':scope > .grid > .more-fields [data-c=nickname]'));
 const spouse=child.querySelector(':scope > .descendant-partner');assert.ok(spouse.classList.contains('is-collapsed'));spouse.querySelector('.spouse-open').click();assert.equal(spouse.classList.contains('is-collapsed'),false);
 assert.equal(child.querySelector('.child-note').open,false);
 // Restored data opens what it fills, and the payload is the same as before the cards were shortened.
 w.fillFamily({father:{firstName:'Pero',deathPlace:'Banja Luka'},mother:{},children:[{firstName:'Ana',notes:'Bilješka',spouse:{firstName:'Ivan'},children:[]}]});
 await new Promise(r=>setTimeout(r,0));
 assert.equal(father.querySelector('.more-fields').open,true);const restored=d.querySelector('#children > .child-card');
 assert.equal(restored.querySelector(':scope > .descendant-partner').classList.contains('is-collapsed'),false);assert.equal(restored.querySelector('.child-note').open,true);
 const data=w.familyData();assert.equal(data.father.deathPlace,'Banja Luka');assert.equal(data.children[0].spouse.firstName,'Ivan');assert.equal(data.children[0].notes,'Bilješka');
 // An older entry with a maiden name opens with the birth surname as the surname and the former one as the later surname.
 w.fillFamily({father:{firstName:'Pero',lastName:'Perić'},mother:{firstName:'Mara',lastName:'Perić',maidenName:'Marić'},children:[{firstName:'Ana',lastName:'Jović',maidenName:'Perić',spouse:{},children:[]}]});await new Promise(r=>setTimeout(r,0));
 assert.equal(d.querySelector('[name=mother_lastName]').value,'Marić');assert.equal(d.querySelector('[name=mother_marriedName]').value,'Perić');assert.equal(mother.querySelector('.more-fields').open,true);
 assert.equal(d.getElementById('generatedTitle').textContent,'Perić Pero & Marić Mara');
 const converted=w.familyData();assert.equal(converted.mother.lastName,'Marić');assert.equal(converted.mother.marriedName,'Perić');assert.equal('maidenName' in converted.mother,false);
 assert.equal(converted.children[0].lastName,'Perić');assert.equal(converted.children[0].marriedName,'Jović');
 assert.deepEqual(errors,[]);
});
