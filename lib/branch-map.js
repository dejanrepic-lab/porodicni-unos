const {navigation,givenName,rootFamilies}=require('./family-navigation');
const {versionPublicAssets}=require('./public-assets');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function branchMap(link,data,{focus='',query='',returnFamily=''}={}){
 const base='/branch/'+link.token,person=data.people.find(p=>p.id===focus);
 const family=data.families.find(f=>f.id===returnFamily&&f.parents.includes(person?.id));
 const back=person?base+'/form?person='+encodeURIComponent(person.id)+(family?'&family='+encodeURIComponent(family.id):''):base;
 const showHome=person&&!rootFamilies(data).some(f=>f.parents.includes(person.id)&&(!family||family.id===f.id));
 return versionPublicAssets(`<!doctype html><html lang="bs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><title>Mapa grane – ${esc(link.label)}</title><link rel="stylesheet" href="/app.css"><link rel="stylesheet" href="/branch-map.css"></head><body class="branch-map"><main class="wrap"><header class="hero"><h1>Mapa porodične grane</h1><p class="lead">Ovdje pronađi osobu. Podatke dopunjavaš u njenom porodičnom pregledu.</p><nav class="actions"><a class="btn soft" href="${esc(back)}">← ${person?'Porodica: '+esc(givenName(person)):'Pregled i dopuna porodice'}</a>${showHome?`<a class="btn soft" href="${esc(base)}">Početna porodica</a>`:''}</nav></header>${navigation(data,base,focus,query,null,{publicMap:true})}<p class="footer-note">${esc(link.label)} · Ista kopija podataka iz porodičnog linka</p></main></body></html>`);
}
module.exports={branchMap};
