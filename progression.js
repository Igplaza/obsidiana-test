/* Obsidiana · Progresión v5.
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
function oneSide(source,mode,history=[]){
 const p=source.plan||{};
 const old=(p.sets||[]).map(s=>({kg:s.kg??null,reps:s.reps??null}));
 const ret=(sets,reason,extra={})=>({...p,sets,reason,volumeCandidate:false,...extra});
 if(mode==='manual')return ret(old,'Objetivo manual · editable');
 if(mode==='deload')return ret(old.slice(0,Math.max(1,Math.ceil(old.length/2))), 'Descarga · menos series y más margen',{rir:Math.max(3.5,p.rir??1)});
 const diagnosis=inspectSingle(source);
 if(!diagnosis.ready)return ret(old,diagnosis.reason,{requiresReview:true,reviewKind:diagnosis.kind});
 const performed=source.sets, min=n(p.min)??8,max=n(p.max)??12,target=n(p.rir)??1;
 if(max<min||min<1)return ret(old,'Rango inválido · corregí el objetivo',{requiresReview:true});
 const actual=performed.map(s=>({kg:s.kg,reps:s.reps}));
 const missed=performed.some((s,i)=>s.reps<old[i].reps);
 const effortLow=performed.some(s=>s.rir<target);
 const changedWeight=performed.some((s,i)=>!close(s.kg,old[i].kg));
 if(missed){
  // Nunca volver a mandar las reps FALLIDAS como si se hubieran conseguido.
  return ret(actual,effortLow
   ?'Recuperar · repetir lo realmente conseguido, buscando el RIR/RPE objetivo'
   :'Recuperar · consolidar las repeticiones realmente realizadas antes de progresar',
   {reviewKind:changedWeight?'weightAdjusted':undefined});
 }
 if(effortLow||performed.some(s=>s.rir<=0))return ret(actual,'Consolidar · esfuerzo más alto de lo previsto; mantener lo conseguido');
 if(changedWeight)return ret(actual,'Consolidar · hubo cambio de carga; primero confirmar el rendimiento con el peso realmente utilizado',{reviewKind:'weightAdjusted'});
 const inc=n(p.increment),canAddWeight=inc!==null&&inc>0;
 const minRir=Math.min(...performed.map(s=>s.rir));
 const strong=minRir>=3 && minRir>=target+1 && target<3;
 const top=performed.every(s=>s.reps>=max);
 const overshot=performed.some(s=>s.reps>max);
 const confirmed=history.length>0&&eligiblePast(history[0],source)&&history[0].sets.every(s=>s.reps>=max&&s.rir>=target);
 const extraEffort=performed.every(s=>s.rir>=target+1);
 // RIR >= 3 con objetivo más exigente: evaluar carga antes de regalar +3 reps.
 if(strong){
  if(canAddWeight)return ret(actual.map(s=>({kg:Math.round((s.kg+inc)*100)/100,reps:Math.max(min,Math.min(max,s.reps-2))})),
    `Progresar · RIR ${fmt(minRir)}: subir ${inc} kg y reajustar repeticiones`);
  return ret(actual,'Revisar carga · sobró margen (RIR ≥3): configurá «Subida kg» para evaluar el aumento',{requiresWeightReview:true});
 }
 if(top){
  if(canAddWeight&&(overshot||extraEffort||confirmed))return ret(actual.map(s=>({kg:Math.round((s.kg+inc)*100)/100,reps:min})),
    `Progresar · tope de rango${overshot?' superado':''}; subir ${inc} kg y volver a ${min} reps`);
  if(!canAddWeight)return ret(actual,`Revisar carga · ${overshot?'superaste':'completaste'} el máximo de ${max} reps; configurá «Subida kg». No quitamos reps con el mismo peso`,{requiresWeightReview:true});
  return ret(actual,'Consolidar · confirmar el máximo una sesión comparable antes de subir carga');
 }
 const minMargin=Math.min(...performed.map(s=>s.rir-target));
 const budget=minMargin>=2?3:minMargin>=1?2:1;
 const next=copy(actual),changed=[];
 for(let i=0;i<next.length && changed.length<budget;i++){
  if(next[i].reps<max){next[i].reps++;changed.push(i+1)}
 }
 let reason=changed.length
  ?`Progresar · +1 repetición en ${changed.length===1?'la serie '+changed[0]:'las series '+changed.join(' y ')} (${performed.map(s=>s.reps).join('-')} → ${next.map(s=>s.reps).join('-')})`
  :`Consolidar · ninguna serie puede superar ${max} reps`;
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
function propose(source,mode,history=[]){
 if(!source?.unilateral)return oneSide(source,mode,history);
 const p=source.plan||{};
 if(mode==='manual')return {...copy(p),reason:'Objetivo unilateral manual · editable',volumeCandidate:false};
 if(mode==='deload'){
  const count=Math.max(1,Math.ceil((p.sets||[]).length/2));
  return {...copy(p),sets:copy((p.sets||[]).slice(0,count)),rir:Math.max(3.5,p.rir??1),reason:'Descarga unilateral · menos series y más margen',volumeCandidate:false};
 }
 const diagnosis=inspectRecord(source);
 if(!diagnosis.ready)return {...copy(p),reason:diagnosis.reason,requiresReview:true,reviewKind:diagnosis.kind,volumeCandidate:false};
 const left=oneSide(sideSource(source,'left'),'auto',history.map(h=>sideSource(h,'left')));
 const right=oneSide(sideSource(source,'right'),'auto',history.map(h=>sideSource(h,'right')));
 const combined=p.sets.map((s,i)=>{
  const l=left.sets[i],r=right.sets[i];
  return {...s,kg:close(l.kg,r.kg)?l.kg:s.kg,reps:l.reps===r.reps?l.reps:s.reps,
   sides:{left:{kg:l.kg,reps:l.reps},right:{kg:r.kg,reps:r.reps}}};
 });
 return {...copy(p),sets:combined,volumeCandidate:false,
  reason:'Izquierda: '+left.reason+' · Derecha: '+right.reason,
  requiresReview:!!(left.requiresReview||right.requiresReview),
  requiresWeightReview:!!(left.requiresWeightReview||right.requiresWeightReview)};
}
// Etiqueta precisa de mejoras reales, también para semanas ya creadas.
function describeRepetitionProgress(previous,next){
 if(!Array.isArray(previous)||!Array.isArray(next)||previous.length!==next.length||!previous.length)return null;
 if(previous.some((s,i)=>!close(s.kg,next[i].kg)||n(s.reps)===null||n(next[i].reps)===null))return null;
 const changed=previous.map((s,i)=>next[i].reps===s.reps+1?i+1:null).filter(Boolean);
 if(!changed.length||previous.some((s,i)=>next[i].reps<s.reps||next[i].reps>s.reps+1))return null;
 return `Progresar · +1 repetición en ${changed.length===1?'la serie '+changed[0]:'las series '+changed.join(' y ')} (${previous.map(x=>x.reps).join('-')} → ${next.map(x=>x.reps).join('-')})`;
}
const api={propose,inspectRecord,rirToRpe,rpeToRir,sameSets,goalSide,describeRepetitionProgress};
root.ObsidianaProgression=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
