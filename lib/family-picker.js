// Choosing a Gramps family from a long list: alphabetical options and a search field that narrows them as you type.
// The search ignores case and diacritics (dajic finds Đajić) and also matches Gramps IDs; without JavaScript the plain list still works.
const fold=value=>String(value??'').toLowerCase().replace(/đ/g,'d').normalize('NFD').replace(/[̀-ͯ]/g,'');

function familyPicker({families,people,personName,esc,selected='',joiner=' & ',placeholder=''}){
 const byId=new Map(people.map(p=>[p.handle,p]));
 const items=families.map(f=>{
  const parents=[f.father_handle,f.mother_handle].filter(Boolean).map(id=>byId.get(id));
  const label=parents.map(p=>personName(p)).join(joiner)||f.gramps_id||f.handle;
  const search=fold([label,f.gramps_id,...parents.map(p=>p?.gramps_id)].filter(Boolean).join(' '));
  return {handle:f.handle,label,search};
 }).sort((a,b)=>a.label.localeCompare(b.label,'hr'));
 const options=items.map(i=>`<option value="${esc(i.handle)}" data-search="${esc(i.search)}"${i.handle===selected?' selected':''}>${esc(i.label)}</option>`).join('');
 // Options are rebuilt from the matches (phones ignore hidden options in their native picker). A family is chosen
 // automatically only while it is the single match; with more matches nothing stays selected from an earlier search.
 return `<div class="family-picker"><label for="family-search">Pronađi porodicu</label><input id="family-search" name="family-query" type="search" placeholder="npr. Đajić ili I0143" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search">
<p class="family-picker-count" aria-live="polite">${items.length} porodica</p>
<label for="family-select">Početna porodica</label><select id="family-select" name="family" required><option value="">${esc(placeholder||'Izaberi porodicu')}</option>${options}</select></div>
<script>(function(){var input=document.getElementById('family-search'),select=document.getElementById('family-select'),count=document.querySelector('.family-picker-count');
var empty=select.options[0],all=[].slice.call(select.options,1),total=all.length,initial=select.value,coarse=window.matchMedia&&matchMedia('(pointer: coarse)').matches;
function fold(v){return String(v||'').toLowerCase().replace(/đ/g,'d').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');}
input.addEventListener('input',function(){var words=fold(input.value).split(/\\s+/).filter(Boolean);
 var shown=all.filter(function(o){return words.every(function(w){return o.dataset.search.indexOf(w)>-1;});});
 empty.textContent=words.length?(shown.length?'Izaberi jednu od '+shown.length+' porodica':'Nema porodice za ovu pretragu'):'Izaberi porodicu';
 select.replaceChildren.apply(select,[empty].concat(shown));
 select.value=!words.length?initial:shown.length===1?shown[0].value:'';
 select.size=!coarse&&words.length&&shown.length>1?Math.min(shown.length+1,9):0;
 count.textContent=words.length?(shown.length?shown.length+' od '+total+' porodica':'Nijedna porodica ne odgovara pretrazi.'):total+' porodica';});
input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();select.focus();}});})();</script>`;
}
module.exports={familyPicker,fold};
