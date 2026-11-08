'use strict';
const $=id=>document.getElementById(id), escapeHtml=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DB='obsidiana-local-v2', STORE='state';let db,model,currentWeek=1,currentDay=1;
function uid(){return crypto.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2)}
function openDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore(STORE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function getDB(){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get('main');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
function putDB(v){return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(v,'main');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error)})}
function fresh(){return {version:2,week:1,weeks:[{number:1,days:[1,2,3,4,5].map(n=>({number:n,exercises:[]}))}]}}
function week(){return model.weeks.find(w=>w.number===currentWeek)}function day(){return week().days.find(d=>d.number===currentDay)}
function validate(m){if(!m||m.version!==2||!Array.isArray(m.weeks)||!m.weeks.length||m.weeks.length>500)throw Error('Archivo no compatible con Obsidiana V2.');const ids=new Set();for(const w of m.weeks){if(!Number.isInteger(w.number)||!Array.isArray(w.days)||w.days.length<1||w.days.length>31)throw Error('Semanas inválidas.');for(const d of w.days){if(!Number.isInteger(d.number)||d.number<1||!Array.isArray(d.exercises)||d.exercises.length>200||(d.name!==undefined&&(typeof d.name!=='string'||d.name.length>60)))throw Error('Días inválidos.');for(const e of d.exercises){if(typeof e.id!=='string'||ids.has(e.id)||typeof e.name!=='string'||e.name.length>150||!Array.isArray(e.sets)||e.sets.length>30||typeof e.notes!=='string'||e.notes.length>5000)throw Error('Datos de ejercicios inválidos.');if(e.videoUrl!==undefined&&(typeof e.videoUrl!=='string'||e.videoUrl.length>2048||e.videoUrl!==''&&!/^https:\/\//i.test(e.videoUrl)))throw Error('Enlace de video inválido.');ids.add(e.id);for(const s of e.sets){for(const key of ['kg','reps','rir'])if(s[key]!==null&&!(typeof s[key]==='number'&&Number.isFinite(s[key])&&s[key]>=0&&s[key]<=1000))throw Error('Serie inválida.');if(s.sides!==undefined){for(const side of ['left','right'])for(const k of ['kg','reps','rir']){const v=s.sides?.[side]?.[k];if(v!==null&&v!==undefined&&!(typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1000))throw Error('Serie unilateral inválida.')}}}if(e.unilateral!==undefined&&typeof e.unilateral!=='boolean')throw Error('Tipo de ejercicio inválido.')}}}}
async function persist(){model.week=currentWeek;if(typeof rememberWorkspace==='function')rememberWorkspace();validate(model);await putDB(model)}
function effortScale(){return model?.effortScale==='rpe'?'rpe':'rir'}
function effortLabel(){return effortScale().toUpperCase()}
function shownEffort(rir){if(rir===null||rir===undefined)return null;return effortScale()==='rpe'?ObsidianaProgression.rirToRpe(rir):rir}
function enteredRir(value){return effortScale()==='rpe'?ObsidianaProgression.rpeToRir(value):value}
function effortText(rir){return rir===null||rir===undefined?'':effortLabel()+' '+shownEffort(rir)}
function effortRange(){return effortScale()==='rpe'?'min="1" max="10"':'min="0" max="10"'}
function planOf(e){
 if(!e.plan){const current=e.sets||[];e.plan={sets:current.map(x=>({kg:x.kg,reps:x.reps})),min:8,max:12,rir:1,increment:null}}
 e.plan.min??=8;e.plan.max??=12;e.plan.rir??=1;e.plan.increment??=null;e.plan.volumeEnabled??=true;
 return e.plan;
}
function planText(e){const p=planOf(e),reps=p.sets.map(s=>s.reps??'—').join('-');const weights=[...new Set(p.sets.map(s=>s.kg).filter(x=>x!==null))];return `${e.unilateral?'Unilateral · ':''}${p.sets.length} series · ${reps} reps · ${weights.length===1?weights[0]+' kg':weights.length?'cargas variadas':'peso a definir'} · ${effortLabel()} objetivo ${shownEffort(p.rir)}`}
function inputNumber(v){return v===null||v===undefined?'':v}
function reasonClass(reason){const r=String(reason||'').toLocaleLowerCase('es');if(r.startsWith('recuperar')||r.startsWith('no alcanzaste'))return 'recuperar';if(r.startsWith('consolidar')||r.startsWith('llegaste al límite'))return 'consolidar';if(r.startsWith('progresar')||r.startsWith('progresamos')||r.startsWith('subimos carga'))return 'progresar';if(r.startsWith('superaste')||r.startsWith('objetivo superado'))return 'superado';if(r.startsWith('descarga'))return 'descarga';if(r.includes('manual')||r.includes('personalizado'))return 'manual';return 'neutral'}
function previousExercise(e){
 if(!model||!Array.isArray(model.weeks))return null;
 const older=model.weeks.filter(w=>w.number<currentWeek).sort((a,b)=>b.number-a.number);
 for(const w of older){
  const match=w.days.flatMap(d=>d.exercises).find(x=>x.exerciseId===e.exerciseId);
  if(match)return {week:w,exercise:match};
 }
 return null;
}
// Las semanas creadas con versiones viejas conservan plan.reason.
// El texto visible se recalcula sin editar ni borrar los datos originales.
function actualProgressReason(e){
 const p=planOf(e),reason=p.reason||'';
 if(e.unilateral){
  const match=reason.match(/^Izquierda: (.*?) · Derecha: (.*)$/s);
  if(match){
   if(match[1]===match[2])return 'Ambos lados · '+ObsidianaProgression.displayReason(match[1]);
   return 'Izquierda: '+ObsidianaProgression.displayReason(match[1])+'\nDerecha: '+ObsidianaProgression.displayReason(match[2]);
  }
 }
 if(!/^(progresar|progresamos)/i.test(reason)||!/rep(etici[oó]n|s)?/i.test(reason))return ObsidianaProgression.displayReason(reason);
 const prev=previousExercise(e);
 if(!prev?.exercise.updated)return ObsidianaProgression.displayReason(reason);
 return ObsidianaProgression.describeRepetitionProgress(prev.exercise.sets,p.sets)||ObsidianaProgression.displayReason(reason);
}
function openWeekComparison(e){
 // Comparación estrictamente por ejercicio. Se consultan los datos persistidos,
 // nunca entradas todavía sin guardar en el formulario.
 const earlier=model.weeks.filter(w=>w.number<currentWeek).sort((a,b)=>b.number-a.number);
 const previous=earlier.find(w=>w.days.some(d=>d.exercises.some(x=>x.exerciseId===e.exerciseId)));
 if(!previous){alert('No hay una semana anterior con este ejercicio.');return}
 const old=previous.days.flatMap(d=>d.exercises).find(x=>x.exerciseId===e.exerciseId);
 const oldPlan=planOf(old),newPlan=planOf(e);
 const pill=(s,i,effort,performed=false)=>{
  if(s?.sides){return `<span class="compare-series-chip"><b>S${i+1}</b> ${['left','right'].map(side=>{const x=s.sides?.[side]||s;const goal=s.sides?.[side]||s;const kg=x.kg??s.kg??'—', reps=x.reps??s.reps??'—';const v=x.rir??(typeof effort==='number'?effort:null);return `${side==='left'?'Izq.':'Der.'} ${escapeHtml(kg)} kg × ${escapeHtml(reps)}${v==null?'':' · '+escapeHtml(effortText(v))}`}).join(' / ')}</span>`}
  return `<span class="compare-series-chip"><b>S${i+1}</b> ${s?.kg??'—'} kg × ${s?.reps??'—'} reps${effort===null||effort===undefined?'':` · ${escapeHtml(effortText(effort))}`}</span>`;
 };
 const area=(title,sub,sets,effort,extra='')=>`<section class="compare-block"><div class="compare-block-head"><strong>${escapeHtml(title)}</strong><small>${escapeHtml(sub)}</small></div><div class="compare-series">${sets.length?sets.map((s,i)=>pill(s,i,typeof effort==='function'?effort(s,i):effort)).join(''):'<span class="muted">Sin series</span>'}</div>${extra}</section>`;
 const prevPlanned=area(`Semana ${previous.number} · objetivo planificado`,`Rango ${oldPlan.min??8}–${oldPlan.max??12} reps · ${effortLabel()} objetivo ${shownEffort(oldPlan.rir)}`,oldPlan.sets,null);
 const prevActual=area(`Semana ${previous.number} · realizado`,old.updated?'Datos que guardaste después de entrenar':'Sin registro guardado',old.updated?old.sets:[],s=>s.rir,old.notes?`<p class="compare-note"><strong>Comentarios:</strong> ${escapeHtml(old.notes)}</p>`:'');
 const curGoal=area(`Semana ${currentWeek} · objetivo actual`,`Rango ${newPlan.min??8}–${newPlan.max??12} reps · ${effortLabel()} objetivo ${shownEffort(newPlan.rir)}`,newPlan.sets,null);
 const changes=[];
 if(old.updated){for(let i=0;i<Math.max(old.sets.length,newPlan.sets.length);i++){
  const before=old.sets[i],after=newPlan.sets[i];
  if(before && after && (before.reps!==after.reps||before.kg!==after.kg)) changes.push(`S${i+1}: ${before.kg??'—'} kg × ${before.reps??'—'} → ${after.kg??'—'} kg × ${after.reps??'—'}`);
 }}
 const summary=old.updated
  ? `<div class="compare-changes"><b>Cambios propuestos desde lo realizado</b><p>${changes.length?changes.map(escapeHtml).join('<br>'):'No hay cambios de carga ni repeticiones.'}</p></div>`
  : `<p class="muted">Para comparar la progresión es necesario guardar las series de la semana anterior.</p>`;
 const textReason=actualProgressReason(e);
 const note=textReason?`<div class="compare-reason">${escapeHtml(textReason)}</div>`:'';
 const cmpRows=Array.from({length:Math.max(oldPlan.sets.length,old.updated?old.sets.length:0,newPlan.sets.length)},(_,i)=>{
   const a=oldPlan.sets[i],b=old.updated?old.sets[i]:null,c=newPlan.sets[i];
   const fmt=(s,side)=>{
    if(!s)return '—';
    const v=side?(s.sides?.[side]||{}):s;
    return `${v.reps??s.reps??'—'} × ${v.kg??s.kg??'—'} kg`;
   };
   const delta=(before,after)=>before&&after&&Number.isFinite(before.reps)&&Number.isFinite(after.reps)&&before.kg===after.kg
    ?(after.reps>before.reps?`+${after.reps-before.reps} rep`:after.reps<before.reps?`${after.reps-before.reps} rep`:'='):'—';
   if(old.unilateral||e.unilateral){return ['left','right'].map(side=>{
    const bv=b?.sides?.[side],cv=c?ObsidianaProgression.goalSide(c,side):null;
    return `<tr><th>S${i+1} ${side==='left'?'Izq.':'Der.'}</th><td>${escapeHtml(fmt(a,side))}</td><td>${escapeHtml(fmt(b,side))}</td><td>${escapeHtml(fmt(c,side))}</td><td class="cmp-delta">${escapeHtml(delta(bv,cv))}</td></tr>`;
   }).join('')}
   return `<tr><th>S${i+1}</th><td>${escapeHtml(fmt(a))}</td><td>${escapeHtml(fmt(b))}</td><td>${escapeHtml(fmt(c))}</td><td class="cmp-delta">${escapeHtml(delta(b,c))}</td></tr>`;
 }).join('');
 const table=`<div class="compare-table-wrap"><table class="compare-table"><caption>Comparación por serie</caption><thead><tr><th>Serie</th><th>Objetivo anterior</th><th>Realizado</th><th>Objetivo actual</th><th>Cambio</th></tr></thead><tbody>${cmpRows}</tbody></table></div>`;
 modal('Comparación · '+e.name,`<div class="compare-guide">Semana ${previous.number}: <strong>objetivo planificado y resultado real</strong> → Semana ${currentWeek}: <strong>objetivo nuevo</strong>. Todos los valores son por serie.</div>${table}${prevPlanned}${prevActual}${curGoal}${summary}${note}`);
}

function planSetMarkup(x,i){
 const baseR=x.reps??null,baseK=x.kg??null;
 const overrideValue=(side,key)=>{
  const xval=x.sides?.[side]?.[key];
  return xval!=null&&Number(xval)!==Number(key==='kg'?baseK:baseR)?xval:null;
 };
 const hasDifference=['left','right'].some(side=>['reps','kg'].some(key=>overrideValue(side,key)!==null));
 const preferredSide=['left','right'].find(side=>['reps','kg'].some(key=>overrideValue(side,key)!==null))||'left';
 const sideUI=side=>{
  const name=side==='left'?'Izquierda':'Derecha';
  return `<div class="plan-side-target ${side!==preferredSide?'hidden':''}" data-editor-side="${side}"><b>Solo ${name.toLowerCase()}</b><label>Reps<input data-plan-side="${side}-reps" type="number" min="1" max="200" inputmode="numeric" placeholder="Igual" value="${escapeHtml(inputNumber(overrideValue(side,'reps')))}" aria-label="${name}: repeticiones diferentes"></label><label>kg<input data-plan-side="${side}-kg" type="number" min="0" max="1000" step="any" inputmode="decimal" placeholder="Igual" value="${escapeHtml(inputNumber(overrideValue(side,'kg')))}" aria-label="${name}: peso diferente"></label></div>`;
 };
 return `<div class="plan-set-row" data-plan-series-row>
   <span class="plan-set-label">S${i+1}</span>
   <input data-plan-reps="${i}" type="number" min="1" max="200" step="1" inputmode="numeric" placeholder="Reps" aria-label="Repeticiones objetivo serie ${i+1}" value="${escapeHtml(inputNumber(baseR))}">
   <input data-plan-kg="${i}" type="number" min="0" max="1000" step="any" inputmode="decimal" placeholder="kg" aria-label="Peso objetivo serie ${i+1}" value="${escapeHtml(inputNumber(baseK))}">
   <button type="button" class="plan-remove-set" data-action="remove-plan-set" title="Quitar serie del objetivo" aria-label="Quitar serie ${i+1} del objetivo">×</button>
   <div class="plan-side-controls"><button type="button" class="button small sides-toggle ${hasDifference?'changed':''}" data-action="toggle-plan-sides" aria-expanded="${hasDifference}">${hasDifference?'✓ Objetivo distinto por lado':'¿Objetivo distinto en un lado?'}</button></div>
   <div class="plan-side-targets ${hasDifference?'':'hidden'}"><p class="side-panel-help">Si el objetivo es igual a ambos lados, no modifiques nada. Si cambia, elegí el lado y completá solo lo diferente.</p><div class="side-chooser"><button type="button" data-action="choose-side" data-choice="left" aria-pressed="${preferredSide==='left'}">Izquierda</button><button type="button" data-action="choose-side" data-choice="right" aria-pressed="${preferredSide==='right'}">Derecha</button></div>${sideUI('left')}${sideUI('right')}<span class="side-fallback-hint">Los campos vacíos mantienen las repeticiones y kg generales.</span></div>
 </div>`;
}
function renumberPlanRows(c){
 [...c.querySelectorAll('[data-plan-series-row]')].forEach((row,i)=>{
  row.querySelector('.plan-set-label').textContent='S'+(i+1);
  const reps=row.querySelector('[data-plan-reps]'),kg=row.querySelector('[data-plan-kg]'),remove=row.querySelector('[data-action="remove-plan-set"]');
  reps.dataset.planReps=String(i);kg.dataset.planKg=String(i);remove.dataset.index=String(i);
  reps.setAttribute('aria-label','Repeticiones objetivo serie '+(i+1));
  kg.setAttribute('aria-label','Peso objetivo serie '+(i+1));
  remove.setAttribute('aria-label','Quitar serie '+(i+1)+' del objetivo');
 });
}
function planMarkup(e){
 const p=planOf(e);
 const sameKg=p.sets.length>0&&p.sets.every(s=>s.kg!==null&&s.kg===p.sets[0].kg);
 return `<div class="plan-panel ${e.unilateral?'editing-unilateral':''}">
  <div class="plan-top"><strong>OBJETIVO PLANIFICADO</strong><div class="plan-tools">${model.weeks.some(w=>w.number<currentWeek&&w.days.some(d=>d.exercises.some(x=>x.exerciseId===e.exerciseId)))?`<button type="button" class="button small" data-action="toggle-previous">↶ Comparar semanas</button>`:``}${e.videoUrl?`<button type="button" class="button small obs-video-open" data-action="open-video">▶ Ver video</button>`:``}<button type="button" class="button small" data-action="edit-video">${e.videoUrl?"✎ Video":"+ Video"}</button><button type="button" class="button small" data-action="toggle-plan">✎ Editar objetivo</button></div></div>
  <div class="plan-line">${escapeHtml(planText(e))}</div>${actualProgressReason(e)?`<div class="plan-reason ${reasonClass(actualProgressReason(e))}">${escapeHtml(actualProgressReason(e)).replace(/\n/g,'<br>')}</div>`:``}${(p.requiresWeightReview||/revisar carga/i.test(p.reason||''))?`<button type="button" class="button small weight-cta" data-action="configure-increment">↗ Elegir subida de peso</button>`:''}
  <div class="plan-edit hidden">
   <label class="unilateral-toggle"><input type="checkbox" data-plan="unilateral" ${e.unilateral?'checked':''}> Ejercicio unilateral · registrar izquierda y derecha por separado</label>
   <label>Reps mín.<input data-plan="min" type="number" min="1" max="200" value="${p.min}"></label>
   <label>Reps máx.<input data-plan="max" type="number" min="1" max="200" value="${p.max}"></label>
   <label>${effortLabel()} objetivo<input data-plan="rir" type="number" ${effortRange()} step="0.5" inputmode="decimal" value="${shownEffort(p.rir)}"></label>
   <label class="increment-field">¿Cuánto subir de peso? (+kg)<input data-plan="increment" type="number" min="0" max="100" step="any" inputmode="decimal" placeholder="Ej. 2,5" value="${inputNumber(p.increment)}"></label><div class="increment-helper"><span>Elegí el menor aumento que permita esa máquina o mancuerna:</span><div class="increment-presets">${[1,2,2.5,5].map(k=>`<button type="button" class="button small ${p.increment===k?'selected':''}" data-action="quick-increment" data-value="${k}">+${String(k).replace('.',',')} kg</button>`).join('')}</div><small>Es el aumento del peso que registrás: en un unilateral se aplica a cada lado por separado. Queda guardado para las próximas semanas.</small></div>
   <div class="plan-set-section">
    <label class="plan-general-weight">Peso para todas las series (kg)
     <input data-plan="all-kg" type="number" min="0" max="1000" step="any" inputmode="decimal" placeholder="Ej. 66" value="${sameKg?inputNumber(p.sets[0].kg):''}">
    </label>
    <p class="plan-help">Se completa en todas las series. Solo si un lado tiene otro objetivo, tocá «¿Objetivo distinto en un lado?».</p>
    <div class="plan-series-heading"><span></span><span>REPS</span><span>KG</span><span></span></div>
    <div class="plan-series-list">${p.sets.map(planSetMarkup).join('')}</div>
    <div class="plan-series-actions">
     <button type="button" class="button small" data-action="add-plan-set">+ Serie objetivo</button>
     <span class="plan-set-counter">${p.sets.length} series</span>
    </div>
    <label class="volume-option"><input type="checkbox" data-plan="volumeEnabled" ${p.volumeEnabled!==false?'checked':''}> Avisarme si conviene evaluar una serie adicional (nunca automática)</label>
    <button type="button" class="button small primary plan-save" data-action="save-plan">Guardar objetivo</button>
    ${p.volumeCandidate?'<button type="button" class="button small" data-action="apply-volume">+ 1 serie sugerida</button>':''}
   </div>
  </div>
 </div>`;
}
function completeSet(s){return s?.kg!==null&&s?.kg!==undefined&&Number.isFinite(s.kg)&&s?.reps>0&&s?.rir!==null&&s?.rir!==undefined&&Number.isFinite(s.rir)}
function completed(e){return !!e.updated&&e.sets.length>0&&e.sets.every(s=>e.unilateral?completeSet(s.sides?.left)&&completeSet(s.sides?.right):completeSet(s))}
function summary(e){
 if(!completed(e))return `${e.sets.length} series · Pendiente${e.unilateral?' (izq. y der.)':''}`;
 if(e.unilateral)return `Unilateral · ${e.sets.length} series · izquierda / derecha · ${effortLabel()} por lado`;
 const weights=[...new Set(e.sets.map(s=>s.kg))];
 const rirs=[...new Set(e.sets.map(s=>s.rir))];
 const reps=e.sets.map(s=>s.reps).join('-');
 if(weights.length===1 && rirs.length===1)return `${weights[0]} kg · ${reps} reps${rirs[0]!==null?' · '+effortText(rirs[0]):''}`;
 if(weights.length===1)return `${weights[0]} kg · ${reps} reps · ${effortLabel()} variable`;
 return `Pesos variables · ${e.sets.length} series`;
}
function compactDetails(e){
 if(!completed(e))return '';
 if(e.unilateral)return `<div class="series-preview">${e.sets.map((s,i)=>`<span><b>S${i+1}</b> Izq. ${s.sides.left.kg}kg × ${s.sides.left.reps} / Der. ${s.sides.right.kg}kg × ${s.sides.right.reps}</span>`).join('')}</div>`;
 const weights=[...new Set(e.sets.map(s=>s.kg))];
 const rirs=[...new Set(e.sets.map(s=>s.rir))];
 if(weights.length===1&&rirs.length===1)return '';
 return `<div class="series-preview">${e.sets.map((s,i)=>`<span><b>S${i+1}</b> ${escapeHtml(s.kg)} kg × ${escapeHtml(s.reps)}${rirs.length>1?' · '+escapeHtml(effortText(s.rir)):''}</span>`).join('')}</div>`;
}
function seriesDetail(e){
 if(e.unilateral)return e.sets.map((s,i)=>`<div class="hist-series unilateral-hist"><strong>S${i+1}</strong>${['left','right'].map(side=>{const x=s.sides?.[side];return `<span>${side==='left'?'Izq.':'Der.'}: <b>${escapeHtml(x?.kg??'—')} kg</b> × ${escapeHtml(x?.reps??'—')} · ${effortLabel()} ${escapeHtml(shownEffort(x?.rir)??'—')}</span>`}).join('')}</div>`).join('');
 return e.sets.map((s,i)=>`<div class="hist-series"><span>Serie ${i+1}</span><b>${escapeHtml(s.kg??'—')} kg</b><span>${escapeHtml(s.reps??'—')} reps</span><span>${effortLabel()} ${escapeHtml(shownEffort(s.rir)??'—')}</span></div>`).join('');
}
function render(){if($('effortScale'))$('effortScale').value=effortScale();model.weeks.sort((a,b)=>a.number-b.number);$('week').innerHTML=model.weeks.map(w=>`<option value="${w.number}">Semana ${w.number}</option>`).join('');$('week').value=currentWeek;$('bigWeek').textContent=String(currentWeek).padStart(2,'0');$('days').innerHTML=week().days.map(d=>`<button class="day ${d.number===currentDay?'active':''}" data-day="${d.number}"><b>${escapeHtml(d.name||'Día '+d.number)}</b><small>${d.exercises.filter(completed).length}/${d.exercises.length} completos</small></button>`).join('');$('dayTitle').textContent=day().name||'Día '+currentDay;const es=day().exercises;$('progress').style.width=(es.length?100*es.filter(completed).length/es.length:0)+'%';$('summary').textContent=`${es.filter(completed).length} de ${es.length} ejercicios · ${es.reduce((a,e)=>a+e.sets.filter(s=>s.reps!==null).length,0)} series registradas`;$('cards').innerHTML=es.length?es.map((e,i)=>{planOf(e);const base=e.sets[0]?.kg??(e.unilateral?planOf(e).sets[0]?.kg:null)??null;const rirs=e.sets.flatMap(s=>e.unilateral?[s.sides?.left?.rir,s.sides?.right?.rir]:[s.rir]).filter(v=>v!==null&&v!==undefined);const rir=rirs.length?rirs.reduce((a,v)=>rirs.filter(x=>x===v).length>rirs.filter(x=>x===a).length?v:a,rirs[0]):null;return `<details class="card ${completed(e)?'complete':''}" data-id="${escapeHtml(e.id)}"><summary><span class="count">${completed(e)?'✓':i+1}</span><div class="title"><b>${escapeHtml(e.name)}</b><small>${escapeHtml(summary(e))}</small>${compactDetails(e)}</div><span class="muted">⌄</span></summary><div class="body">${planMarkup(e)}<div class="common-fields"><label>Peso general (kg)<input data-common="kg" type="number" min="0" max="1000" step="any" inputmode="decimal" placeholder="Ej. 60" value="${base??''}"></label><label>${effortLabel()} general<input data-common="rir" type="number" ${effortRange()} step="0.5" inputmode="decimal" placeholder="${effortScale()==='rpe'?'Ej. 9':'Ej. 1'}" value="${shownEffort(rir)??''}"></label></div>${e.unilateral?'<p class="unilateral-tip">Completá una sola vez las reps por serie: se registran para izquierda y derecha. Solo tocá «Cambiar un lado» si fueron diferentes.</p>':''}<div class="sets-header"><span>Nº</span><span>REPS</span><span></span><span></span></div><div class="setrows">${e.sets.map((set,j)=>setHTML(set,j,base,rir,!!e.unilateral)).join('')}</div><div class="actions"><button type="button" class="button small goal-fill" data-action="fill-goal" title="Completa peso y repeticiones según el objetivo, sin cargar el esfuerzo ni guardar">✓ Cargar objetivo</button><button class="button small" data-action="add-set">+ Serie</button><button class="button small" data-action="history">Historial</button><button class="button small danger" data-action="delete-exercise">Eliminar ejercicio</button></div><label>Notas del ejercicio<textarea data-notes maxlength="5000" placeholder="Cómo te sentiste, cambio de máquina, molestias, técnica…">${escapeHtml(e.notes)}</textarea></label><div class="actions"><button class="button primary small" data-action="save">Guardar registro ✓</button></div><div class="status">${e.updated?'Guardado · '+new Date(e.updated).toLocaleString('es-AR'):'Pendiente de guardar'}</div></div></details>`}).join(''):'<div class="blank">Todavía no hay ejercicios en este día. Tocá «+ Ejercicio» para empezar.</div>'}
function setHTML(s,j,base,baseRir=null,unilateral=false){
 if(unilateral){
  const l=s.sides?.left||{},r=s.sides?.right||{};
  // El registro se carga como una serie común. Sólo desdoblamos si hay diferencias reales.
  const commonReps=s.reps??l.reps??r.reps??null;
  const baseKg=base??s.kg??l.kg??r.kg??null;
  const commonEffort=baseRir??s.rir??l.rir??r.rir??null;
  const overrides={};
  let hasDifference=false;
  for(const side of ['left','right']){
   const x=side==='left'?l:r;
   overrides[side]={};
   for(const key of ['reps','kg','rir']){
    const fallback=key==='reps'?commonReps:key==='kg'?baseKg:commonEffort;
    const value=x[key];
    const changed=value!==null&&value!==undefined&&Number(value)!==Number(fallback);
    if(changed)hasDifference=true;
    overrides[side][key]=changed?value:null;
   }
  }
  const preferredSide=['left','right'].find(side=>['reps','kg','rir'].some(key=>overrides[side][key]!=null))||'left';
  const sideUI=side=>{
   const title=side==='left'?'Izquierda':'Derecha',x=overrides[side];
   return `<div class="side-exception ${side!==preferredSide?'hidden':''}" data-editor-side="${side}"><b>Solo ${title.toLowerCase()}</b><div class="side-exception-fields"><label>Reps<input data-side="${side}" data-field="reps" type="number" min="0" max="200" inputmode="numeric" placeholder="Igual" value="${escapeHtml(inputNumber(x.reps))}"></label><label>kg<input data-side="${side}" data-field="kg" type="number" min="0" max="1000" step="any" inputmode="decimal" placeholder="Igual" value="${escapeHtml(inputNumber(x.kg))}"></label><label>${effortLabel()}<input data-side="${side}" data-field="rir" type="number" ${effortRange()} step="0.5" inputmode="decimal" placeholder="Igual" value="${escapeHtml(inputNumber(shownEffort(x.rir)))}"></label></div></div>`;
  };
  return `<div class="set-row unilateral-set-row compact-unilateral"><span class="set-number">${j+1}</span><input data-prop="reps" type="number" min="0" max="200" inputmode="numeric" placeholder="Reps ambos lados" value="${escapeHtml(inputNumber(commonReps))}" aria-label="Serie ${j+1}, repeticiones para ambos lados"><button type="button" class="adjust-btn sides-toggle ${hasDifference?'changed':''}" data-action="toggle-side-difference" aria-expanded="${hasDifference}">${hasDifference?'✓ Lado ajustado':'Cambiar un lado'}</button><button class="remove" data-action="remove-set" data-index="${j}" aria-label="Quitar serie">×</button><div class="side-exception-panel ${hasDifference?'':'hidden'}"><p>¿Qué lado fue diferente? Tocá el lado y cambiá solamente el dato distinto. El otro mantiene los valores generales.</p><div class="side-chooser"><button type="button" data-action="choose-side" data-choice="left" aria-pressed="${preferredSide==='left'}">Izquierda</button><button type="button" data-action="choose-side" data-choice="right" aria-pressed="${preferredSide==='right'}">Derecha</button></div>${sideUI('left')}${sideUI('right')}</div></div>`;
 }
 const override=s.kg!==null&&base!==null&&s.kg!==base;
 const overrideRir=s.rir!==null&&baseRir!==null&&s.rir!==baseRir;
 const expanded=override||overrideRir;
 return `<div class="set-row"><span class="set-number">${j+1}</span><input data-prop="reps" type="number" min="0" max="200" step="1" inputmode="numeric" placeholder="Reps" value="${s.reps??''}" aria-label="Repeticiones de serie ${j+1}"><button type="button" class="adjust-btn ${expanded?'changed':''}" data-action="toggle-adjust" aria-expanded="${expanded}" title="Ajustar peso o ${effortLabel()}">${expanded?'⚙ Ajustado':'⚙ Ajustar'}</button><button class="remove" data-action="remove-set" data-index="${j}" aria-label="Quitar serie">×</button><div class="set-extra ${expanded?'':'hidden'}"><label class="weight-override"><input type="checkbox" data-override ${override?'checked':''}> Peso diferente</label><label class="override-kg ${override?'':'hidden'}">kg<input data-prop="kg-override" type="number" min="0" max="1000" step="any" inputmode="decimal" value="${override?s.kg:''}"></label><label class="weight-override"><input type="checkbox" data-rir-override ${overrideRir?'checked':''}> ${effortLabel()} diferente</label><label class="override-rir ${overrideRir?'':'hidden'}">${effortLabel()}<input data-prop="rir-override" type="number" ${effortRange()} step="0.5" inputmode="decimal" value="${overrideRir?shownEffort(s.rir):''}"></label></div></div>`;
}
function readSideForm(row,side){
 if(!row?.querySelector(`[data-side="${side}"]`))return null;
 const r=row.querySelector(`[data-side="${side}"][data-field="rir"]`);
 return {rir:r?.value.trim()?enteredRir(Number(r.value)):null};
}
function exerciseFrom(el){return day().exercises.find(e=>e.id===el.dataset.id)}
function readCard(el){
 const rows=[...el.querySelectorAll('.set-row')];
 if(!rows.length)throw Error('Agregá al menos una serie.');
 const kgInput=el.querySelector('[data-common="kg"]'),rirInput=el.querySelector('[data-common="rir"]');
 if(!kgInput.checkValidity()||!rirInput.checkValidity())throw Error('Revisá peso y '+effortLabel()+' general.');
 const kg=kgInput.value.trim()===''?null:Number(kgInput.value),rir=rirInput.value.trim()===''?null:enteredRir(Number(rirInput.value));
 const unilateral=!!exerciseFrom(el)?.unilateral;
 const sets=rows.map(row=>{
  if(unilateral){
   const repsInput=row.querySelector('[data-prop="reps"]');
   if(!repsInput.checkValidity())throw Error('Revisá las repeticiones de la serie.');
   const commonReps=repsInput.value.trim()===''?null:Number(repsInput.value);
   if(commonReps!==null&&!Number.isInteger(commonReps))throw Error('Las repeticiones deben ser enteras.');
   const sides={};
   for(const side of ['left','right']){
    const find=key=>row.querySelector(`[data-side="${side}"][data-field="${key}"]`);
    const ri=find('reps'),ki=find('kg'),ei=find('rir');
    if(!ri.checkValidity()||!ki.checkValidity()||!ei.checkValidity())throw Error(`Revisá la serie de ${side==='left'?'izquierda':'derecha'}.`);
    const reps=ri.value.trim()===''?commonReps:Number(ri.value);
    if(reps!==null&&!Number.isInteger(reps))throw Error('Las repeticiones deben ser enteras.');
    sides[side]={reps,kg:ki.value.trim()===''?kg:Number(ki.value),rir:ei.value.trim()===''?rir:enteredRir(Number(ei.value))};
   }
   const same=key=>sides.left[key]===sides.right[key]?sides.left[key]:null;
   return {kg:same('kg'),reps:same('reps'),rir:same('rir'),sides};
  }
  const repsInput=row.querySelector('[data-prop="reps"]');
  const checked=row.querySelector('[data-override]').checked;
  const weightInput=row.querySelector('[data-prop="kg-override"]');
  const rirChecked=row.querySelector('[data-rir-override]').checked;
  const rirOverride=row.querySelector('[data-prop="rir-override"]');
  if(!repsInput.checkValidity()||(checked&&!weightInput.checkValidity())||(rirChecked&&!rirOverride.checkValidity()))throw Error('Revisá los valores de las series.');
  const reps=repsInput.value.trim()===''?null:Number(repsInput.value);
  if(reps!==null&&!Number.isInteger(reps))throw Error('Las repeticiones deben ser enteras.');
  const weight=checked?(weightInput.value.trim()===''?null:Number(weightInput.value)):kg;
  const seriesRir=rirChecked?(rirOverride.value.trim()===''?null:enteredRir(Number(rirOverride.value))):rir;
  if(checked&&weight===null)throw Error('Ingresá el peso de la serie modificada.');
  if(rirChecked&&seriesRir===null)throw Error('Ingresá el '+effortLabel()+' de la serie modificada.');
  return {kg:weight,reps,rir:seriesRir};
 });
 return {sets,notes:el.querySelector('[data-notes]').value};
}
function draftBadge(el){el.querySelector('.status').textContent='Cambios sin guardar';el.dataset.dirty='1'}
async function saveCard(el){const e=exerciseFrom(el);const v=readCard(el);e.sets=v.sets;e.notes=v.notes;e.updated=new Date().toISOString();await persist();render();const newEl=[...document.querySelectorAll('.card')].find(c=>c.dataset.id===e.id);if(newEl)newEl.open=true}
function modal(title,body){$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('overlay').classList.add('open')}
function showExerciseHistory(e){const all=model.weeks.flatMap(w=>w.days.flatMap(d=>d.exercises.filter(x=>x.exerciseId===e.exerciseId&&x.updated).map(x=>({week:w.number,day:d.number,e:x})))).sort((a,b)=>b.week-a.week);modal('Historial · '+e.name,all.length?all.map(x=>`<div class="histitem"><b>Semana ${x.week} · Día ${x.day}</b><p>${escapeHtml(summary(x.e))}</p><div class="hist-series-list">${seriesDetail(x.e)}</div><p>${escapeHtml(x.e.notes||'Sin notas')}</p></div>`).join(''):'<p class="muted">Todavía no hay registros guardados de este ejercicio.</p>')}
function guardDirty(){return !document.querySelector('[data-dirty="1"]')||confirm('Tenés cambios sin guardar. ¿Querés descartarlos?')}
$('cards').addEventListener('change',ev=>{if(ev.target.matches('[data-override],[data-rir-override]')){const row=ev.target.closest('.set-row');const isRir=ev.target.matches('[data-rir-override]');const box=row.querySelector(isRir?'.override-rir':'.override-kg');box.classList.toggle('hidden',!ev.target.checked);if(ev.target.checked){const input=row.querySelector(isRir?'[data-prop=rir-override]':'[data-prop=kg-override]');if(!input.value)input.value=ev.target.closest('.card').querySelector(isRir?'[data-common=rir]':'[data-common=kg]').value;input.focus()}const changed=row.querySelector('[data-override]').checked||row.querySelector('[data-rir-override]').checked;row.querySelector('.adjust-btn').classList.toggle('changed',changed);row.querySelector('.adjust-btn').textContent=changed?'⚙ Ajustado':'⚙ Ajustar';const c=ev.target.closest('.card');c.dataset.workoutDirty='1';draftBadge(c)}});
$('cards').addEventListener('change',ev=>{
 if(ev.target.matches('[data-plan="unilateral"]')){
  const card=ev.target.closest('.card');card.querySelector('.plan-panel').classList.toggle('editing-unilateral',ev.target.checked);
  draftBadge(card);
 }
});
$('cards').addEventListener('input',ev=>{
 const c=ev.target.closest('.card');if(!c)return;
 if(ev.target.matches('[data-plan="all-kg"]')){
  // Al cambiar el peso general del objetivo, actualizar todas las series,
  // sin guardar ni modificar el entrenamiento realizado.
  const weight=ev.target.value;
  c.querySelectorAll('.plan-series-list [data-plan-kg]').forEach(input=>{input.value=weight});
 }
 if(!ev.target.closest('.plan-edit'))c.dataset.workoutDirty='1';
 draftBadge(c);
});
$('cards').addEventListener('click',async ev=>{const b=ev.target.closest('[data-action]');if(!b)return;const c=b.closest('.card'),e=exerciseFrom(c),a=b.dataset.action;try{
 if(a==='configure-increment'){
  const editor=c.querySelector('.plan-edit');editor.classList.remove('hidden');
  const field=editor.querySelector('[data-plan="increment"]');
  field.scrollIntoView({block:'center',behavior:'smooth'});field.focus();
  return;
 }
 if(a==='quick-increment'){
  const field=c.querySelector('[data-plan="increment"]');
  field.value=b.dataset.value;
  c.querySelectorAll('.increment-presets button').forEach(x=>x.classList.toggle('selected',x===b));
  draftBadge(c);
  return;
 }
 if(a==='choose-side'){
  const panel=b.closest('.side-exception-panel,.plan-side-targets');
  const choice=b.dataset.choice;
  panel.querySelectorAll('[data-editor-side]').forEach(x=>x.classList.toggle('hidden',x.dataset.editorSide!==choice));
  panel.querySelectorAll('[data-action="choose-side"]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.choice===choice)));
  return;
 }
 if(a==='toggle-side-difference'||a==='toggle-plan-sides'){
 const planMode=a==='toggle-plan-sides', row=b.closest(planMode?'[data-plan-series-row]':'.set-row');
 const panel=row.querySelector(planMode?'.plan-side-targets':'.side-exception-panel');
 const opening=panel.classList.contains('hidden');
 if(!opening){
  const hasOverrides=[...panel.querySelectorAll('input')].some(input=>input.value.trim()!=='');
  if(hasOverrides&&!confirm('Esta serie tiene valores diferentes. ¿Volver a registrar lo mismo en ambos lados y eliminar esos ajustes?'))return;
  panel.querySelectorAll('input').forEach(input=>input.value='');
 }
 panel.classList.toggle('hidden',!opening);b.setAttribute('aria-expanded',String(opening));
 b.textContent=opening?(planMode?'✓ Objetivo distinto por lado':'✓ Lado ajustado'):(planMode?'¿Objetivo distinto en un lado?':'Cambiar un lado');
 b.classList.toggle('changed',opening);
 if(!planMode){c.dataset.workoutDirty='1';draftBadge(c)}else draftBadge(c);
 return;
}if(a==='toggle-adjust'){const extra=b.closest('.set-row').querySelector('.set-extra');extra.classList.toggle('hidden');b.setAttribute('aria-expanded',String(!extra.classList.contains('hidden')));return}if(a==='toggle-previous'){openWeekComparison(e);return}if(a==='toggle-plan'){c.querySelector('.plan-edit').classList.toggle('hidden');return}if(a==='open-video'){
 const url=e.videoUrl;
 if(!url||!/^https:\/\//i.test(url)){alert('El ejercicio no tiene un enlace de video válido.');return;}
 if(typeof window.obsidianaOpenExternal==='function')await window.obsidianaOpenExternal(url);
 else window.open(url,'_blank','noopener,noreferrer');
 return;
}
if(a==='edit-video'){
 const answer=prompt('Enlace HTTPS del video de técnica (YouTube u otro). Dejalo vacío para quitarlo:',e.videoUrl||'');
 if(answer===null)return;
 const url=answer.trim();
 if(url){let parsed;try{parsed=new URL(url)}catch(_){throw Error('Pegá un enlace válido que empiece por https://')}if(parsed.protocol!=='https:'||url.length>2048)throw Error('El enlace debe ser HTTPS y tener menos de 2048 caracteres.');}
 const previous=e.videoUrl;e.videoUrl=url;
 try{await persist();render();const updated=[...document.querySelectorAll('.card')].find(x=>x.dataset.id===e.id);if(updated)updated.open=true}
 catch(error){e.videoUrl=previous;throw error;}
 return;
}
if(a==='add-plan-set'||a==='remove-plan-set'){
 const list=c.querySelector('.plan-series-list');
 const rows=[...list.querySelectorAll('[data-plan-series-row]')];
 if(a==='add-plan-set'){
  if(rows.length>=30){alert('Máximo 30 series en el objetivo.');return}
  const last=rows[rows.length-1];
  const latest=last?{reps:last.querySelector('[data-plan-reps]').value,kg:last.querySelector('[data-plan-kg]').value}:{reps:'',kg:''};
  if(last&&last.querySelector('.plan-side-targets')&&!last.querySelector('.plan-side-targets').classList.contains('hidden')){
   latest.sides={};for(const side of ['left','right'])latest.sides[side]={
    reps:last.querySelector(`[data-plan-side="${side}-reps"]`).value||null,
    kg:last.querySelector(`[data-plan-side="${side}-kg"]`).value||null
   };
  }
  // La nueva serie copia los valores de la última; luego se pueden editar.
  list.insertAdjacentHTML('beforeend',planSetMarkup(latest,rows.length));
 }else{
  if(rows.length<=1){alert('Debe quedar al menos una serie en el objetivo.');return}
  b.closest('[data-plan-series-row]').remove();
 }
 renumberPlanRows(c);
 const count=list.querySelectorAll('[data-plan-series-row]').length;
 c.querySelector('.plan-set-counter').textContent=count+' serie'+(count===1?'':'s');
 draftBadge(c);
 return;
}
if(a==='apply-volume'){
 const p=planOf(e);
 if(!p.volumeCandidate || p.sets.length>=5)throw Error('Esta sugerencia ya no está disponible.');
 if(c.dataset.workoutDirty==='1')throw Error('Guardá primero las series realizadas.');
 if(!confirm('¿Agregar una serie al OBJETIVO de esta semana? Solo si recuperás bien y el volumen semanal te resulta tolerable. No modificará las series ya realizadas.'))return;
 const last=p.sets[p.sets.length-1];p.sets.push({kg:last.kg,reps:last.reps});p.volumeCandidate=false;p.reason='Volumen · +1 serie agregada manualmente, revisá recuperación';
 await persist();render();const card=[...document.querySelectorAll('.card')].find(x=>x.dataset.id===e.id);if(card)card.open=true;return;
}
if(a==='save-plan'){
 if(c.dataset.workoutDirty==='1')throw Error('Tenés series realizadas sin guardar. Guardá el registro primero para no perder esos cambios.');
 const get=k=>Number(c.querySelector(`[data-plan="${k}"]`).value),min=get('min'),max=get('max'),rir=enteredRir(get('rir'));
 const effortField=c.querySelector('[data-plan="rir"]');if(effortField.value.trim()===''||!effortField.checkValidity())throw Error('Revisá el '+effortLabel()+' objetivo.');
 const incField=c.querySelector('[data-plan="increment"]');
 const increment=incField.value.trim()===''?null:Number(incField.value);
 const rows=[...c.querySelectorAll('.plan-series-list [data-plan-series-row]')];
 const sets=rows.map(row=>{
  const ri=row.querySelector('[data-plan-reps]'),ki=row.querySelector('[data-plan-kg]');
  if(!ri.checkValidity()||!ki.checkValidity())throw Error('Revisá las repeticiones y los pesos del objetivo.');
  const general={reps:ri.value.trim()===''?null:Number(ri.value),kg:ki.value.trim()===''?null:Number(ki.value)};
  if(c.querySelector('[data-plan="unilateral"]').checked){
   const sides={};let any=false;
   for(const side of ['left','right']){
    const rep=row.querySelector(`[data-plan-side="${side}-reps"]`),weight=row.querySelector(`[data-plan-side="${side}-kg"]`);
    if(!rep.checkValidity()||!weight.checkValidity())throw Error('Revisá los objetivos por lado.');
    const rv=rep.value.trim()===''?null:Number(rep.value),kv=weight.value.trim()===''?null:Number(weight.value);
    if(rv!==null&&(!Number.isInteger(rv)||rv<1||rv>200))throw Error('Reps objetivo por lado inválidas.');
    if(kv!==null&&(!Number.isFinite(kv)||kv<0||kv>1000))throw Error('Peso objetivo por lado inválido.');
    sides[side]={reps:rv!==null&&rv!==general.reps?rv:null,kg:kv!==null&&kv!==general.kg?kv:null};
    if(sides[side].reps!==null||sides[side].kg!==null)any=true;
   }
   if(any)general.sides=sides;
  }
  return general;
 });
 if(!sets.length||sets.length>30||!Number.isInteger(min)||min<1||!Number.isInteger(max)||max<min||max>200||!Number.isFinite(rir)||rir<0||rir>10||increment!==null&&(!Number.isFinite(increment)||increment<=0)||sets.some(x=>x.reps!==null&&(!Number.isInteger(x.reps)||x.reps<1||x.reps>200)||x.kg!==null&&(!Number.isFinite(x.kg)||x.kg<0||x.kg>1000)))throw Error('Revisá la planificación.');
 const wasUnilateral=!!e.unilateral, nowUnilateral=c.querySelector('[data-plan="unilateral"]').checked;
  if(wasUnilateral!==nowUnilateral&&e.updated&&!confirm('Cambiar bilateral/unilateral en un ejercicio guardado requiere revisar y registrar nuevamente los datos por lado. Se conservarán los valores hasta que guardes de nuevo. ¿Continuar?'))return;
  const previousPlan=planOf(e);
  const wasWeightReview=!!previousPlan.requiresWeightReview || /revisar carga/i.test(previousPlan.reason||'');
  e.unilateral=nowUnilateral;
  const volumeEnabled=c.querySelector('[data-plan="volumeEnabled"]').checked;
  e.plan={sets,min,max,rir,increment,volumeEnabled,volumeCandidate:false,reason:'Objetivo personalizado'};
  const prev=wasWeightReview&&!e.updated&&increment!==null?previousExercise(e):null;
  if(prev?.exercise.updated&&confirm('Esta semana esperaba que configuraras el aumento de peso. ¿Querés recalcular AHORA el objetivo usando los resultados reales de la semana anterior?\n\nSe reemplazará la propuesta actual de este ejercicio, sin modificar lo registrado anteriormente.')){
   const basis=JSON.parse(JSON.stringify(prev.exercise));
   basis.plan={...basis.plan,increment,min,max,rir,volumeEnabled};
   const suggested=ObsidianaProgression.propose(basis,'auto');
   if(!suggested.requiresReview&&!suggested.requiresWeightReview){
    e.plan={...suggested,increment,volumeEnabled};
   }else{
    alert('Todavía no se puede proponer un aumento automático. '+(suggested.reason||'Revisá el rendimiento anterior.'));
   }
  }
 await persist();render();
 const card=[...document.querySelectorAll('.card')].find(el=>el.dataset.id===e.id);
 if(card)card.open=true;
 return;
}
if(a==='fill-goal'){
 const p=planOf(e), planned=p.sets;
 if(!planned.length||planned.some(x=>x.reps===null||x.kg===null||!Number.isFinite(Number(x.reps))||!Number.isFinite(Number(x.kg)))){
  alert('Para cargar el objetivo, primero definí el peso y las repeticiones de todas las series en «Editar objetivo».');return;
 }
 const hasData=[...c.querySelectorAll('.set-row [data-prop="reps"],.set-row [data-field="reps"]')].some(x=>x.value.trim()!=='');
 if(hasData&&!confirm(`Ya hay repeticiones cargadas. ¿Reemplazarlas por el objetivo planificado? El ${effortLabel()} no se modificará.`))return;
 const sameWeight=planned.every(x=>Number(x.kg)===Number(planned[0].kg));
 const baseWeight=Number(planned[0].kg);
 c.querySelector('[data-common="kg"]').value=String(baseWeight);
 // El RIR general y los RIR específicos se dejan tal como estén.
 const currentRir=c.querySelector('[data-common="rir"]').value.trim();
 const oldRows=[...c.querySelectorAll('.set-row')];
 const previous=oldRows.map(row=>({
  rirOverride:!!row.querySelector('[data-rir-override]')?.checked,
  rir:row.querySelector('[data-prop="rir-override"]')?.value.trim()||''
 }));
 const html=planned.map((x,j)=>{
  const isDifferent=Number(x.kg)!==baseWeight;
  const saved=previous[j];
  const effectiveRir=saved?.rirOverride&&saved.rir!==''?enteredRir(Number(saved.rir)):currentRir===''?null:enteredRir(Number(currentRir));
  if(e.unilateral){
   const sides={};
   for(const side of ['left','right']){const target=ObsidianaProgression.goalSide(x,side);const kept=oldRows[j]?readSideForm(oldRows[j],side):null;
    sides[side]={kg:Number(target.kg),reps:Number(target.reps),rir:kept?.rir??null};}
   return setHTML({kg:Number(x.kg),reps:Number(x.reps),rir:null,sides},j,baseWeight,currentRir===''?null:enteredRir(Number(currentRir)),true);
  }
  return setHTML({kg:Number(x.kg),reps:Number(x.reps),rir:effectiveRir},j,baseWeight,currentRir===''?null:enteredRir(Number(currentRir)));
 }).join('');
 c.querySelector('.setrows').innerHTML=html;
 c.dataset.workoutDirty='1'; // El objetivo precargado aún no es un registro guardado.
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
 c.querySelector('.status').textContent='Objetivo cargado · completá el '+effortLabel()+' y guardá el registro';
 return;
}
if(a==='save'){await saveCard(c);return}if(a==='history'){showExerciseHistory(e);return}if(a==='delete-exercise'){if(!confirm('¿Eliminar este ejercicio de esta semana?'))return;day().exercises=day().exercises.filter(x=>x.id!==e.id);await persist();render();return}if(a==='add-set'||a==='remove-set'){const rows=c.querySelector('.setrows'),current=readCard(c);if(a==='add-set'){if(current.sets.length>=30){alert('Máximo 30 series.');return}current.sets.push(e.unilateral?{kg:null,reps:null,rir:null,sides:{left:{kg:null,reps:null,rir:null},right:{kg:null,reps:null,rir:null}}}:{kg:null,reps:null,rir:null})}else{if(current.sets.length<=1)return;const index=Number(b.dataset.index);if((current.sets[index].reps!==null||current.sets[index].sides?.left?.reps!==null&&current.sets[index].sides?.left?.reps!==undefined||current.sets[index].sides?.right?.reps!==null&&current.sets[index].sides?.right?.reps!==undefined)&&!confirm('¿Quitar esta serie?'))return;current.sets.splice(index,1)}const base=c.querySelector('[data-common=kg]').value.trim()===''?null:Number(c.querySelector('[data-common=kg]').value);const baseRir=c.querySelector('[data-common=rir]').value.trim()===''?null:enteredRir(Number(c.querySelector('[data-common=rir]').value));rows.innerHTML=current.sets.map((s,j)=>setHTML(s,j,base,baseRir,!!e.unilateral)).join('');c.dataset.workoutDirty='1';draftBadge(c)}}catch(err){alert(err.message)}});
$('effortScale').onchange=async ev=>{
 const next=ev.target.value==='rpe'?'rpe':'rir';
 if(!guardDirty()){ev.target.value=effortScale();return;}
 const old=effortScale();model.effortScale=next;
 try{await persist();render()}catch(err){model.effortScale=old;render();alert('No se pudo guardar la escala: '+err.message)}
};
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
async function createExercise(name){const clean=String(name||'').trim().slice(0,150);if(!clean){alert('Ingresá un nombre.');return}if(day().exercises.length>=200){alert('Máximo 200 ejercicios por día.');return}const same=model.weeks.flatMap(w=>w.days.flatMap(d=>d.exercises)).find(e=>e.name.toLocaleLowerCase()===clean.toLocaleLowerCase());const e={id:uid(),exerciseId:same?.exerciseId||uid(),name:clean,videoUrl:same?.videoUrl||'',unilateral:!!same?.unilateral,plan:{sets:[{kg:null,reps:10},{kg:null,reps:10},{kg:null,reps:10}],min:8,max:12,rir:1,increment:null},sets:[{kg:null,reps:null,rir:null},{kg:null,reps:null,rir:null},{kg:null,reps:null,rir:null}],notes:'',updated:null};if(e.unilateral){e.sets=e.sets.map(s=>({...s,sides:{left:{kg:null,reps:null,rir:null},right:{kg:null,reps:null,rir:null}}}))}day().exercises.push(e);try{await persist();$('overlay').classList.remove('open');render()}catch(err){day().exercises.pop();alert('No se pudo crear: '+err.message)}}
$('addExercise').onclick=()=>{if(!guardDirty())return;modal('Agregar ejercicio',`<p class="muted">Elegí uno de la lista o escribí uno propio.</p><input id="exerciseQuery" type="search" placeholder="Buscar o escribir ejercicio" maxlength="150" style="width:100%;margin-bottom:12px" aria-label="Buscar ejercicio"><div id="exerciseSuggestions" style="max-height:280px;overflow:auto"></div><div class="row" style="margin-top:12px"><button class="button primary small" id="createCustomExercise">+ Agregar el nombre escrito</button></div>`);const input=$('exerciseQuery');const draw=()=>{const q=input.value.toLocaleLowerCase().trim();const names=exerciseNames().filter(n=>n.toLocaleLowerCase().includes(q)).slice(0,35);$('exerciseSuggestions').innerHTML=names.map((n,i)=>`<button class="button small exercise-choice" data-name-index="${i}" style="display:block;width:100%;text-align:left;margin:4px 0">${escapeHtml(n)}</button>`).join('')||'<p class="muted">Sin coincidencias. Podés agregar tu ejercicio.</p>';window._obsSuggestions=names};input.addEventListener('input',draw);draw();input.focus()};
$('modalBody').addEventListener('click',async ev=>{const choice=ev.target.closest('[data-name-index]');if(choice){await createExercise(window._obsSuggestions[Number(choice.dataset.nameIndex)]);return}if(ev.target.closest('#createCustomExercise')){await createExercise($('exerciseQuery').value)}});

function proposal(source,mode){
 const p=planOf(source);
 const prev=model.weeks.filter(w=>w.number<currentWeek&&w.kind!=='deload').sort((a,b)=>b.number-a.number).flatMap(w=>w.days.flatMap(d=>d.exercises.filter(x=>x.exerciseId===source.exerciseId && x.updated))).slice(0,4);
 return ObsidianaProgression.propose({...source,plan:p},mode,prev);
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
 // Diagnóstico antes de crear una semana automática.
 // Cuando falta algún dato, no inventamos el RIR/RPE ni bloqueamos otros ejercicios completos.
 if(mode==='auto' && source.kind!=='deload'){
  const checks=source.days.flatMap(d=>d.exercises.map(e=>({name:e.name,day:d.name||'Día '+d.number,check:ObsidianaProgression.inspectRecord({...e,plan:planOf(e)})})));
  const toReview=checks.filter(x=>!x.check.ready);
  if(checks.length && toReview.length===checks.length){
   alert('Todavía no hay ejercicios listos para progresar.\n\n'+toReview.slice(0,6).map(x=>'• '+x.day+' / '+x.name+': '+x.check.reason).join('\n')+(toReview.length>6?'\n… y '+(toReview.length-6)+' más.':'')+'\n\nLos registros ya cargados no se modificaron.');
   return;
  }
  if(toReview.length && !confirm('Hay '+toReview.length+' ejercicio(s) que conservarán su objetivo sin cambios.\n\n'+toReview.slice(0,5).map(x=>'• '+x.name+': '+x.check.reason).join('\n')+(toReview.length>5?'\n… y '+(toReview.length-5)+' más.':'')+'\n\n¿Querés progresar los demás igualmente?'))return;
 }
 if(!confirm(`${title}: crear semana ${next} desde la semana ${currentWeek}?\n\n${explanation}\n\nLos entrenamientos anteriores no se modificarán.`))return;
 const nw={number:next,kind:mode==='deload'?'deload':'normal',days:source.days.map(d=>({number:d.number,name:d.name||'Día '+d.number,exercises:d.exercises.map(e=>{
   let plan;
   if(mode==='deload'){plan=proposal(e,'deload')}
   else if(source.kind==='deload'&&(mode==='auto'||mode==='manual')){
     // Recuperar la última planificación normal, nunca tomar la descarga como referencia.
     const previous=model.weeks.filter(w=>w.number<source.number&&w.kind!=='deload').sort((a,b)=>b.number-a.number)[0];
     const original=previous?.days.flatMap(day=>day.exercises).find(x=>x.exerciseId===e.exerciseId);
     plan=original?proposal(original,mode==='auto'?'auto':'manual'):proposal(e,'manual');
   }else plan=proposal(e,mode);
   return {id:uid(),exerciseId:e.exerciseId,name:e.name,videoUrl:e.videoUrl||'',unilateral:!!e.unilateral,plan,sets:plan.sets.map(()=>e.unilateral?({kg:null,reps:null,rir:null,sides:{left:{kg:null,reps:null,rir:null},right:{kg:null,reps:null,rir:null}}}):({kg:null,reps:null,rir:null})),notes:'',updated:null};
 })}))};
 const oldWeek=currentWeek,oldDay=currentDay;
 model.weeks.push(nw);currentWeek=next;currentDay=nw.days[0].number;
 try{await persist();render();const review=nw.days.flatMap(d=>d.exercises.filter(e=>e.plan.requiresReview).map(e=>e.name+': '+e.plan.reason));alert(`${title}: semana creada. Los objetivos se pueden editar.`+(review.length?'\n\nSin progresión automática ('+review.length+'):\n'+review.slice(0,5).join('\n'):'') )}catch(e){model.weeks.pop();currentWeek=oldWeek;currentDay=oldDay;alert('Error al crear semana: '+e.message)}
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
// Respaldo: en Android usamos Filesystem + Share (el WebView no garantiza descargas blob:).
$('export').onclick=async()=>{
 const button=$('export');
 const mobileMenu=document.querySelector('.mobile-compact-menu');
 if(mobileMenu)mobileMenu.open=false;
 if(button.disabled)return;
 if(document.querySelector('[data-dirty="1"]')){
  alert('Guardá primero los cambios pendientes del ejercicio para que también queden en el respaldo.');
  return;
 }
 button.disabled=true;
 try{
  if(!db)throw Error('Todavía no se cargó la base de entrenamientos.');
  const saved=await getDB();
  if(!saved)throw Error('No se encontraron datos guardados.');
  validate(saved);
  const json=JSON.stringify(saved,null,2);
  const stamp=new Date().toISOString().slice(0,19).replace(/[T:]/g,'-');
  const filename='Obsidiana-respaldo-'+stamp+'.json';
  if(window.Capacitor?.isNativePlatform?.()){
   if(typeof window.obsidianaNativeBackup!=='function')throw Error('Falta el módulo de respaldo Android. Ejecutá npm.cmd install y npm.cmd run android:prepare, y reinstalá la APK.');
   await window.obsidianaNativeBackup(filename,json);
   // El archivo queda en caché hasta que el usuario lo guarde fuera de Obsidiana.
   alert('Elegí Guardar en Drive, Archivos u otra opción del menú para conservar la copia. Comprobá que se haya guardado antes de borrar la aplicación.');
  }else{
   const blob=new Blob([json],{type:'application/json;charset=utf-8'});
   const url=URL.createObjectURL(blob);
   const a=document.createElement('a');
   a.href=url;a.download=filename;a.style.display='none';
   document.body.appendChild(a);a.click();
   setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},30000);
  }
 }catch(err){
  console.error('Error al exportar respaldo',err);
  alert('No se pudo crear o compartir el respaldo: '+(err?.message||String(err)));
 }finally{button.disabled=false}
};$('import').onclick=()=>{if(guardDirty())$('importFile').click()};$('importFile').onchange=async ev=>{const f=ev.target.files[0];if(!f)return;try{if(f.size>10*1024*1024)throw Error('Archivo demasiado grande.');const obj=JSON.parse(await f.text());validate(obj);if(!confirm('¿Reemplazar todos los datos locales con este respaldo? Exportá una copia primero.'))return;model=obj;currentWeek=model.weeks[0].number;currentDay=model.weeks[0].days[0].number;await persist();render();alert('Respaldo importado.')}catch(err){alert('No se pudo importar: '+err.message)}finally{ev.target.value=''}};
$('closeModal').onclick=()=>$('overlay').classList.remove('open');$('overlay').onclick=ev=>{if(ev.target===$('overlay'))$('overlay').classList.remove('open')};
let duration=120,remaining=120,deadline=null;function timerRender(){const n=deadline?Math.max(0,Math.ceil((deadline-Date.now())/1000)):remaining;const t=String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');$('timer').textContent=t;$('mobileTimer').textContent=t;$('timerToggle').textContent=deadline?'Pausar':'Iniciar';$('mobileToggle').textContent=deadline?'Pausar':'Iniciar';if(deadline&&n===0){deadline=null;remaining=0;try{navigator.vibrate?.([150,90,150])}catch(_){}}}function toggle(){if(deadline){remaining=Math.max(0,Math.ceil((deadline-Date.now())/1000));deadline=null}else{if(remaining<=0)remaining=duration;deadline=Date.now()+remaining*1000}timerRender()}function reset(){remaining=duration;deadline=null;timerRender()}$('timerToggle').onclick=$('mobileToggle').onclick=toggle;$('timerReset').onclick=$('mobileReset').onclick=reset;$('duration').onchange=e=>{duration=Number(e.target.value);$('mobileDuration').value=String(duration);reset()};$('mobileDuration').onchange=e=>{duration=Number(e.target.value);$('duration').value=String(duration);reset()};setInterval(timerRender,500);document.addEventListener('visibilitychange',timerRender);
window.addEventListener('beforeunload',event=>{if(document.querySelector('[data-dirty="1"]')){event.preventDefault();event.returnValue=''}});
let resolveObsidianaReady;
window.obsidianaReady=new Promise(resolve=>{resolveObsidianaReady=resolve});
(async()=>{try{db=await openDB();model=await getDB()||fresh();validate(model);currentWeek=model.weeks.some(w=>w.number===model.week)?model.week:model.weeks[0].number;currentDay=week().days[0].number;render();if(typeof updateWorkspaceBar==='function')updateWorkspaceBar()}catch(err){$('cards').innerHTML='<div class="blank">No se pudo abrir el almacenamiento local: '+escapeHtml(err.message)+'. Abrí la app desde un servidor local (localhost) o desde una instalación compatible.</div>';console.error(err)}finally{resolveObsidianaReady(Boolean(model&&db))}})();
