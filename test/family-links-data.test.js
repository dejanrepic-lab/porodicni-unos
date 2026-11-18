const test=require('node:test');
const assert=require('node:assert/strict');
const {prepareBranch,dateText}=require('../lib/family-links');
test('prepares existing names, notes and event information without changing Gramps objects',()=>{
 const data={people:[{handle:'p',gramps_id:'I001',primary_name:{first_name:'Ana',surname_list:[{surname:'Primjer'}]},event_ref_list:[{ref:'birth'}],note_list:['n']}],families:[{handle:'f',mother_handle:'p',child_ref_list:[]}],events:[{handle:'birth',type:'Birth',date:{dateval:[2,3,1900,false],modifier:3},place:'place'}],places:[{handle:'place',title:'Salzburg'}],notes:[{handle:'n',text:{string:'Porodična bilješka'}}]};
 const original=JSON.stringify(data);const branch=prepareBranch(data,'f');
 assert.equal(branch.people[0].name,'Primjer, Ana');assert.equal(branch.people[0].birth,'oko 1900-03-02');assert.equal(branch.people[0].birthPlace,'Salzburg');assert.equal(branch.people[0].notes,'Porodična bilješka');assert.equal(branch.original.events[0].handle,'birth');assert.equal(JSON.stringify(data),original);
 assert.equal(dateText({text:'nepoznata godina'}),'nepoznata godina');
});
test('uses the person\'s own birth and death events, not events they only witnessed',()=>{
 const name=(first,last)=>({first_name:first,surname_list:[{surname:last}]});
 const data={people:[
  // A parent recorded at the child's birth first, then their own birth marked by birth_ref_index.
  {handle:'father',primary_name:name('Stanislav','Spasojević'),birth_ref_index:1,death_ref_index:2,event_ref_list:[{ref:'childBirth',role:'Father'},{ref:'ownBirth',role:'Primary'},{ref:'ownDeath',role:'Primary'}]},
  // No index given: the primary birth wins over a birth where the person was a witness.
  {handle:'child',primary_name:name('Milivoje','Spasojević'),event_ref_list:[{ref:'witnessed',role:{string:'Witness'}},{ref:'childBirth',role:{string:'Primary'}}]}],
  families:[{handle:'f',father_handle:'father',child_ref_list:[{ref:'child'}]}],
  events:[{handle:'childBirth',type:'Birth',date:{dateval:[0,0,1960,false]},place:'cv'},{handle:'ownBirth',type:{string:'Birth'},date:{dateval:[0,0,1936,false]},place:'sv'},{handle:'ownDeath',type:'Death',date:{dateval:[8,12,1998,false]},place:'bl'},{handle:'witnessed',type:'Birth',date:{dateval:[0,0,1999,false]},place:'bl'}],
  places:[{handle:'cv',title:'',name:{value:'Čivčije'}},{handle:'sv',title:'Šnjegotina Velika'},{handle:'bl',title:'Banja Luka'}],notes:[]};
 const people=new Map(prepareBranch(data,'f').people.map(p=>[p.id,p]));
 assert.deepEqual([people.get('father').birth,people.get('father').birthPlace,people.get('father').death,people.get('father').deathPlace],['1936','Šnjegotina Velika','1998-12-08','Banja Luka']);
 assert.deepEqual([people.get('child').birth,people.get('child').birthPlace],['1960','Čivčije']);
});
