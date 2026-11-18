const test=require('node:test');
const assert=require('node:assert/strict');
const Surnames=require('../public/surnames');
const D=require('../public/descendant-data');
const {scopeFor,applyForm}=require('../lib/branch-form');
const {compareBranch}=require('../lib/family-review');
const {prepareBranch}=require('../lib/family-links');
test('older maiden-name entries turn into birth surname plus later surname, and new ones stay as they are',()=>{
 assert.deepEqual(Surnames.normalize({lastName:'Spasojević',maidenName:'Repić'}),{lastName:'Repić',marriedName:'Spasojević',maidenName:''});
 assert.deepEqual(Surnames.normalize({lastName:'Repić',maidenName:'Repić'}),{lastName:'Repić',marriedName:'',maidenName:''});
 const fresh={lastName:'Repić',marriedName:'Spasojević'};assert.equal(Surnames.normalize(fresh),fresh);
 const tree=Surnames.normalizeTree({type:'porodica',mother:{lastName:'B',maidenName:'A'},children:[{lastName:'C',maidenName:'D',spouse:{lastName:'E',maidenName:'F'},children:[{lastName:'G',maidenName:'H'}]}]});
 assert.equal(tree.mother.lastName,'A');assert.equal(tree.children[0].lastName,'D');assert.equal(tree.children[0].spouse.marriedName,'E');assert.equal(tree.children[0].children[0].marriedName,'G');
 // Reports keep an unconverted older record in its own words, and show the later surname only when it exists.
 assert.deepEqual(Surnames.rows({lastName:'Perić',maidenName:'Marić'}),[['Prezime','Perić'],['Djevojačko prezime','Marić']]);
 assert.deepEqual(Surnames.rows({lastName:'Marić'}),[['Prezime (rođeno)','Marić']]);
 assert.match(D.txt([{firstName:'Ana',lastName:'Repić',marriedName:'Jović',children:[]}]),/Prezime \(rođeno\): Repić\nPrezime po udaji \/ kasnije: Jović/);
});
test('a family link moves an older maiden name into the saved name and keeps everything visible to the admin',()=>{
 const data={rootFamily:'f',people:[{id:'a',name:'Spasojević, Stanislav'},{id:'b',name:'Spasojević, Desanka',maidenName:'Repić'}],families:[{id:'f',parents:['a','b'],children:[]}],original:{people:[]}};
 const before=structuredClone(data),payload=scopeFor(data,'a','f',before).payload;
 assert.equal(payload.mother.lastName,'Repić');assert.equal(payload.mother.marriedName,'Spasojević');
 applyForm(data,'a','f',payload,before);const desanka=data.people.find(p=>p.id==='b');
 assert.equal(desanka.name,'Repić, Desanka');assert.equal(desanka.marriedName,'Spasojević');assert.equal(desanka.maidenName,'');
 const changes=compareBranch(before,data).changedPeople.find(x=>x.person.id==='b').changes.map(c=>c.label);
 assert.deepEqual(changes.sort(),['Djevojačko prezime','Prezime po udaji / kasnije','Prezime, ime'].sort());
 // An older open page that still sends maidenName does not lose the later surname.
 const old=structuredClone(data);const legacy=scopeFor(old,'a','f',before).payload;delete legacy.mother.marriedName;legacy.mother.maidenName='';applyForm(old,'a','f',legacy,before);
 assert.equal(old.people.find(p=>p.id==='b').marriedName,'Spasojević');
});
test('the Gramps import takes a later surname from the "Married Name" alternate name',()=>{
 const data={people:[{handle:'d',primary_name:{first_name:'Desanka',surname_list:[{surname:'Repić'}]},alternate_names:[{type:{string:'Married Name'},surname_list:[{surname:'Spasojević'}]}]},{handle:'s',primary_name:{first_name:'Stanislav',surname_list:[{surname:'Spasojević'}]},alternate_names:[{type:'Also Known As',surname_list:[{surname:'Stanko'}]}]}],families:[{handle:'f',father_handle:'s',mother_handle:'d',child_ref_list:[]}],events:[],places:[],notes:[]};
 const people=new Map(prepareBranch(data,'f').people.map(p=>[p.id,p]));
 assert.equal(people.get('d').name,'Repić, Desanka');assert.equal(people.get('d').marriedName,'Spasojević');assert.equal(people.get('s').marriedName,undefined);
});
