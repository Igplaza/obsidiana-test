'use strict';
/* Obsidiana · intercambio manual por enlace. Sin servidor ni cuentas. */
const shareState={pending:null};
function shareEncode(v){const bytes=new TextEncoder().encode(JSON.stringify(v));let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function shareDecode(s){if(!/^[A-Za-z0-9_-]{1,160000}$/.test(s))throw Error('Enlace inválido o demasiado grande');const bin=atob(s.replace(/-/g,'+').replace(/_/g,'/'));const bytes=Uint8Array.from(bin,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}
function shareValid(v){if(!v||v.app!=='obsidiana'||v.v!==1||!['plan','results'].includes(v.type)||typeof v.student!=='string'||v.student.length>80||!Array.isArray(v.days)||v.days.length>31)throw Error('Formato no compatible');let count=0;for(const d of v.days){if(typeof d.name!=='string'||d.name.length>60||!Array.isArray(d.exercises)||d.exercises.length>200)throw Error('Día inválido');for(const e of d.exercises){count++;if(count>1200||typeof e.name!=='string'||e.name.length>150||!Array.isArray(e.sets)||e.sets.length>30||typeof e.exerciseId!=='string'||e.exerciseId.length>100)throw Error('Ejercicios inválidos');for(const s of e.sets){for(const k of ['kg','reps','rir'])if(s[k]!==undefined&&s[k]!==null&&(!Number.isFinite(s[k])||s[k]<0||s[k]>1000))throw Error('Valores inválidos')}}}if(JSON.stringify(v).length>120000)throw Error('Datos demasiado grandes')}
function shareStudent(){let n=(model.shareStudent||'').trim();if(!n){n=prompt('Tu nombre (para identificar los resultados):','')?.trim()||'';if(!n)return null;if(n.length>80){alert('Máximo 80 caracteres');return null}model.shareStudent=n;persist().catch(console.error)}return n}
function shareDays(scope,type){const w=week(),ds=scope==='day'?[day()]:w.days;return ds.map(d=>({name:d.name||'Día '+d.number,number:d.number,exercises:d.exercises.map(e=>{const p=planOf(e);return {exerciseId:e.exerciseId,name:e.name,plan:{sets:p.sets.map(s=>({kg:s.kg,reps:s.reps})),min:p.min,max:p.max,rir:p.rir,increment:p.increment??null},sets:type==='results'?e.sets.map(s=>({kg:s.kg,reps:s.reps,rir:s.rir})):[],notes:type==='results'?(e.notes||''):'',updated:type==='results'?e.updated:null}})}))}
function showShareLink(payload){shareValid(payload);const link=location.origin+location.pathname+'#obs-share='+shareEncode(payload);const tooLong=link.length>12000;modal('Enviar · '+(payload.type==='plan'?'Planificación':'Resultados'),`<p>Copiá el enlace y envialo por WhatsApp. La otra persona deberá abrirlo con Obsidiana.</p><input class="share-input" id="outShareLink" readonly value="${escapeHtml(link)}"><div class="share-actions"><button class="button primary small" id="copyShareLink">Copiar enlace</button><button class="button small" id="downloadShareFile">Descargar archivo alternativo</button></div><p class="share-warning">${tooLong?'El enlace es largo y podría fallar. Para este caso conviene compartir el archivo alternativo.':'Importación con vista previa y confirmación.'}</p><p class="muted">El enlace contiene datos legibles para quien lo reciba. No incluyas información privada o médica.</p>`);window._outShare={link,payload};}
async function doShare(scope){if(!guardDirty())return;const student=shareStudent();if(!student)return;const selected=activeWorkspace();const isTrainer=!!selected;const type=isTrainer?'plan':'results';const studentName=isTrainer?selected:student;const obj={app:'obsidiana',v:1,type,scope,student:studentName,week:currentWeek,from:student,created:new Date().toISOString(),days:shareDays(scope,type),id:uid()};showShareLink(obj)}
// Espacios separados: los entrenamientos personales nunca se mezclan con los de un alumno.
function studentWorkspace(name){model.coachWorkspaces??={};return model.coachWorkspaces[name]??={weeks:[{number:1,kind:'normal',days:[{number:1,name:'Día 1',exercises:[]}]}],week:1};}
function activeWorkspace(){return model.coachWorkspaceActive||'';}
function rememberWorkspace(){
 const active=activeWorkspace();
 if(active){model.coachWorkspaces??={};model.coachWorkspaces[active]={weeks:model.weeks,week:currentWeek};}
 else model.personalWorkspace={weeks:model.weeks,week:currentWeek};
}
async function enterWorkspace(name){
 if(!guardDirty())return false;
 if(name && !coachData().some(s=>s.name===name)){alert('No se encontró el alumno');return false;}
 rememberWorkspace();
 if(name){const ws=studentWorkspace(name);model.weeks=ws.weeks;currentWeek=ws.week;model.coachWorkspaceActive=name;}
 else{const ws=model.personalWorkspace||{weeks:model.weeks,week:currentWeek};model.weeks=ws.weeks;currentWeek=ws.week;model.coachWorkspaceActive='';}
 if(!model.weeks.some(w=>w.number===currentWeek))currentWeek=model.weeks[0].number;
 currentDay=model.weeks.find(w=>w.number===currentWeek).days[0].number;
 model.coachActiveStudent=name;
 await persist();render();updateWorkspaceBar();return true;
}
function updateWorkspaceBar(){const bar=$('workspaceBar'),label=$('workspaceLabel'),back=$('workspaceBack');if(!bar)return;
 const name=activeWorkspace();bar.classList.toggle('coach-active',!!name);label.textContent=name?'Entrenamiento de '+name:'Mi entrenamiento personal';back.hidden=!name;
}
function resultsToWeek(p){
 return {number:0,kind:'normal',sourceShareId:p.id,sourceStudent:p.student,days:p.days.map((d,i)=>({
  number:i+1,name:d.name||'Día '+(i+1),exercises:d.exercises.map(e=>({
   id:uid(),exerciseId:e.exerciseId||uid(),name:e.name,
   plan:{sets:(e.plan?.sets||e.sets).map(x=>({kg:x.kg??null,reps:x.reps??null})),min:e.plan?.min??8,max:e.plan?.max??12,rir:e.plan?.rir??1,increment:e.plan?.increment??null,reason:'Resultados importados del alumno'},
   sets:e.sets.map(x=>({kg:x.kg??null,reps:x.reps??null,rir:x.rir??null})),notes:e.notes||'',updated:e.updated||p.created||new Date().toISOString()
  }))
 }))};
}
async function openStudentResult(index,resultId){
 const st=coachData()[index];if(!st)return;
 const p=(st.received||[]).find(x=>x.id===resultId);if(!p)return;
 if(!await enterWorkspace(st.name))return;
 let target=model.weeks.find(w=>w.sourceShareId===p.id);
 if(!target){
  target=resultsToWeek(p);
  if(!target.days.length)throw Error('El envío no contiene días');
  if(model.weeks.length===1 && model.weeks[0].days.every(d=>!d.exercises.length) && !model.weeks[0].sourceShareId){model.weeks=[];}
  target.number=Math.max(0,...model.weeks.map(w=>w.number))+1;
  model.weeks.push(target);
 }
 currentWeek=target.number;currentDay=target.days[0].number;
 await persist();$('overlay').classList.remove('open');render();updateWorkspaceBar();
 window.scrollTo({top:0,behavior:'smooth'});
}
function coachData(){model.coachStudents??=[];return model.coachStudents}
function coachView(){const rows=coachData();modal('Mis alumnos',`<p class="muted">Seleccioná un alumno para enviarle una planificación. Cada alumno tiene su propio espacio de entrenamiento. Abrí sus resultados para verlos como ejercicios y progresar semanas sin mezclar tus datos.</p><div class="share-actions"><button class="button small primary" id="addCoachStudent">+ Alumno</button><button class="button small" id="resetCoachSelection">Mi entrenamiento</button></div><div id="coachRows">${rows.map((s,i)=>`<div class="share-box"><b>${escapeHtml(s.name)}</b> <small>${(s.received||[]).length} envíos recibidos</small><div class="share-actions"><button class="button small" data-coach-open="${i}">Ver resultados</button><button class="button small" data-coach-edit="${i}">Editar</button><button class="button small" data-coach-delete="${i}">Eliminar</button><button class="button small" data-coach-select="${i}">${model.coachActiveStudent===s.name?'✓ Seleccionado':'Seleccionar para planificar'}</button></div></div>`).join('')||'<p class="muted">Todavía no tenés alumnos.</p>'}</div>`)}
function coachResults(index){const s=coachData()[index];if(!s)return;modal('Resultados · '+s.name,`<p class="muted">Tocá «Abrir en pantalla principal» para revisar todas las series y usar Progresar semana.</p><button class="button small" id="coachBack">← Mis alumnos</button>${(s.received||[]).slice().reverse().map(p=>`<div class="share-box"><b>${p.scope==='day'?'Entrenamiento':'Semana'} ${p.week}</b><small> · ${escapeHtml(p.created?.slice(0,10)||'')}</small><div class="share-actions"><button class="button small primary" data-open-result="${index}" data-result-id="${escapeHtml(p.id)}">Abrir en pantalla principal ↗</button></div>${p.days.map(d=>`<p><b>${escapeHtml(d.name)}</b></p>${d.exercises.map(e=>`<p>${escapeHtml(e.name)}: ${e.sets.map(x=>x.kg===null||x.reps===null?'pendiente':`${x.kg} kg × ${x.reps}${x.rir===null?'':' · RIR '+x.rir}`).join(' / ')}${e.notes?'<br>'+escapeHtml(e.notes):''}</p>`).join('')}`).join('')}</div>`).join('')||'<p>Sin resultados recibidos.</p>'}`)}
function previewIncoming(p){
 shareValid(p);shareState.pending=p;
 const results=p.type==='results';
 const students=coachData();
 const match=students.findIndex(x=>x.name.trim().toLocaleLowerCase()===p.student.trim().toLocaleLowerCase());
 const assignment=results?`<div class="share-box"><label for="incomingStudent"><b>Asignar resultados a:</b></label><select id="incomingStudent" class="share-student-select"><option value="" ${match<0?'selected':''} disabled>Elegí un alumno existente</option>${students.map((s,i)=>`<option value="${i}" ${i===match?'selected':''}>${escapeHtml(s.name)}</option>`).join('')}<option value="new">+ Crear alumno nuevo…</option></select><p class="muted">El envío dice «${escapeHtml(p.student)}», pero vos elegís a qué ficha se incorpora. No se creará otro alumno automáticamente.</p></div>`:'';
 modal('Vista previa de '+(results?'resultados':'planificación'),`<div class="share-box"><b>Remitente: ${escapeHtml(p.student)}</b><p>${p.scope==='day'?'Entrenamiento':'Semana'} ${p.week} · ${p.days.length} día(s) · ${p.days.reduce((a,d)=>a+d.exercises.length,0)} ejercicio(s)</p></div>${assignment}<p class="muted">${results?'Los resultados se guardarán en la ficha que selecciones y podrás abrirlos en la pantalla de entrenamiento.':'Se agregará como una semana nueva en esta aplicación. No se sobrescriben tus entrenamientos.'}</p><button class="button primary" id="acceptShare">Importar ${results?'resultados':'planificación'}</button><button class="button small" id="discardShare">Cancelar</button>`);
}
async function acceptIncoming(){
 const p=shareState.pending;if(!p)return;shareValid(p);
 if(p.type==='results'){
  const selection=$('incomingStudent')?.value;
  if(selection===undefined||selection===''){alert('Primero elegí a qué alumno corresponden los resultados.');return}
  let s,idx;
  if(selection==='new'){
   const n=prompt('Nombre de la nueva ficha:',p.student)?.trim();
   if(!n)return;
   if(n.length>80||coachData().some(x=>x.name.trim().toLocaleLowerCase()===n.toLocaleLowerCase())){alert('Nombre inválido o ya existente. Seleccioná esa ficha en la lista.');return}
   if(!confirm('¿Crear la ficha «'+n+'» e importar estos resultados allí?'))return;
   s={name:n,received:[]};coachData().push(s);idx=coachData().length-1;
  }else{
   idx=Number(selection);
   if(!Number.isInteger(idx)||idx<0||idx>=coachData().length)throw Error('Seleccioná un alumno válido');
   s=coachData()[idx];
   if(s.name.trim().toLocaleLowerCase()!==p.student.trim().toLocaleLowerCase() && !confirm('El enlace dice «'+p.student+'» pero vas a guardar los resultados en «'+s.name+'». ¿Confirmás?'))return;
  }
  if(coachData().some(x=>(x.received||[]).some(r=>r.id===p.id))){alert('Este envío ya fue importado en una ficha. No se importará dos veces.');return}
  s.received??=[];s.received.push(p);
  await persist();$('overlay').classList.remove('open');await openStudentResult(idx,p.id);
 }else{
  if(model.weeks.length>=500)throw Error('Máximo de semanas alcanzado');
  const next=Math.max(...model.weeks.map(w=>w.number))+1;
  const mapped=p.days.map((d,i)=>({number:i+1,name:d.name,exercises:d.exercises.map(e=>({id:uid(),exerciseId:e.exerciseId,name:e.name,plan:{...e.plan,sets:e.plan.sets.map(s=>({...s})),reason:'Planificación recibida'},sets:e.plan.sets.map(()=>({kg:null,reps:null,rir:null})),notes:'',updated:null}))}));
  if(!mapped.length)throw Error('La planificación no tiene días');
  model.weeks.push({number:next,kind:'normal',days:mapped});currentWeek=next;currentDay=1;
  await persist();$('overlay').classList.remove('open');render();alert('Planificación importada como Semana '+next);
 }
 shareState.pending=null;window.history.replaceState(null,'',location.pathname+location.search);
}
$('shareToggle').onclick=()=>{const e=$('shareChoices');e.classList.toggle('hidden');$('shareToggle').setAttribute('aria-expanded',String(!e.classList.contains('hidden')))};
$('shareTraining').onclick=()=>{$('shareChoices').classList.add('hidden');doShare('day')};$('shareWeek').onclick=()=>{$('shareChoices').classList.add('hidden');doShare('week')};$('coachPanel').onclick=()=>coachView();
$('modalBody').addEventListener('click',async ev=>{const t=ev.target;try{if(t.id==='copyShareLink'){await navigator.clipboard.writeText(window._outShare.link);alert('Enlace copiado')}else if(t.id==='downloadShareFile'){const blob=new Blob([JSON.stringify(window._outShare.payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Obsidiana-compartir.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500)}else if(t.id==='addCoachStudent'){const n=prompt('Nombre del alumno:')?.trim();if(!n)return;if(n.length>80||coachData().some(x=>x.name.toLowerCase()===n.toLowerCase())){alert('Nombre inválido o repetido');return}coachData().push({name:n,received:[]});await persist();coachView()}else if(t.id==='resetCoachSelection'){await enterWorkspace('');coachView()}else if(t.dataset.coachEdit!==undefined){
  const idx=Number(t.dataset.coachEdit),s=coachData()[idx];if(!s)return;
  const oldName=s.name;
  const n=prompt('Nuevo nombre del alumno:',oldName)?.trim();
  if(n===undefined||!n||n===oldName)return;
  if(n.length>80||coachData().some((x,i)=>i!==idx&&x.name.toLocaleLowerCase()===n.toLocaleLowerCase())){alert('Nombre inválido o repetido');return}
  if(!confirm('¿Cambiar «'+oldName+'» por «'+n+'»?\n\nLos enlaces anteriores seguirán usando el nombre viejo. Pedile al alumno que use el nuevo nombre para próximos envíos.'))return;
  s.name=n;
  if(model.coachActiveStudent===oldName)model.coachActiveStudent=n; if(model.coachWorkspaceActive===oldName)model.coachWorkspaceActive=n; if(model.coachWorkspaces?.[oldName]){model.coachWorkspaces[n]=model.coachWorkspaces[oldName];delete model.coachWorkspaces[oldName];} updateWorkspaceBar();
  await persist();coachView();
}else if(t.dataset.coachDelete!==undefined){
  const idx=Number(t.dataset.coachDelete),s=coachData()[idx];if(!s)return;
  const count=(s.received||[]).length;
  if(!confirm('¿Eliminar la ficha de «'+s.name+'»?\n\nTambién se eliminarán '+count+' envío(s) de resultados guardados en esta ficha. Esta acción no se puede deshacer.'))return;
  const verify=prompt('Para confirmar, escribí ELIMINAR:');
  if(verify!=='ELIMINAR'){alert('Eliminación cancelada.');return}
  if(activeWorkspace()===s.name)await enterWorkspace('');
  coachData().splice(idx,1);
  if(model.coachActiveStudent===s.name)model.coachActiveStudent='';
  if(model.coachWorkspaces)delete model.coachWorkspaces[s.name];
  await persist();coachView();
}else if(t.dataset.coachSelect!==undefined){await enterWorkspace(coachData()[Number(t.dataset.coachSelect)].name);coachView()}else if(t.dataset.coachOpen!==undefined){coachResults(Number(t.dataset.coachOpen))}else if(t.dataset.openResult!==undefined){await openStudentResult(Number(t.dataset.openResult),t.dataset.resultId)}else if(t.id==='coachBack'){coachView()}else if(t.id==='acceptShare'){await acceptIncoming()}else if(t.id==='discardShare'){shareState.pending=null;$('overlay').classList.remove('open');window.history.replaceState(null,'',location.pathname+location.search)}}catch(e){alert('No se pudo completar: '+e.message)}});
window.addEventListener('load',()=>{if(location.hash.startsWith('#obs-share=')){try{previewIncoming(shareDecode(location.hash.slice('#obs-share='.length)))}catch(e){alert('No se pudo abrir el enlace: '+e.message)}}});

$('workspaceBack').addEventListener('click',()=>enterWorkspace(''));
window.addEventListener('load',()=>setTimeout(updateWorkspaceBar,200));
