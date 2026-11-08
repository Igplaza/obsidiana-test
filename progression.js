/* Obsidiana · Progresión v7.
   Recomendaciones orientativas, conservadoras y editables; no sustituyen al entrenador.
   Almacenamiento interno de esfuerzo: RIR. RPE fuerza = 10 - RIR. */
(function(root){
'use strict';
const n=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const close=(a,b)=>n(a)!==null&&n(b)!==null&&Math.abs(a-b)<.0001;
const rirToRpe=x=>n(x)===null?null:Math.max(1,Math.min(10,Math.round((10-x)*2)/2));
const rpeToRir=x=>n(x)===null?null:Math.round((10-x)*2)/2;
const copy=x=>JSON.parse(JSON.stringify(x));
const fmt=x=>Number.isInteger(x)?String(x):String(x);
function sameSets(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((s,i)=>close(s.kg,b[i].kg)&&s.reps===b[i].reps)}
function sideData(set,side){return set?.sides?.[side]||null}
function goalSide(set,side){const s=sideData(set,side)||{};return {kg:s.kg??set.kg??null,reps:s.reps??set.reps??null}}
function inspectSingle(source,side){
 const p=source?.plan,planned=p?.sets;
 if(!source?.updated)return {ready:false,kind:'missing',reason:'Sin registro guardado · tocá «Guardar registro»'};
 if(!Array.isArray(planned)||!planned.length)return {ready:false,kind:'plan',reason:'Falta configurar el objetivo planificado'};
 if(!Array.isArray(source.sets)||!source.sets.length)return {ready:false,kind:'missing',reason:'Sin series realizadas guardadas'};
 if(source.sets.length!==planned.length)return {ready:false,kind:'series',reason:`Cantidad de series distinta: ${source.sets.length} realizadas, ${planned.length} planificadas`};
 let weightChanged=false;
 for(let i=0;i<planned.length;i++){
  const s=side?sideData(source.sets[i],side):source.sets[i],g=side?goalSide(planned[i],side):planned[i];
  const label=`Serie ${i+1}${side?' · '+(side==='left'?'izquierda':'derecha'):''}`;
  if(n(g.kg)===null||n(g.reps)===null||g.reps<1)return {ready:false,kind:'plan',reason:`${label}: faltan kg o repeticiones en el objetivo`};
  if(n(s?.kg)===null)return {ready:false,kind:'missing',reason:`${label}: falta peso realizado`};
  if(n(s?.reps)===null||s.reps<=0)return {ready:false,kind:'missing',reason:`${label}: faltan repeticiones realizadas`};
  if(n(s?.rir)===null||s.rir<0||s.rir>10)return {ready:false,kind:'missing',reason:`${label}: falta RIR/RPE realizado`};
  if(!close(g.kg,s.kg))weightChanged=true;
 }
 return {ready:true,kind:weightChanged?'weightAdjusted':'ready',reason:weightChanged?'La carga realizada fue diferente del objetivo; se usa la carga real de cada serie.':''};
}
function inspectRecord(source){
 if(!source?.unilateral)return inspectSingle(source);
 for(const side of ['left','right']){const r=inspectSingle(source,side);if(!r.ready)return r;}
 return {ready:true,kind:'ready',reason:''};
}
function eligiblePast(h,reference){return !!h?.updated&&Array.isArray(h.sets)&&h.sets.length===reference.sets.length&&h.sets.every((s,i)=>n(s.reps)!==null&&n(s.rir)!==null&&close(s.kg,reference.sets[i].kg))}
// Solo normalizamos propuestas automáticas. Objetivos manuales y registros reales
// pueden tener cualquier secuencia de reps: nunca se corrigen retroactivamente.
function normalizeSameLoad(sets){
 const result=copy(sets);
 for(let i=1;i<result.length;i++){
  const before=result[i-1],current=result[i];
  if(close(before.kg,current.kg)&&n(before.reps)!==null&&n(current.reps)!==null&&current.reps>before.reps){
   current.reps=before.reps;
  }
 }
 return result;
}
function sameProposal(a,b){return JSON.stringify(a)===JSON.stringify(b)}
// En un unilateral una diferencia EXPLICITA de carga en cualquiera de los dos
// lados permite diferente cantidad de repeticiones entre esas series.
function normalizeUnilateralSets(sets){
 const result=copy(sets);
 for(let i=1;i<result.length;i++){
  const a=result[i-1],b=result[i];
  if(['left','right'].every(side=>close(a.sides?.[side]?.kg,b.sides?.[side]?.kg)) &&
    n(a.reps)!==null&&n(b.reps)!==null&&b.reps>a.reps){
   b.reps=a.reps;
   for(const side of ['left','right'])b.sides[side].reps=b.reps;
  }
 }
 return result;
}
function oneSide(source,mode,history=[]){
 const p=source.plan||{};
 const old=(p.sets||[]).map(s=>({kg:s.kg??null,reps:s.reps??null}));
 let autoReady=false;
 const ret=(sets,reason,extra={})=>{
  const planned=autoReady?normalizeSameLoad(sets):sets;
  if(autoReady&&!sameProposal(planned,sets)){
   const accurate=reason.startsWith('Progresamos')?describeRepetitionProgress(source.sets,planned):null;
   reason=accurate||`Objetivo ordenado · ajustamos reps a una secuencia descendente (${sets.map(x=>x.reps).join('-')} → ${planned.map(x=>x.reps).join('-')})`;
  }
  return {...p,sets:planned,reason,volumeCandidate:false,...extra};
 };
 if(mode==='manual')return ret(old,'Objetivo manual · editable');
 if(mode==='deload')return ret(old.slice(0,Math.max(1,Math.ceil(old.length/2))),
  'Descarga · menos series, más margen',{rir:Math.max(3.5,p.rir??1)});
 const diagnosis=inspectSingle(source);
 if(!diagnosis.ready){
  const reason=diagnosis.kind==='series'||diagnosis.kind==='plan'
    ?'Cambiaste series o cargas · revisá el objetivo antes de continuar'
    :/rir|rpe/i.test(diagnosis.reason)
      ?'Falta registrar el RIR · repetimos el objetivo'
      :'Faltan datos de la sesión anterior · repetimos el objetivo';
  return ret(old,reason,{requiresReview:true,reviewKind:diagnosis.kind,reviewDetail:diagnosis.reason});
 }
 const performed=source.sets,min=n(p.min)??8,max=n(p.max)??12,target=n(p.rir)??1;
 if(max<min||min<1)return ret(old,'Cambiaste series o cargas · revisá el objetivo antes de continuar',
  {requiresReview:true,reviewKind:'range',reviewDetail:'El rango de repeticiones no es válido'});
 autoReady=true;
 const actual=performed.map(s=>({kg:s.kg,reps:s.reps}));
 const minRir=Math.min(...performed.map(s=>s.rir));
 const missed=performed.some((s,i)=>s.reps<old[i].reps);
 const effortLow=minRir<target;
 const atLimit=minRir<=0;
 const changedWeight=performed.some((s,i)=>!close(s.kg,old[i].kg));
 const exceeded=performed.some((s,i)=>s.reps>old[i].reps);
 if(missed)return ret(actual,(effortLow||atLimit)
  ?'No alcanzaste el objetivo y llegaste al límite · repetí lo realizado buscando más margen'
  :'No alcanzaste todas las reps · intentá completarlas antes de progresar',
  {reviewKind:changedWeight?'weightAdjusted':undefined});
 // RIR 0: NUNCA aumentar peso ni repeticiones, incluso con objetivo RIR 0.
 if(effortLow||atLimit)return ret(actual,exceeded
  ?'Superaste las reps, pero llegaste al límite · repetí lo realizado con mejor margen'
  :'Llegaste al límite · repetí las mismas reps buscando más margen');
 if(changedWeight)return ret(actual,
  'Cambiaste series o cargas · revisá el objetivo antes de continuar',
  {reviewKind:'weightAdjusted'});
 const inc=n(p.increment),canAddWeight=inc!==null&&inc>0;
 const top=performed.every(s=>s.reps>=max);
 // Al llegar al techo basta cumplir el RIR objetivo. No se exige RIR 3
 // ni repetir el rendimiento durante una segunda sesión.
 if(top && minRir>=target){
  if(canAddWeight)return ret(actual.map(s=>({kg:Math.round((s.kg+inc)*100)/100,reps:min})),
   'Subimos carga · volvemos al inicio del rango de reps');
  // No quitamos repeticiones realizadas por encima del máximo manteniendo el mismo peso.
  return ret(actual,'Llegaste al máximo de reps · configurá cuánto subir la carga',
   {requiresWeightReview:true});
 }
 // Primero repeticiones dentro del rango. El RIR más bajo de la sesión
 // decide cuántas series se pueden progresar; no usamos promedios.
 const margin=minRir-target;
 const budget=margin>=2?Number.POSITIVE_INFINITY:margin>=1?2:1;
 const next=copy(actual),changed=[];
 for(let i=0;i<next.length&&changed.length<budget;i++){
  if(next[i].reps<max){next[i].reps++;changed.push(i+1)}
 }
 let reason=changed.length
  ?describeRepetitionProgress(actual,next)
  :exceeded
    ?'Superaste el objetivo · mantenemos este rendimiento antes de volver a progresar'
    :'Repetí el mismo objetivo antes de progresar';
 // El número de series permanece igual: el volumen adicional es solo una sugerencia.
 const currentSets=performed.map(s=>({kg:s.kg,reps:s.reps}));
 const plateau=[source,...history.slice(0,2)];
 const stalled=plateau.length===3&&plateau.every(x=>eligiblePast(x,source)&&sameSets(x.sets,currentSets)&&x.sets.every(s=>s.rir>=target))&&old.length<5;
 if(stalled&&p.volumeEnabled!==false)reason+=' · 3 sesiones similares: evaluar +1 serie según recuperación';
 return ret(next,reason,{volumeCandidate:stalled&&p.volumeEnabled!==false});
}
function sideSource(source,side){return {
 updated:source.updated,
 plan:{...source.plan,sets:(source.plan.sets||[]).map(s=>goalSide(s,side))},
 sets:(source.sets||[]).map(s=>sideData(s,side)||{kg:null,reps:null,rir:null})
};}
// Para unilateral la progresión se decide a partir del registro MENOS favorable
// de ambos lados (reps mínimas, RIR mínimo). No se promedian resultados.
// Las cargas pueden seguir siendo distintas por lado; la propuesta de reps es común.
function unilateralReference(source){
 const p=source.plan||{};
 const sets=(source.sets||[]).map((set,i)=>{
  const l=sideData(set,'left'),r=sideData(set,'right');
  const pl=goalSide(p.sets[i],'left'),pr=goalSide(p.sets[i],'right');
  const leftLimits=Number(l.kg)<=Number(r.kg);
  return {goal:{kg:leftLimits?pl.kg:pr.kg,reps:Math.min(pl.reps,pr.reps)},
   actual:{kg:leftLimits?l.kg:r.kg,reps:Math.min(l.reps,r.reps),rir:Math.min(l.rir,r.rir)}};
 });
 return {updated:source.updated,plan:{...p,sets:sets.map(x=>x.goal)},sets:sets.map(x=>x.actual)};
}
function proposedUnilateral(source,mode,history=[]){
 const p=source.plan||{};
 if(mode==='manual')return {...copy(p),reason:'Objetivo manual · editable',volumeCandidate:false};
 if(mode==='deload'){
  const count=Math.max(1,Math.ceil((p.sets||[]).length/2));
  return {...copy(p),sets:copy((p.sets||[]).slice(0,count)),rir:Math.max(3.5,p.rir??1),reason:'Descarga · menos series, más margen',volumeCandidate:false};
 }
 const diagnosis=inspectRecord(source);
 if(!diagnosis.ready)return {...copy(p),reason:diagnosis.reason,requiresReview:true,reviewKind:diagnosis.kind,volumeCandidate:false};
 const reference=unilateralReference(source);
 // Si cualquiera de los lados cambió la carga respecto de SU objetivo, no
 // incrementamos automáticamente; la próxima sesión parte del peso real.
 const deviated=source.sets.some((set,i)=>['left','right'].some(side=>
  !close(sideData(set,side).kg,goalSide(p.sets[i],side).kg)));
 let calculated;
 if(deviated){
  calculated={sets:reference.sets.map(x=>({kg:x.kg,reps:x.reps})),
   reason:'Cambiaste series o cargas · revisá el objetivo antes de continuar',
   reviewKind:'weightAdjusted'};
 }else calculated=oneSide(reference,'auto',history.filter(x=>x?.unilateral&&inspectRecord(x).ready).map(unilateralReference));
 const current=reference.sets;
 const resultSets=(p.sets||[]).map((old,i)=>{
  const performed=source.sets[i];
  const newCommon=calculated.sets[i];
  const raisedKg=n(newCommon.kg)!==null&&n(current[i].kg)!==null
   &&newCommon.kg>current[i].kg;
  const increment=raisedKg?newCommon.kg-current[i].kg:0;
  const leftKg=Math.round((sideData(performed,'left').kg+increment)*100)/100;
  const rightKg=Math.round((sideData(performed,'right').kg+increment)*100)/100;
  const reps=newCommon.reps;
  return {...old,kg:close(leftKg,rightKg)?leftKg:Math.max(leftKg,rightKg),reps,
   sides:{left:{kg:leftKg,reps},right:{kg:rightKg,reps}}};
 });
 const planned=normalizeUnilateralSets(resultSets);
 const changed=!sameProposal(planned,resultSets);
 const reason=changed&&calculated.reason.startsWith('Progresamos')
  ?'Objetivo ordenado · ajustamos repeticiones para evitar series ascendentes'
  :calculated.reason;
 return {...copy(p),sets:planned,volumeCandidate:false,
  reason:'Ambos lados · '+reason,
  requiresReview:!!calculated.requiresReview,
  reviewKind:calculated.reviewKind,
  requiresWeightReview:!!calculated.requiresWeightReview};
}
function propose(source,mode,history=[]){
 if(!source?.unilateral)return oneSide(source,mode,history);
 return proposedUnilateral(source,mode,history);
}
// Etiqueta precisa de mejoras reales, también para semanas ya creadas.
function describeRepetitionProgress(previous,next){
 if(!Array.isArray(previous)||!Array.isArray(next)||previous.length!==next.length||!previous.length)return null;
 if(previous.some((s,i)=>!close(s.kg,next[i].kg)||n(s.reps)===null||n(next[i].reps)===null))return null;
 const changed=previous.map((s,i)=>next[i].reps===s.reps+1?i+1:null).filter(Boolean);
 if(!changed.length||previous.some((s,i)=>next[i].reps<s.reps||next[i].reps>s.reps+1))return null;
 return `Progresamos · sumamos repeticiones · +1 repetición en ${changed.length===1?'la serie '+changed[0]:'las series '+changed.join(' y ')} (${previous.map(x=>x.reps).join('-')} → ${next.map(x=>x.reps).join('-')})`;
}
// Leyendas legibles para planes creados con motores anteriores.
// Solo cambia el texto visible; nunca recalcula ni modifica una semana guardada.
function displayReason(reason){
 const r=String(reason||'');
 const mappings=[
  ['Sin registro completo · mantenemos el objetivo','Faltan datos de la sesión anterior · repetimos el objetivo'],
  ['Series o pesos distintos · revisá el objetivo','Cambiaste series o cargas · revisá el objetivo antes de continuar'],
  ['Falta RIR · mantenemos el objetivo','Falta registrar el RIR · repetimos el objetivo'],
  ['Recuperar · completá las reps con mejor margen','No alcanzaste el objetivo y llegaste al límite · repetí lo realizado buscando más margen'],
  ['Recuperar · completá las reps pendientes','No alcanzaste todas las reps · intentá completarlas antes de progresar'],
  ['Objetivo superado · ahora buscá mejor RIR','Superaste las reps, pero llegaste al límite · repetí lo realizado con mejor margen'],
  ['Consolidar · mismas reps, mejor RIR','Llegaste al límite · repetí las mismas reps buscando más margen'],
  ['Progresar · aumento de peso propuesto','Subimos carga · volvemos al inicio del rango de reps'],
  ['Tope de reps · configurá subida de kg','Llegaste al máximo de reps · configurá cuánto subir la carga'],
  ['Superaste el objetivo · seguimos desde lo realizado','Superaste el objetivo · la próxima progresión parte de lo que hiciste'],
  ['Progresar · sumamos repeticiones','Progresamos · sumamos repeticiones'],
  ['Objetivo superado · buen progreso','Superaste el objetivo · mantenemos este rendimiento antes de volver a progresar'],
  ['Consolidar · mismo objetivo','Repetí el mismo objetivo antes de progresar'],
  ['Descarga · menos series y más margen','Descarga · menos series, más margen'],
  ['Consolidar · confirmar el máximo una sesión comparable antes de subir carga','Repetí el mismo objetivo antes de progresar'],
  ['Recuperar · repetir lo realmente conseguido, buscando el RIR/RPE objetivo','No alcanzaste el objetivo y llegaste al límite · repetí lo realizado buscando más margen'],
  ['Recuperar · consolidar las repeticiones realmente realizadas antes de progresar','No alcanzaste todas las reps · intentá completarlas antes de progresar'],
  ['Consolidar · esfuerzo más alto de lo previsto; mantener lo conseguido','Llegaste al límite · repetí las mismas reps buscando más margen'],
  ['Consolidar · hubo cambio de carga; primero confirmar el rendimiento con el peso realmente utilizado','Cambiaste series o cargas · revisá el objetivo antes de continuar'],
  ['Revisar carga · sobró margen','Repetí el mismo objetivo antes de progresar'],
  ['Revisar carga ·','Llegaste al máximo de reps · configurá cuánto subir la carga'],
  ['Progresar · tope de rango','Subimos carga · volvemos al inicio del rango de reps'],
  ['Progresar · RIR','Subimos carga · volvemos al inicio del rango de reps'],
  ['Progresar · +1 repetición','Progresamos · sumamos repeticiones · +1 repetición']
 ];
 if(r.startsWith("Progresar · +1 repetición"))return "Progresamos · sumamos repeticiones · +1 repetición"+r.slice("Progresar · +1 repetición".length);
 for(const [from,to] of mappings){if(r.startsWith(from))return to;}
 return r;
}

const api={propose,inspectRecord,rirToRpe,rpeToRir,sameSets,goalSide,describeRepetitionProgress,displayReason};
root.ObsidianaProgression=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
