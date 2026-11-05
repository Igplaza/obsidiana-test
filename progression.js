/* Obsidiana · motor de progresión v4: funciones puras y comprobables.
   Escala persistida: RIR (0-10), con RPE = 10 - RIR para el rango RPE 1-10.
   Este motor ofrece sugerencias de entrenamiento, nunca garantías de resultados. */
(function(root){
'use strict';
const n=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
const close=(a,b)=>n(a)!==null&&n(b)!==null&&Math.abs(a-b)<0.001;
const clone=x=>JSON.parse(JSON.stringify(x));
const rirToRpe=x=>n(x)===null?null:Math.max(1,Math.min(10,Math.round((10-x)*2)/2));
const rpeToRir=x=>n(x)===null?null:Math.round((10-x)*2)/2;
function sameSets(a,b){return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((s,i)=>close(s.kg,b[i].kg)&&s.reps===b[i].reps)}
function readyRecord(x,p){
 return x&&Array.isArray(x.sets)&&x.sets.length===p.sets.length&&x.updated&&x.sets.every((s,i)=>n(s.kg)!==null&&n(s.reps)!==null&&s.reps>0&&n(s.rir)!==null&&close(s.kg,p.sets[i].kg));
}
function eligiblePast(x,reference){
 return !!x?.updated && Array.isArray(x.sets)&&x.sets.length===reference.sets.length&&x.sets.every((s,i)=>n(s.reps)!==null&&n(s.rir)!==null&&close(s.kg,reference.sets[i].kg));
}
function propose(source,mode,history=[]){
 const p=source.plan;
 const existing=(p.sets||[]).map(s=>({kg:s.kg??null,reps:s.reps??null}));
 const ret=(sets,reason,more={})=>({...p,sets,reason,volumeCandidate:false,...more});
 if(mode==='manual')return ret(existing,'Objetivo manual · editable');
 if(mode==='deload')return ret(existing.slice(0,Math.max(1,Math.ceil(existing.length*0.5))).map(s=>({...s,reps:s.reps==null?null:Math.max(1,Math.min(s.reps,p.max))})), 'Descarga · menos series y mayor margen',{rir:Math.max(3.5,p.rir??1)});
 if(!source.updated || !Array.isArray(source.sets) || source.sets.length!==existing.length || existing.some(s=>n(s.kg)===null||n(s.reps)===null))return ret(existing,'Registro incompleto · mantenemos objetivos');
 const performed=source.sets;
 if(!readyRecord(source,p))return ret(existing,'Series, cargas o esfuerzo incompletos · revisar antes de progresar');
 const target=n(p.rir)??1;
 const min=n(p.min)??8, max=n(p.max)??12;
 if(max<min || max<=0)return ret(existing,'Rango de repeticiones inválido · revisá objetivo');
 const repsMiss=performed.some((s,i)=>s.reps<existing[i].reps);
 if(repsMiss)return ret(existing,'Recuperar · completá primero las repeticiones planificadas');
 const tooHard=performed.some(s=>s.rir<target-0.01);
 if(tooHard)return ret(existing,'Consolidar · esfuerzo mayor al previsto; mantenemos objetivo');
 const failure=performed.some(s=>s.rir<=0);
 if(failure)return ret(existing,'Consolidar · hubo fallo muscular; buscá mayor margen');
 const out=performed.map(s=>({kg:s.kg,reps:Math.min(max,s.reps)}));
 const top=performed.every(s=>s.reps>=max);
 const past=history.filter(h=>h && eligiblePast(h,source));
 const consecutiveTop=history.length>0 && eligiblePast(history[0],source) && history[0].sets.every(s=>s.reps>=max && s.rir>=target);
 const strongEffort=performed.every(s=>s.rir>=target+1);
 const increment=n(p.increment);
 if(top){
  if(increment!==null&&increment>0 && (strongEffort||consecutiveTop)){
   // La carga solo sube con incremento definido por el usuario, nunca inventado.
   return ret(out.map(s=>({kg:Math.round((s.kg+increment)*100)/100,reps:min})),'Progresar · rango completo; subimos carga y reiniciamos reps');
  }
  if(increment===null||increment<=0)return ret(out,'Tope del rango · configurá el incremento de kg para subir carga');
  return ret(out,'Consolidar · repetí el tope del rango una sesión más antes de subir peso');
 }
 // Escalonado por margen de esfuerzo. RIR objetivo+2: tres series; +1: dos; objetivo: primera elegible.
 const minMargin=Math.min(...performed.map(s=>s.rir-target));
 const budget=minMargin>=2?3:minMargin>=1?2:1;
 let added=0;
 for(let i=0;i<out.length&&added<budget;i++){
  if(out[i].reps<max && performed[i].rir>=target){out[i].reps++;added++}
 }
 let reason=added===3?'Progresar · +1 repetición en las primeras 3 series':added===2?'Progresar · +1 repetición en las primeras 2 series':added===1?'Progresar · +1 repetición en la primera serie disponible':'Consolidar · mantenemos la planificación';
 // La ampliación de volumen NO es automática: requiere tener en cuenta recuperación,
 // objetivo y volumen semanal total que la app no conoce suficientemente.
 const currentComparable=performed.map(s=>({kg:s.kg,reps:s.reps}));
 const stagnant=[source,...history.slice(0,2)];
 const plateau=stagnant.length===3 && stagnant.every(x=>eligiblePast(x,source)&&sameSets(x.sets,currentComparable)&&x.sets.every(s=>s.rir>=target)) && existing.length<5;
 if(plateau&&p.volumeEnabled!==false)reason+=' · 3 sesiones similares: podés evaluar +1 serie si recuperás bien';
 return ret(out,reason,{volumeCandidate:!!(plateau&&p.volumeEnabled!==false)});
}
const api={propose,rirToRpe,rpeToRir,sameSets};
root.ObsidianaProgression=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
