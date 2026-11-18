const test=require('node:test');
const assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const {familyPicker}=require('../lib/family-picker');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const person=(handle,first,last,id)=>({handle,gramps_id:id,primary_name:{first_name:first,surname_list:[{surname:last}]}});
const personName=p=>p?[p.primary_name.surname_list.map(s=>s.surname).join(' '),p.primary_name.first_name].filter(Boolean).join(', '):'Nepoznato';
test('the family choice is alphabetical and narrows by name, without diacritics, or by Gramps ID',()=>{
 const people=[person('a','Ljubo','Đajić','I0001'),person('b','Borka','Damjanović','I0002'),person('c','Stanislav','Spasojević','I0143'),person('d','Desanka','Repić','I0065'),person('e','Pero','Perić','I0200')];
 const families=[{handle:'f2',gramps_id:'F0002',father_handle:'c',mother_handle:'d'},{handle:'f1',gramps_id:'F0001',father_handle:'a',mother_handle:'b'},{handle:'f3',gramps_id:'F0003',father_handle:'e'}];
 const dom=new JSDOM(`<form>${familyPicker({families,people,personName,esc,selected:'f2',joiner:' i '})}</form>`,{runScripts:'dangerously'});
 const d=dom.window.document,input=d.getElementById('family-search'),select=d.getElementById('family-select'),count=d.querySelector('.family-picker-count');
 const values=()=>[...select.options].map(o=>o.value).filter(Boolean);
 assert.deepEqual([...select.options].filter(o=>o.value).map(o=>o.textContent),['Đajić, Ljubo i Damjanović, Borka','Perić, Pero','Spasojević, Stanislav i Repić, Desanka']);
 assert.equal(select.value,'f2');assert.equal(count.textContent,'3 porodica');assert.equal(input.getAttribute('autocomplete'),'off');
 // Non-matching families leave the list itself, so a phone's native picker shows only the matches.
 const type=v=>{input.value=v;input.dispatchEvent(new dom.window.Event('input'));return values();};
 assert.deepEqual(type('dajic'),['f1']);assert.equal(select.value,'f1');
 assert.deepEqual(type('spasojevic'),['f2']);assert.equal(select.value,'f2');
 assert.deepEqual(type('I0143'),['f2']);
 assert.deepEqual(type('repic desanka'),['f2']);
 // Widening the search after a single match must not keep that family selected.
 assert.deepEqual(type('ić'),['f1','f3','f2']);assert.equal(select.value,'');assert.equal(count.textContent,'3 od 3 porodica');assert.equal(select.options[0].textContent,'Izaberi jednu od 3 porodica');
 assert.deepEqual(type('nema takvog'),[]);assert.equal(count.textContent,'Nijedna porodica ne odgovara pretrazi.');assert.equal(select.value,'');
 assert.deepEqual(type(''),['f1','f3','f2']);assert.equal(select.value,'f2');dom.window.close();
});
