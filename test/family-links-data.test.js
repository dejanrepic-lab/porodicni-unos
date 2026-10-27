const test=require('node:test');
const assert=require('node:assert/strict');
const {prepareBranch,dateText}=require('../lib/family-links');
test('prepares existing names, notes and event information without changing Gramps objects',()=>{
 const data={people:[{handle:'p',gramps_id:'I001',primary_name:{first_name:'Ana',surname_list:[{surname:'Primjer'}]},event_ref_list:[{ref:'birth'}],note_list:['n']}],families:[{handle:'f',mother_handle:'p',child_ref_list:[]}],events:[{handle:'birth',type:'Birth',date:{dateval:[2,3,1900,false],modifier:3},place:'place'}],places:[{handle:'place',title:'Salzburg'}],notes:[{handle:'n',text:{string:'Porodična bilješka'}}]};
 const original=JSON.stringify(data);const branch=prepareBranch(data,'f');
 assert.equal(branch.people[0].name,'Primjer, Ana');assert.equal(branch.people[0].birth,'oko 1900-03-02');assert.equal(branch.people[0].birthPlace,'Salzburg');assert.equal(branch.people[0].notes,'Porodična bilješka');assert.equal(branch.original.events[0].handle,'birth');assert.equal(JSON.stringify(data),original);
 assert.equal(dateText({text:'nepoznata godina'}),'nepoznata godina');
});
