const test=require('node:test');
const assert=require('node:assert/strict');
const {scopeFor,applyForm}=require('../lib/branch-form');
const {flatten,html,txt}=require('../public/descendant-data');
function chain(depth){let root={firstName:'Koljeno 1',spouse:{},children:[]},node=root;for(let i=2;i<=depth;i++){const child={firstName:'Koljeno '+i,spouse:{firstName:'Partner '+i},children:[],personNotes:'Napomena '+i};node.children.push(child);node=child;}return root;}
test('eight generations save and reopen without duplicate identities or loss of deep details',()=>{
 const data={rootFamily:'f',people:[{id:'a',name:'Korijen',events:[]}],families:[{id:'f',parents:['a'],children:[],events:[]}],original:{people:[]}};
 const payload=scopeFor(data,'a').payload;payload.children=[chain(8)];const saved=applyForm(data,'a','f',payload);assert.equal(flatten(saved.payload.children).length,8);assert.equal(data.people.length,16);const reopened=scopeFor(data,'a','f').payload;const deep=flatten(reopened.children).at(-1);assert.equal(deep.node.firstName,'Koljeno 8');assert.equal(deep.node.personNotes,'Napomena 8');assert.equal(deep.node.spouse.firstName,'Partner 8');const ids=flatten(reopened.children).map(x=>x.node._id);applyForm(data,'a','f',reopened);assert.equal(data.people.length,16);assert.deepEqual(flatten(scopeFor(data,'a','f').payload.children).map(x=>x.node._id),ids);
});
test('cycle references stop expansion and do not erase the existing family',()=>{
 const data={people:[{id:'a',name:'A',events:[]},{id:'b',name:'B',events:[]}],families:[{id:'f',parents:['a'],children:['b']},{id:'back',parents:['b'],children:['a']}]};
 const scope=scopeFor(data,'a','f');assert.equal(scope.payload.children[0].children[0]._reference,true);assert.equal(flatten(scope.payload.children).length,2);const before=structuredClone(data.families);applyForm(data,'a','f',scope.payload);assert.deepEqual(data.families.map(({id,parents,children})=>({id,parents,children})),before);
});
test('the same export renders all generations and reads legacy name-only grandchildren',()=>{
 const nodes=[chain(9),{name:'Stari zapis',birthDate:'1900'}],rows=flatten(nodes);assert.equal(rows.length,10);assert.equal(rows[8].number,'1.1.1.1.1.1.1.1.1');const escape=x=>String(x).replace(/</g,'&lt;'),row=(k,v)=>`${escape(k)}: ${escape(v)}`;assert.match(html(nodes,{esc:escape,row}),/Koljeno 9/);assert.match(txt(nodes),/Partner 9/);assert.match(txt(nodes),/Stari zapis/);assert.match(txt(nodes),/Napomena 9/);
});
