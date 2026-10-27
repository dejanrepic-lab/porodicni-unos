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
