const test=require('node:test');
const assert=require('node:assert/strict');
const express=require('express');
const Database=require('better-sqlite3');
const {mountFamilyLinks}=require('../lib/family-links');
const {compareBranch,progressStatus}=require('../lib/family-review');

test('existing links and their snapshots survive the progress table upgrade',()=>{
 const db=new Database(':memory:');
 db.exec('CREATE TABLE family_links(id INTEGER PRIMARY KEY, token TEXT UNIQUE NOT NULL, label TEXT NOT NULL, baseline TEXT NOT NULL, working TEXT NOT NULL, created TEXT NOT NULL, last_seen TEXT, updated TEXT, active INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 0)');
 const snapshot=JSON.stringify({people:[{id:'p',name:'Ana'}],families:[]});
 db.prepare('INSERT INTO family_links(token,label,baseline,working,created,revision) VALUES(?,?,?,?,?,?)').run('token','Link',snapshot,snapshot,'2026-01-01',1);
 mountFamilyLinks(express(),{db,adminAuth:(req,res,next)=>next(),client:()=>{}});
 mountFamilyLinks(express(),{db,adminAuth:(req,res,next)=>next(),client:()=>{}});
 const row=db.prepare('SELECT baseline,working,revision FROM family_links').get();
 assert.deepEqual(row,{baseline:snapshot,working:snapshot,revision:1});
 assert.equal(db.prepare('SELECT COUNT(*) AS count FROM family_link_progress').get().count,0);
 db.close();
});

test('diff ignores missing versus empty values and reports relationships and edits',()=>{
 const base={people:[{id:'a',name:'Ana'}],families:[{id:'f',parents:['a'],children:[]}]};
 const current={people:[{id:'a',name:'Ana',notes:''},{id:'b',name:'Novo'}],families:[{id:'f',parents:['a'],children:['b']},{id:'g',parents:['b'],children:[]}]};
 const diff=compareBranch(base,current);
 assert.equal(diff.changedPeople.length,0);assert.equal(diff.addedPeople.length,1);assert.equal(diff.addedFamilies.length,1);assert.deepEqual(diff.addedChildren[0].ids,['b']);
 assert.equal(progressStatus({revision:2,last_seen:null},{reviewed_revision:1,submitted_revision:1}),'U toku');
});
