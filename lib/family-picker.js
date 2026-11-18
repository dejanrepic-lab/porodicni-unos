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
 return `<div class="family-picker"><label for="family-search">Pronađi porodicu</label><input id="family-search" type="search" placeholder="Ime, prezime ili Gramps ID (npr. Đajić, I0143)" autocomplete="off" enterkeyhint="search">
<p class="family-picker-count" aria-live="polite">${items.length} porodica</p>
<label for="family-select">Početna porodica</label><select id="family-select" name="family" required>${placeholder?`<option value="">${esc(placeholder)}</option>`:''}${options}</select></div>
<script>(function(){var input=document.getElementById('family-search'),select=document.getElementById('family-select'),count=document.querySelector('.family-picker-count');
var all=[].slice.call(select.options).filter(function(o){return o.value;}),total=all.length;
function fold(v){return String(v||'').toLowerCase().replace(/đ/g,'d').normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');}
input.addEventListener('input',function(){var words=fold(input.value).split(/\\s+/).filter(Boolean),shown=[];
 all.forEach(function(o){var hit=words.every(function(w){return o.dataset.search.indexOf(w)>-1;});o.hidden=!hit;o.disabled=!hit;if(hit)shown.push(o);});
 if(shown.length===1)shown[0].selected=true;else if(select.selectedOptions[0]&&select.selectedOptions[0].hidden)select.value=shown[0]?shown[0].value:'';
 select.size=words.length&&shown.length>1?Math.min(shown.length,8):0;
 count.textContent=words.length?(shown.length?shown.length+' od '+total+' porodica':'Nijedna porodica ne odgovara pretrazi.'):total+' porodica';});
input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();select.focus();}});})();</script>`;
}
module.exports={familyPicker,fold};
