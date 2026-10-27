const test=require('node:test');
const assert=require('node:assert/strict');
const {navigation,displayName,rootFamilies,personPath}=require('../lib/family-navigation');
const data={people:[{id:'p',name:'Ana Test',birth:'1900'},{id:'c',name:'Marko Test'},{id:'s',name:'Ivana Druga'}],families:[{id:'childFamily',parents:['c','s'],children:[]},{id:'root',parents:['p'],children:['c']}],original:{people:[{handle:'p',primary_name:{first_name:'Ana',surname_list:[{surname:'Test'}]}}]}};
test('infers legacy root and formats surname first without rewriting saved names',()=>{
 assert.equal(rootFamilies(data)[0].id,'root');assert.equal(displayName(data.people[0],data),'Test, Ana');assert.equal(data.people[0].name,'Ana Test');
});
test('shows connected families with person links and search in the selected branch',()=>{
 const html=navigation(data,'/branch/token','c','Test');assert.match(html,/Test, Ana/);assert.match(html,/person=c#person-editor/);assert.match(html,/descendants/);assert.match(html,/family-node/);
 assert.match(navigation({...data,people:[{id:'p',name:'<script>'}],families:[{id:'r',parents:['p'],children:[]}]},'/branch/t'),/&lt;script&gt;/);
});
test('terminates cycles and honours the explicitly selected starting family',()=>{
 const cyclic={...data,rootFamily:'root',families:[{id:'root',parents:['p'],children:['c']},{id:'back',parents:['c'],children:['p']}]};
 assert.equal(rootFamilies(cyclic)[0].id,'root');assert.ok(navigation(cyclic,'/branch/t').length<10000);
});

test('finds the route from the selected root to descendants and partners without cycling',()=>{
 const branch={...data,rootFamily:'root',families:[...data.families,{id:'back',parents:['c'],children:['p']}]};
 assert.deepEqual(personPath(branch,'c').map(p=>p.id),['p','c']);
 assert.deepEqual(personPath(branch,'s').map(p=>p.id),['p','c','s']);
 assert.deepEqual(personPath(branch,'missing'),[]);
});

test('marks changed people and multiple family branches, without changing the relative view',()=>{
 const people=[{id:'root',name:'Početak'},...Array.from({length:5},(_,i)=>({id:`p${i}`,name:`Osoba ${i}`}))];
 const families=[{id:'rootFamily',parents:['root'],children:people.slice(1).map(p=>p.id)},...people.slice(1).map((p,i)=>({id:`f${i}`,parents:[p.id],children:[]}))];
 const branch={people,families,rootFamily:'rootFamily'};
 const review={people:new Map([['p0','changed'],['p4','new']]),families:new Map([['f1','new'],['f3','children']]),selectedFamily:'f3'};
 const admin=navigation(branch,'/admin/family-links/1','','',review);
 assert.match(admin,/Izmjene u grani/);assert.match(admin,/Nova osoba/);assert.match(admin,/Izmijenjeno/);
 assert.match(admin,/family=f1#family-review/);assert.match(admin,/family=f3#family-review/);
 assert.match(admin,/<details class="family-node branch-changed" open><summary>Osoba 3/);
 const publicView=navigation(branch,'/branch/token');assert.doesNotMatch(publicView,/change-badge/);
});
