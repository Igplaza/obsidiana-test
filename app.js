'use strict';
const $=id=>document.getElementById(id), escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DB='obsidiana-local-v2', STORE='state';let db,model,currentWeek=1,currentDay=1;
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2)}
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function getDB(){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get('main');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function putDB(v){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(v,'main');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
function fresh(){return {version:2,week:1,weeks:[{number:1,days:[1,2,3,4,5].map(n=>({number:n,exercises:[]}))}]}}
function week(){return model.weeks.find(w=>w.number===currentWeek)}function day(){return week().days.find(d=>d.number===currentDay)}
function validate(m){if(!m||m.version!==2||!Array.isArray(m.weeks)||!m.weeks.length||m.weeks.length>500)throw Error('Archivo no compatible con Obsidiana V2.');const ids=new Set();for(const w of m.weeks){if(!Number.isInteger(w.number)||!Array.isArray(w.days)||w.days.length<1||w.days.length>31)throw Error('Semanas inválidas.');for(const d of w.days){if(!Number.isInteger(d.number)||d.number<1||!Array.isArray(d.exercises)||d.exercises.length>200||(d.name!==undefined&&(typeof d.name!=='string'||d.name.length>60)))throw Error('Días inválidos.');for(const e of d.exercises){if(typeof e.id!=='string'||ids.has(e.id)||typeof e.name!=='string'||e.name.length>150||!Array.isArray(e.sets)||e.sets.length>30||typeof e.notes!=='string'||e.notes.length>5000)throw Error('Datos de ejercicios inválidos.');ids.add(e.id);for(const s of e.sets){for(const key of ['kg','reps','rir'])if(s[key]!==null&&!(typeof s[key]==='number'&&Number.isFinite(s[key])&&s[key]>=0&&s[key]<=1000))throw Error('Serie inválida.')}}}}}
async function persist(){model.week=currentWeek;if(typeof rememberWorkspace==='function')rememberWorkspace();validate(model);await putDB(model)}
function planOf(e){
 if(!e.plan){const current=e.sets||[];e.plan={sets:current.map(x=>({kg:x.kg,reps:x.reps})),min:8,max:12,rir:1,increment:null}}
 e.plan.min??=8;e.plan.max??=12;e.plan.rir??=1;e.plan.increment??=null;
 return e.plan;
}
function planText(e){const p=planOf(e),reps=p.sets.map(s=>s.reps??'—').join('-');const weights=[...new Set(p.sets.map(s=>s.kg).filter(x=>x!==null))];return `${p.sets.length} series · ${reps} reps · ${weights.length===1?weights[0]+' kg':weights.length?'cargas variadas':'peso a definir'} · RIR objetivo ${p.rir}`}
function inputNumber(v){return v===null||v===undefined?'':v}
function reasonClass(reason){const r=String(reason||'').toLocaleLowerCase('es');if(r.startsWith('recuperar'))return 'recuperar';if(r.startsWith('consolidar'))return 'consolidar';if(r.startsWith('progresar'))return 'progresar';if(r.startsWith('superaste')||r.startsWith('objetivo superado'))return 'superado';if(r.startsWith('descarga'))return 'descarga';if(r.includes('manual')||r.includes('personalizado'))return 'manual';return 'neutral'}
function previousWeekMarkup(e){
 const before=model.weeks.find(w=>w.number===currentWeek-1);
 if(!before)return '';
 const found=before.days.flatMap(d=>d.exercises).find(x=>x.exerciseId===e.exerciseId && x.updated);
 if(!found)return `<div class="previous-week hidden"><div class="prev-title">SEMANA ${before.number} · REALIZADO</div><div class="prev-line">Sin registro de este ejercicio en esa semana.</div></div>`;
 const series=found.sets.map((s,i)=>`<span>S${i+1}: ${s.kg===null?'—':escapeHtml(s.kg)+' kg'} × ${s.reps===null?'—':escapeHtml(s.reps)}${s.rir===null?'':' · RIR '+escapeHtml(s.rir)}</span>`).join('');
 return `<div class="previous-week hidden"><div class="prev-title">SEMANA ${before.number} · REALIZADO</div><div class="prev-line">${escapeHtml(summary(found))}</div><div class="prev-series">${series}</div>${found.notes?`<div class="prev-note">Nota: ${escapeHtml(found.notes)}</div>`:''}</div>`;
}
function planMarkup(e){const p=planOf(e);return `<div class="plan-panel"><div class="plan-top"><strong>OBJETIVO PLANIFICADO</strong><div class="plan-tools">${model.weeks.some(w=>w.number===currentWeek-1)?`<button type="button" class="button small" data-action="toggle-previous" aria-expanded="false">↶ Semana anterior</button>`:``}<button type="button" class="button small" data-action="toggle-plan">✎ Editar objetivo</button></div></div><div class="plan-line">${escapeHtml(planText(e))}</div>${previousWeekMarkup(e)}${p.reason?`<div class="plan-reason ${reasonClass(p.reason)}">${escapeHtml(p.reason)}</div>`:``}<div class="plan-edit hidden"><label>Reps mín.<input data-plan="min" type="number" min="1" max="200" value="${p.min}"></label><label>Reps máx.<input data-plan="max" type="number" min="1" max="200" value="${p.max}"></label><label>RIR objetivo<input data-plan="rir" type="number" min="0" max="10" step="0.5" value="${p.rir}"></label><label>Subida kg<input data-plan="increment" type="number" min="0" max="100" step="0.5" placeholder="Opcional" value="${inputNumber(p.increment)}"></label><div style="grid-column:1/-1"><label>Objetivo de series (reps y kg por serie)</label><div class="row" style="margin:6px 0">${p.sets.map((x,i)=>`<span style="display:inline-flex;gap:4px;align-items:center"><small>S${i+1}</small><input data-plan-reps="${i}" type="number" min="1" max="200" placeholder="reps" style="width:65px" value="${inputNumber(x.reps)}"><input data-plan-kg="${i}" type="number" min="0" max="1000" step="any" placeholder="kg" style="width:80px" value="${inputNumber(x.kg)}"></span>`).join('')}</div><button class="button small primary" data-action="save-plan">Guardar objetivo</button></div></div></div>`}
function completed(e){return !!e.updated&&e.sets.length>0&&e.sets.every(s=>s.kg!==null&&s.reps!==null&&s.reps>0)}
function summary(e){
 if(!completed(e))return `${e.sets.length} series · Pendiente`;
 const weights=[...new Set(e.sets.map(s=>s.kg))];
 const rirs=[...new Set(e.sets.map(s=>s.rir))];
 const reps=e.sets.map(s=>s.reps).join('-');
 if(weights.length===1 && rirs.length===1)return `${weights[0]} kg · ${reps} reps${rirs[0]!==null?' · RIR '+rirs[0]:''}`;
 if(weights.length===1)return `${weights[0]} kg · ${reps} reps · RIR variable`;
 return `Pesos variables · ${e.sets.length} series`;
}
function compactDetails(e){
 if(!completed(e))return '';
 const weights=[...new Set(e.sets.map(s=>s.kg))];
 const rirs=[...new Set(e.sets.map(s=>s.rir))];
 if(weights.length===1&&rirs.length===1)return '';
 return `<div class="series-preview">${e.sets.map((s,i)=>`<span><b>S${i+1}</b> ${escapeHtml(s.kg)} kg × ${escapeHtml(s.reps)}${rirs.length>1?' · RIR '+escapeHtml(s.rir??'—'):''}</span>`).join('')}</div>`;
}
function seriesDetail(e){
 return e.sets.map((s,i)=>`<div class="hist-series"><span>Serie ${i+1}</span><b>${escapeHtml(s.kg??'—')} kg</b><span>${escapeHtml(s.reps??'—')} reps</span><span>RIR ${escapeHtml(s.rir??'—')}</span></div>`).join('');
}
function render(){model.weeks.sort((a,b)=>a.number-b.number);$('week').innerHTML=model.weeks.map(w=>`<option value="${w.number}">Semana ${w.number}</option>`).join('');$('week').value=currentWeek;$('bigWeek').textContent=String(currentWeek).padStart(2,'0');$('days').innerHTML=week().days.map(d=>`<button class="day ${d.number===currentDay?'active':''}" data-day="${d.number}"><b>${escapeHtml(d.name||'Día '+d.number)}</b><small>${d.exercises.filter(completed).length}/${d.exercises.length} completos</small></button>`).join('');$('dayTitle').textContent=day().name||'Día '+currentDay;const es=day().exercises;$('progress').style.width=(es.length?100*es.filter(completed).length/es.length:0)+'%';$('summary').textContent=`${es.filter(completed).length} de ${es.length} ejercicios · ${es.reduce((a,e)=>a+e.sets.filter(s=>s.reps!==null).length,0)} series registradas`;$('cards').innerHTML=es.length?es.map((e,i)=>{planOf(e);const base=e.sets[0]?.kg??null;const rirs=e.sets.map(s=>s.rir).filter(v=>v!==null);const rir=rirs.length?rirs.reduce((a,v)=>rirs.filter(x=>x===v).length>rirs.filter(x=>x===a).length?v:a,rirs[0]):null;return `<details class="card ${completed(e)?'complete':''}" data-id="${escapeHtml(e.id)}"><summary><span class="count">${completed(e)?'✓':i+1}</span><div class="title"><b>${escapeHtml(e.name)}</b><small>${escapeHtml(summary(e))}</small>${compactDetails(e)}</div><span class="muted">⌄</span></summary><div class="body">${planMarkup(e)}<div class="common-fields"><label>Peso general (kg)<input data-common="kg" type="number" min="0" max="1000" step="any" inputmode="decimal" placeholder="Ej. 60" value="${base??''}"></label><label>RIR general<input data-common="rir" type="number" min="0" max="10" step="0.5" inputmode="decimal" placeholder="Ej. 1" value="${rir??''}"></label></div><div class="sets-header"><span>Nº</span><span>REPS</span><span></span><span></span></div><div class="setrows">${e.sets.map((set,j)=>setHTML(set,j,base,rir)).join('')}</div><div class="actions"><button type="button" class="button small goal-fill" data-action="fill-goal" title="Completa peso y repeticiones según el objetivo, sin cargar RIR ni guardar">✓ Cargar objetivo</button><button class="button small" data-action="add-set">+ Serie</button><button class="button small" data-action="history">Historial</button><button class="button small danger" data-action="delete-exercise">Eliminar ejercicio</button></div><label>Notas del ejercicio<textarea data-notes maxlength="5000" placeholder="Cómo te sentiste, cambio de máquina, molestias, técnica…">${escapeHtml(e.notes)}</textarea></label><div class="actions"><button class="button primary small" data-action="save">Guardar registro ✓</button></div><div class="status">${e.updated?'Guardado · '+new Date(e.updated).toLocaleString('es-AR'):'Pendiente de guardar'}</div></div></details>`}).join(''):'<div class="blank">Todavía no hay ejercicios en este día. Tocá «+ Ejercicio» para empezar.</div>'}
function setHTML(s,j,base,baseRir=null){
 const override=s.kg!==null&&base!==null&&s.kg!==base;
 const overrideRir=s.rir!==null&&baseRir!==null&&s.rir!==baseRir;
 const expanded=override||overrideRir;
 return `<div class="set-row"><span class="set-number">${j+1}</span><input data-prop="reps" type="number" min="0" max="200" step="1" inputmode="numeric" placeholder="Reps" value="${s.reps??''}" aria-label="Repeticiones de serie ${j+1}"><button type="button" class="adjust-btn ${expanded?'changed':''}" data-action="toggle-adjust" aria-expanded="${expanded}" title="Ajustar peso o RIR">${expanded?'⚙ Ajustado':'⚙ Ajustar'}</button><button class="remove" data-action="remove-set" data-index="${j}" aria-label="Quitar serie">×</button><div class="set-extra ${expanded?'':'hidden'}"><label class="weight-override"><input type="checkbox" data-override ${override?'checked':''}> Peso diferente</label><label class="override-kg ${override?'':'hidden'}">kg<input data-prop="kg-override" type="number" min="0" max="1000" step="any" inputmode="decimal" value="${override?s.kg:''}"></label><label class="weight-override"><input type="checkbox" data-rir-override ${overrideRir?'checked':''}> RIR diferente</label><label class="override-rir ${overrideRir?'':'hidden'}">RIR<input data-prop="rir-override" type="number" min="0" max="10" step="0.5" inputmode="decimal" value="${overrideRir?s.rir:''}"></label></div></div>`;
}
function exerciseFrom(el){return day().exercises.find(e=>e.id===el.dataset.id)}
function readCard(el){
 const rows=[...el.querySelectorAll('.set-row')];
 if(!rows.length)throw Error('Agregá al menos una serie.');
 const kgInput=el.querySelector('[data-common="kg"]'),rirInput=el.querySelector('[data-common="rir"]');
 if(!kgInput.checkValidity()||!rirInput.checkValidity())throw Error('Revisá peso y RIR general.');
 const kg=kgInput.value.trim()===''?null:Number(kgInput.value),rir=rirInput.value.trim()===''?null:Number(rirInput.value);
 const sets=rows.map(row=>{
  const repsInput=row.querySelector('[data-prop="reps"]');
  const checked=row.querySelector('[data-override]').checked;
  const weightInput=row.querySelector('[data-prop="kg-override"]');
  const rirChecked=row.querySelector('[data-rir-override]').checked;
  const rirOverride=row.querySelector('[data-prop="rir-override"]');
  if(!repsInput.checkValidity()||(checked&&!weightInput.checkValidity())||(rirChecked&&!rirOverride.checkValidity()))throw Error('Revisá los valores de las series.');
  const reps=repsInput.value.trim()===''?null:Number(repsInput.value);
  if(reps!==null&&!Number.isInteger(reps))throw Error('Las repeticiones deben ser enteras.');
  const weight=checked?(weightInput.value.trim()===''?null:Number(weightInput.value)):kg;
  const seriesRir=rirChecked?(rirOverride.value.trim()===''?null:Number(rirOverride.value)):rir;
  if(checked&&weight===null)throw Error('Ingresá el peso de la serie modificada.');
  if(rirChecked&&seriesRir===null)throw Error('Ingresá el RIR de la serie modificada.');
  return {kg:weight,reps,rir:seriesRir};
 });
 return {sets,notes:el.querySelector('[data-notes]').value};
}
function draftBadge(el){el.querySelector('.status').textContent='Cambios sin guardar';el.dataset.dirty='1'}
async function saveCard(el){const e=exerciseFrom(el);const v=readCard(el);e.sets=v.sets;e.notes=v.notes;e.updated=new Date().toISOString();await persist();render();const newEl=[...document.querySelectorAll('.card')].find(c=>c.dataset.id===e.id);if(newEl)newEl.open=true}
function modal(title,body){$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('overlay').classList.add('open')}
function history(e){const all=model.weeks.flatMap(w=>w.days.flatMap(d=>d.exercises.filter(x=>x.exerciseId===e.exerciseId&&x.updated).map(x=>({week:w.number,day:d.number,e:x})))).sort((a,b)=>b.week-a.week);modal('Historial · '+e.name,all.length?all.map(x=>`<div class="histitem"><b>Semana ${x.week} · Día ${x.day}</b><p>${escapeHtml(summary(x.e))}</p><div class="hist-series-list">${seriesDetail(x.e)}</div><p>${escapeHtml(x.e.notes||'Sin notas')}</p></div>`).join(''):'<p class="muted">Todavía no hay registros guardados de este ejercicio.</p>')}
function guardDirty(){return !document.querySelector('[data-dirty="1"]')||confirm('Tenés cambios sin guardar. ¿Querés descartarlos?')}
$('cards').addEventListener('change',ev=>{if(ev.target.matches('[data-override],[data-rir-override]')){const row=ev.target.closest('.set-row');const isRir=ev.target.matches('[data-rir-override]');const box=row.querySelector(isRir?'.override-rir':'.override-kg');box.classList.toggle('hidden',!ev.target.checked);if(ev.target.checked){const input=row.querySelector(isRir?'[data-prop=rir-override]':'[data-prop=kg-override]');if(!input.value)input.value=ev.target.closest('.card').querySelector(isRir?'[data-common=rir]':'[data-common=kg]').value;input.focus()}const changed=row.querySelector('[data-override]').checked||row.querySelector('[data-rir-override]').checked;row.querySelector('.adjust-btn').classList.toggle('changed',changed);row.querySelector('.adjust-btn').textContent=changed?'⚙ Ajustado':'⚙ Ajustar';draftBadge(ev.target.closest('.card'))}});$('cards').addEventListener('input',ev=>{const c=ev.target.closest('.card');if(c)draftBadge(c)});
$('cards').addEventListener('click',async ev=>{const b=ev.target.closest('[data-action]');if(!b)return;const c=b.closest('.card'),e=exerciseFrom(c),a=b.dataset.action;try{if(a==='toggle-adjust'){const extra=b.closest('.set-row').querySelector('.set-extra');extra.classList.toggle('hidden');b.setAttribute('aria-expanded',String(!extra.classList.contains('hidden')));return}if(a==='toggle-previous'){const box=c.querySelector('.previous-week');if(box){box.classList.toggle('hidden');b.setAttribute('aria-expanded',String(!box.classList.contains('hidden')))}return}if(a==='toggle-plan'){c.querySelector('.plan-edit').classList.toggle('hidden');return}
if(a==='save-plan'){const p=planOf(e),get=k=>Number(c.querySelector(`[data-plan="${k}"]`).value),min=get('min'),max=get('max'),rir=get('rir');const incField=c.querySelector('[data-plan="increment"]');const increment=incField.value.trim()===''?null:Number(incField.value);const sets=p.sets.map((x,i)=>{const ri=c.querySelector(`[data-plan-reps="${i}"]`),ki=c.querySelector(`[data-plan-kg="${i}"]`);return {reps:ri.value===''?null:Number(ri.value),kg:ki.value===''?null:Number(ki.value)}});if(!Number.isInteger(min)||min<1||!Number.isInteger(max)||max<min||max>200||!Number.isFinite(rir)||rir<0||rir>10||increment!==null&&(!Number.isFinite(increment)||increment<=0)||sets.some(x=>x.reps!==null&&(!Number.isInteger(x.reps)||x.reps<1||x.reps>200)||x.kg!==null&&(!Number.isFinite(x.kg)||x.kg<0||x.kg>1000)))throw Error('Revisá la planificación.');e.plan={sets,min,max,rir,increment,reason:"Objetivo personalizado"};await persist();render();return}
if(a==='fill-goal'){
 const p=planOf(e), planned=p.sets;
 if(!planned.length||planned.some(x=>x.reps===null||x.kg===null||!Number.isFinite(Number(x.reps))||!Number.isFinite(Number(x.kg)))){
  alert('Para cargar el objetivo, primero definí el peso y las repeticiones de todas las series en «Editar objetivo».');return;
 }
 const hasData=[...c.querySelectorAll('.set-row [data-prop="reps"]')].some(x=>x.value.trim()!=='');
 if(hasData&&!confirm('Ya hay repeticiones cargadas. ¿Reemplazarlas por el objetivo planificado? El RIR no se modificará.'))return;
 const sameWeight=planned.every(x=>Number(x.kg)===Number(planned[0].kg));
 const baseWeight=Number(planned[0].kg);
 c.querySelector('[data-common="kg"]').value=String(baseWeight);
 // El RIR general y los RIR específicos se dejan tal como estén.
 const currentRir=c.querySelector('[data-common="rir"]').value.trim();
 const oldRows=[...c.querySelectorAll('.set-row')];
 const previous=oldRows.map(row=>({
  rirOverride:row.querySelector('[data-rir-override]').checked,
  rir:row.querySelector('[data-prop="rir-override"]').value.trim()
 }));
 const html=planned.map((x,j)=>{
  const isDifferent=Number(x.kg)!==baseWeight;
  const saved=previous[j];
  const effectiveRir=saved?.rirOverride&&saved.rir!==''?Number(saved.rir):currentRir===''?null:Number(currentRir);
  return setHTML({kg:Number(x.kg),reps:Number(x.reps),rir:effectiveRir},j,baseWeight,currentRir===''?null:Number(currentRir));
 }).join('');
 c.querySelector('.setrows').innerHTML=html;
 // Restaurar ajustes de RIR por serie, incluso si coincidían con el RIR general.
 [...c.querySelectorAll('.set-row')].forEach((row,j)=>{
  const saved=previous[j];if(!saved?.rirOverride)return;
  row.querySelector('[data-rir-override]').checked=true;
  row.querySelector('.override-rir').classList.remove('hidden');
  row.querySelector('[data-prop="rir-override"]').value=saved.rir;
  row.querySelector('.set-extra').classList.remove('hidden');
  row.querySelector('.adjust-btn').textContent='⚙ Ajustado';
  row.querySelector('.adjust-btn').classList.add('changed');
 });
 draftBadge(c);
 c.querySelector('.status').textContent='Objetivo cargado · completá el RIR y guardá el registro';
 return;
}
if(a==='save'){await saveCard(c);return}if(a==='history'){history(e);return}if(a==='delete-exercise'){if(!confirm('¿Eliminar este ejercicio de esta semana?'))return;day().exercises=day().exercises.filter(x=>x.id!==e.id);await persist();render();return}if(a==='add-set'||a==='remove-set'){const rows=c.querySelector('.setrows'),current=readCard(c);if(a==='add-set'){if(current.sets.length>=30){alert('Máximo 30 series.');return}current.sets.push({kg:null,reps:null,rir:null})}else{if(current.sets.length<=1)return;const index=Number(b.dataset.index);if(current.sets[index].reps!==null&&!confirm('¿Quitar esta serie?'))return;current.sets.splice(index,1)}const base=c.querySelector('[data-common=kg]').value.trim()===''?null:Number(c.querySelector('[data-common=kg]').value);const baseRir=c.querySelector('[data-common=rir]').value.trim()===''?null:Number(c.querySelector('[data-common=rir]').value);rows.innerHTML=current.sets.map((s,j)=>setHTML(s,j,base,baseRir)).join('');draftBadge(c)}}catch(err){alert(err.message)}});
$('days').onclick=ev=>{const b=ev.target.closest('[data-day]');if(!b||!guardDirty())return;currentDay=Number(b.dataset.day);render()};$('week').onchange=ev=>{if(!guardDirty()){$('week').value=currentWeek;return}currentWeek=Number(ev.target.value);currentDay=week().days[0].number;render()};
$('addDay').onclick=async()=>{if(!guardDirty())return;const w=week();if(w.days.length>=31){alert('Máximo 31 días por semana.');return}const num=Math.max(0,...w.days.map(d=>d.number))+1;const proposed='Día '+num;const raw=prompt('Nombre del nuevo día:',proposed);if(raw===null)return;const name=raw.trim();if(!name||name.length>60){alert('El nombre debe tener entre 1 y 60 caracteres.');return}w.days.push({number:num,name,exercises:[]});currentDay=num;try{await persist();render()}catch(e){w.days.pop();currentDay=w.days[0].number;alert('No se pudo crear el día: '+e.message)}};
$('renameDay').onclick=async()=>{if(!guardDirty())return;const d=day();const old=d.name;const raw=prompt('Nuevo nombre para este día:',d.name||'Día '+d.number);if(raw===null)return;const name=raw.trim();if(!name||name.length>60){alert('El nombre debe tener entre 1 y 60 caracteres.');return}d.name=name;try{await persist();render()}catch(e){if(old===undefined)delete d.name;else d.name=old;alert('No se pudo renombrar: '+e.message)}};

async function moveDay(dir){if(!guardDirty())return;const days=week().days;const at=days.findIndex(d=>d.number===currentDay),to=at+dir;if(to<0||to>=days.length)return;[days[at],days[to]]=[days[to],days[at]];try{await persist();render()}catch(err){[days[at],days[to]]=[days[to],days[at]];alert('No se pudo mover: '+err.message)}}
$('moveDayUp').onclick=()=>moveDay(-1);
$('moveDayDown').onclick=()=>moveDay(1);
$('deleteMenuToggle').onclick=()=>{const menu=$('deleteOptions');menu.classList.toggle('hidden');$('deleteMenuToggle').setAttribute('aria-expanded',String(!menu.classList.contains('hidden')))};
document.addEventListener('click',ev=>{if(!ev.target.closest('.delete-menu')){$('deleteOptions').classList.add('hidden');$('deleteMenuToggle').setAttribute('aria-expanded','false')}});
$('deleteOptions').addEventListener('click',ev=>{if(ev.target.closest('button')){$('deleteOptions').classList.add('hidden');$('deleteMenuToggle').setAttribute('aria-expanded','false')}});
$('deleteDay').onclick=async()=>{if(!guardDirty())return;const w=week(),d=day();if(w.days.length<=1){alert('Debe quedar al menos un día en la semana.');return}const count=d.exercises.filter(x=>x.updated).length;const msg=count?`Este día tiene ${count} ejercicio(s) guardado(s). Eliminarlo BORRARÁ sus registros de esta semana. No se tocarán otras semanas. ¿Continuar?`:`¿Eliminar «${d.name||'Día '+d.number}» de la semana actual?`;if(!confirm(msg))return;const before=w.days.slice(),previous=currentDay;w.days=w.days.filter(x=>x!==d);currentDay=w.days[Math.min(before.indexOf(d),w.days.length-1)].number;try{await persist();render()}catch(err){w.days=before;currentDay=previous;alert('No se pudo eliminar: '+err.message)}};
const LIBRARY=['Press de banca','Press inclinado','Press inclinado Hammer','Press militar','Aperturas en polea','Peck deck','Fondos','Jalón al pecho','Dominadas','Remo con barra','Remo con mancuerna','Remo en máquina','Remo con soporte pectoral','Pullover en polea','Curl con barra','Curl inclinado','Curl martillo','Curl predicador','Curl bayesiano','Extensión de tríceps en polea','Tríceps katana','Sentadilla','Sentadilla hack','Prensa 45°','Extensión de cuádriceps','Curl femoral sentado','Peso muerto rumano','Hip thrust','Gemelos de pie','Gemelos sentado','Elevaciones laterales','Pájaros','Peck deck reverso','Abdominales en polea','Plancha'];
function exerciseNames(){return [...new Set([...LIBRARY,...model.weeks.flatMap(w=>w.days.flatMap(d=>d.exercises.map(e=>e.name)))])].sort((a,b)=>a.localeCompare(b,'es'))}
async function createExercise(name){const clean=String(name||'').trim().slice(0,150);if(!clean){alert('Ingresá un nombre.');return}if(day().exercises.length>=200){alert('Máximo 200 ejercicios por día.');return}const same=model.weeks.flatMap(w=>w.days.flatMap(d=>d.exercises)).find(e=>e.name.toLocaleLowerCase()===clean.toLocaleLowerCase());const e={id:uid(),exerciseId:same?.exerciseId||uid(),name:clean,plan:{sets:[{kg:null,reps:10},{kg:null,reps:10},{kg:null,reps:10}],min:8,max:12,rir:1,increment:null},sets:[{kg:null,reps:null,rir:null},{kg:null,reps:null,rir:null},{kg:null,reps:null,rir:null}],notes:'',updated:null};day().exercises.push(e);try{await persist();$('overlay').classList.remove('open');render()}catch(err){day().exercises.pop();alert('No se pudo crear: '+err.message)}}
$('addExercise').onclick=()=>{if(!guardDirty())return;modal('Agregar ejercicio',`<p class="muted">Elegí uno de la lista o escribí uno propio.</p><input id="exerciseQuery" type="search" placeholder="Buscar o escribir ejercicio" maxlength="150" style="width:100%;margin-bottom:12px" aria-label="Buscar ejercicio"><div id="exerciseSuggestions" style="max-height:280px;overflow:auto"></div><div class="row" style="margin-top:12px"><button class="button primary small" id="createCustomExercise">+ Agregar el nombre escrito</button></div>`);const input=$('exerciseQuery');const draw=()=>{const q=input.value.toLocaleLowerCase().trim();const names=exerciseNames().filter(n=>n.toLocaleLowerCase().includes(q)).slice(0,35);$('exerciseSuggestions').innerHTML=names.map((n,i)=>`<button class="button small exercise-choice" data-name-index="${i}" style="display:block;width:100%;text-align:left;margin:4px 0">${escapeHtml(n)}</button>`).join('')||'<p class="muted">Sin coincidencias. Podés agregar tu ejercicio.</p>';window._obsSuggestions=names};input.addEventListener('input',draw);draw();input.focus()};
$('modalBody').addEventListener('click',async ev=>{const choice=ev.target.closest('[data-name-index]');if(choice){await createExercise(window._obsSuggestions[Number(choice.dataset.nameIndex)]);return}if(ev.target.closest('#createCustomExercise')){await createExercise($('exerciseQuery').value)}});

function proposal(source,mode){
 const p=planOf(source),existing=p.sets.map(s=>({...s}));
 if(mode==='manual')return {...p,sets:existing,reason:'Objetivo manual · editable'};
 if(mode==='deload')return {...p,rir:3.5,sets:existing.slice(0,Math.max(1,Math.ceil(existing.length*.5))).map(s=>({...s,reps:s.reps===null?null:Math.max(1,Math.min(s.reps,p.max))})),reason:'Descarga · menos series, más margen'};
 if(!completed(source))return {...p,sets:existing,reason:'Sin registro completo · mantenemos el objetivo'};
 const done=source.sets;
 // Nunca usamos un registro con diferente número de series o cargas sin equivalencia
 // para aumentar automáticamente la exigencia.
 const comparable=done.length===existing.length && done.every((s,i)=>s.kg!==null&&existing[i].kg!==null&&s.kg===existing[i].kg);
 if(!comparable)return {...p,sets:existing,reason:'Series o pesos distintos · revisá el objetivo'};
 const rirs=done.map(s=>s.rir);
 if(rirs.some(v=>v===null))return {...p,sets:existing,reason:'Falta RIR · mantenemos el objetivo'};
 const minRir=Math.min(...rirs);
 const pending=done.some((s,i)=>existing[i].reps!==null&&s.reps<existing[i].reps);
 if(pending)return {...p,sets:existing,reason:minRir===0?'Recuperar · completá las reps con mejor margen':'Recuperar · completá las reps pendientes'};
 const out=done.map(s=>({kg:s.kg,reps:s.reps}));
 const exceeded=done.some((s,i)=>existing[i].reps!==null&&s.reps>existing[i].reps);
 if(minRir===0)return {...p,sets:out,reason:exceeded?'Objetivo superado · ahora buscá mejor RIR':'Consolidar · mismas reps, mejor RIR'};
 if(minRir>=3 && out.every(s=>s.reps>=p.max)){
  if(p.increment&&out.every(s=>s.kg!==null))return {...p,sets:out.map(s=>({kg:Math.round((s.kg+p.increment)*100)/100,reps:p.min})),reason:'Progresar · aumento de peso propuesto'};
  return {...p,sets:out,reason:'Tope de reps · configurá subida de kg'};
 }
 let added=false;
 if(minRir>=2){out.forEach(s=>{if(s.reps<p.max){s.reps++;added=true}})}
 else if(minRir>=1){const first=out.find(s=>s.reps<p.max);if(first){first.reps++;added=true}}
 return {...p,sets:out,reason:added?(exceeded?'Superaste el objetivo · seguimos desde lo realizado':'Progresar · sumamos repeticiones'):(exceeded?'Objetivo superado · buen progreso':'Consolidar · mismo objetivo')};
}
async function makeWeek(mode){
 if(!guardDirty())return;
 const source=week();const next=Math.max(...model.weeks.map(w=>w.number))+1;
 const title=mode==='auto'?'Progresión automática':mode==='deload'?'Introducir descarga':'Agregar semana · Progresión manual';
 const explanation=mode==='manual'
  ? 'Se copiará la planificación y deberás realizar la sobrecarga progresiva de manera manual.'
  : mode==='deload'
    ? 'Se generará una propuesta automática de descarga que podrás modificar. Al terminar la descarga, la progresión continuará desde la última semana normal, no desde la descarga.'
    : 'Se propondrán objetivos automáticamente a partir de los registros. Podrás modificarlos.';
 if(!confirm(`${title}: crear semana ${next} desde la semana ${currentWeek}?\n\n${explanation}\n\nLos entrenamientos anteriores no se modificarán.`))return;
 const nw={number:next,kind:mode==='deload'?'deload':'normal',days:source.days.map(d=>({number:d.number,name:d.name||'Día '+d.number,exercises:d.exercises.map(e=>{
   let plan;
   if(mode==='deload'){plan=proposal(e,'deload')}
   else if(source.kind==='deload'&&(mode==='auto'||mode==='manual')){
     // Recuperar la última planificación normal, nunca tomar la descarga como referencia.
     const previous=model.weeks.filter(w=>w.number<source.number&&w.kind!=='deload').sort((a,b)=>b.number-a.number)[0];
     const original=previous?.days.flatMap(day=>day.exercises).find(x=>x.exerciseId===e.exerciseId);
     plan=original?proposal(original,'manual'):proposal(e,'manual');
   }else plan=proposal(e,mode);
   return {id:uid(),exerciseId:e.exerciseId,name:e.name,plan,sets:plan.sets.map(()=>({kg:null,reps:null,rir:null})),notes:'',updated:null};
 })}))};
 const oldWeek=currentWeek,oldDay=currentDay;
 model.weeks.push(nw);currentWeek=next;currentDay=nw.days[0].number;
 try{await persist();render();alert(`${title}: semana creada. Los objetivos están separados de lo realizado y se pueden editar.`)}catch(e){model.weeks.pop();currentWeek=oldWeek;currentDay=oldDay;alert('Error al crear semana: '+e.message)}
}
$('deleteWeek').onclick=async()=>{
 if(!guardDirty())return;
 if(model.weeks.length<=1){alert('Debe quedar al menos una semana.');return;}
 const target=week();
 const count=target.days.reduce((n,d)=>n+d.exercises.filter(e=>e.updated).length,0);
 const text=count
  ? `Eliminar la Semana ${target.number} borrará ${count} ejercicio(s) registrados, sus objetivos y notas. Esto no se puede deshacer sin un respaldo. Las otras semanas no se borran. ¿Continuar?`
  : `¿Eliminar la Semana ${target.number} y todos sus días y ejercicios? Las otras semanas no se borran.`;
 if(!confirm(text))return;
 const originalWeeks=model.weeks.slice(),oldWeek=currentWeek,oldDay=currentDay;
 model.weeks=model.weeks.filter(w=>w!==target);
 const ordered=[...model.weeks].sort((a,b)=>a.number-b.number);
 const previous=ordered.filter(w=>w.number<oldWeek).pop();
 const selected=previous||ordered[0];
 currentWeek=selected.number;
 currentDay=selected.days[0].number;
 try{await persist();render()}
 catch(err){model.weeks=originalWeeks;currentWeek=oldWeek;currentDay=oldDay;alert('No se pudo eliminar la semana: '+err.message)}
};
$('addWeek').onclick=()=>makeWeek('manual');
$('autoWeek').onclick=()=>makeWeek('auto');
$('deloadWeek').onclick=()=>makeWeek('deload');
$('export').onclick=()=>{const blob=new Blob([JSON.stringify(model,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Obsidiana-respaldo-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};$('import').onclick=()=>{if(guardDirty())$('importFile').click()};$('importFile').onchange=async ev=>{const f=ev.target.files[0];if(!f)return;try{if(f.size>10*1024*1024)throw Error('Archivo demasiado grande.');const obj=JSON.parse(await f.text());validate(obj);if(!confirm('¿Reemplazar todos los datos locales con este respaldo? Exportá una copia primero.'))return;model=obj;currentWeek=model.weeks[0].number;currentDay=model.weeks[0].days[0].number;await persist();render();alert('Respaldo importado.')}catch(err){alert('No se pudo importar: '+err.message)}finally{ev.target.value=''}};
$('closeModal').onclick=()=>$('overlay').classList.remove('open');$('overlay').onclick=ev=>{if(ev.target===$('overlay'))$('overlay').classList.remove('open')};
let duration=120,remaining=120,deadline=null;function timerRender(){const n=deadline?Math.max(0,Math.ceil((deadline-Date.now())/1000)):remaining;const t=String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');$('timer').textContent=t;$('mobileTimer').textContent=t;$('timerToggle').textContent=deadline?'Pausar':'Iniciar';$('mobileToggle').textContent=deadline?'Pausar':'Iniciar';if(deadline&&n===0){deadline=null;remaining=0;try{navigator.vibrate?.([150,90,150])}catch(_){}}}function toggle(){if(deadline){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));deadline=null}else{if(remaining<=0)remaining=duration;deadline=Date.now()+remaining*1000}timerRender()}function reset(){remaining=duration;deadline=null;timerRender()}$('timerToggle').onclick=$('mobileToggle').onclick=toggle;$('timerReset').onclick=$('mobileReset').onclick=reset;$('duration').onchange=e=>{duration=Number(e.target.value);reset()};setInterval(timerRender,500);document.addEventListener('visibilitychange',timerRender);
window.addEventListener('beforeunload',event=>{if(document.querySelector('[data-dirty="1"]')){event.preventDefault();event.returnValue=''}});
(async()=>{try{db=await openDB();model=await getDB()||fresh();validate(model);currentWeek=model.weeks.some(w=>w.number===model.week)?model.week:model.weeks[0].number;currentDay=week().days[0].number;render();if(typeof updateWorkspaceBar==='function')updateWorkspaceBar()}catch(err){$('cards').innerHTML='<div class="blank">No se pudo abrir el almacenamiento local: '+escapeHtml(err.message)+'. Abrí la app desde un servidor local (localhost) o desde una instalación compatible.</div>';console.error(err)}})();
