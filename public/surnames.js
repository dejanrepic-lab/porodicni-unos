/* Surnames, shared by the browser and the server.
   The main surname is the birth surname, as in Gramps. A later surname (by marriage or otherwise) is kept separately
   in marriedName. Older entries kept the birth surname in maidenName and the later one in lastName; they are read
   as they are, and converted to the birth-surname rule when a form opens them, so the change shows in the preview. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SurnameData=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const t=v=>String(v??'').trim();
 const LABELS={lastName:'Prezime (rođeno)',marriedName:'Prezime po udaji / kasnije',legacyLastName:'Prezime',maidenName:'Djevojačko prezime'};
 // An older person with a maiden name: birth surname moves to lastName, the former lastName becomes the later surname.
 function normalize(p){
  if(!p||typeof p!=='object'||Array.isArray(p))return p;
  const maiden=t(p.maidenName);if(!maiden||t(p.marriedName))return p;
  const last=t(p.lastName);
  return {...p,lastName:maiden,marriedName:maiden===last?'':last,maidenName:''};
 }
 function normalizeTree(d){
  if(!d||typeof d!=='object')return d;
  const node=n=>n&&typeof n==='object'&&!Array.isArray(n)?{...normalize(n),...(n.spouse?{spouse:normalize(n.spouse)}:{}),...(Array.isArray(n.children)?{children:n.children.map(node)}:{})}:n;
  const out={...normalize(d)};
  for(const key of ['father','mother','partner'])if(out[key]&&typeof out[key]==='object')out[key]=normalize(out[key]);
  if(Array.isArray(out.children))out.children=out.children.map(node);
  return out;
 }
 // Label/value pairs for reports and exports. An unconverted older record keeps its own wording.
 function rows(p,{all=false}={}){
  p=p||{};
  if(t(p.maidenName)&&!t(p.marriedName))return [[LABELS.legacyLastName,p.lastName],[LABELS.maidenName,p.maidenName]];
  const out=[[LABELS.lastName,p.lastName]];
  if(all||t(p.marriedName))out.push([LABELS.marriedName,p.marriedName]);
  if(t(p.maidenName))out.push([LABELS.maidenName,p.maidenName]);
  return out;
 }
 return {LABELS,normalize,normalizeTree,rows};
});
