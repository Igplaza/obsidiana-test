/* OBSIDIANA V3 · Mi evolución. Lectura solamente: nunca modifica registros. */
'use strict';
(function(){
const $s=id=>document.getElementById(id);
const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number.isFinite(n)?n.toLocaleString('es-AR',{maximumFractionDigits:1}):'—';
const metrics={weight:'Carga máxima registrada (kg)',reps:'Repeticiones totales',volume:'Volumen (kg × reps)',rir:'RIR mínimo registrado'};
function logSets(e){return e.unilateral?e.sets.flatMap(s=>['left','right'].map(side=>s.sides?.[side]).filter(Boolean)):e.sets;}
function records(id){
 return model.weeks.flatMap(w=>w.days.flatMap(d=>d.exercises.filter(e=>e.exerciseId===id&&e.updated&&logSets(e).some(s=>s.kg!==null&&s.reps!==null&&s.reps>0)).map(e=>{
  const used=logSets(e).filter(s=>typeof s.kg==='number'&&typeof s.reps==='number'&&s.reps>0);
  const rirs=used.map(s=>s.rir).filter(v=>typeof v==='number');
  return {week:w.number,kind:w.kind||'normal',name:e.name,sets:used.length,weight:used.length?Math.max(...used.map(s=>s.kg)):null,reps:used.reduce((a,s)=>a+s.reps,0),volume:used.reduce((a,s)=>a+s.kg*s.reps,0),rir:rirs.length?Math.min(...rirs):null,weights:[...new Set(used.map(s=>s.kg))]};
 }))).sort((a,b)=>a.week-b.week);
}
function svgChart(points,label){
 const good=points.filter(p=>p.v!==null&&Number.isFinite(p.v));
 if(!good.length)return '<div class="blank">Todavía no hay suficientes registros para esta métrica.</div>';
 const W=620,H=265,L=53,R=18,T=23,B=46,inner=W-L-R,span=H-T-B;
 const vals=good.map(p=>p.v),mn=Math.min(...vals),mx=Math.max(...vals),pad=Math.max((mx-mn)*.12,.5),lo=Math.max(0,mn-pad),hi=mx+pad;
 const x=i=>L+(points.length===1?inner/2:(inner*i/(points.length-1)));
 const y=v=>T+(hi-v)/(hi-lo)*span;
 const coords=points.map((p,i)=>p.v===null?null:{x:x(i),y:y(p.v),w:p.w,v:p.v}).filter(Boolean);
 const lines=Array.from({length:5},(_,i)=>{const v=lo+(hi-lo)*(4-i)/4,yy=y(v);return `<line class="grid-line" x1="${L}" y1="${yy}" x2="${W-R}" y2="${yy}"/><text class="axis-label" x="${L-7}" y="${yy+4}" text-anchor="end">${html(fmt(v))}</text>`}).join('');
 const paths=[];let seg=[];points.forEach((p,i)=>{if(p.v===null){if(seg.length)paths.push(seg.join(' '));seg=[]}else seg.push(`${x(i).toFixed(1)},${y(p.v).toFixed(1)}`)});if(seg.length)paths.push(seg.join(' '));
 const line=paths.map(p=>`<polyline class="series-line" points="${p}"/>`).join('');
 const circles=coords.map(p=>`<circle class="series-dot" cx="${p.x}" cy="${p.y}" r="5"><title>Semana ${p.w} · ${fmt(p.v)}</title></circle>`).join('');
 const ticks=points.map((p,i)=>`<text class="axis-label" x="${x(i)}" y="${H-17}" text-anchor="middle">S${p.w}</text>`).join('');
 return `<div class="stats-chart"><svg role="img" aria-label="Gráfico de ${html(label)} por semana" viewBox="0 0 ${W} ${H}"><g>${lines}${line}${circles}${ticks}</g></svg></div>`;
}
function build(){
 const previous=$s('statsExercise')?.value||'',selectedMetric=$s('statsMetric')?.value||'weight';
 const choices=new Map();model.weeks.forEach(w=>w.days.forEach(d=>d.exercises.forEach(e=>{if(e.updated&&logSets(e).some(s=>s.reps!==null&&s.kg!==null))choices.set(e.exerciseId,e.name)})));
 const sorted=[...choices].sort((a,b)=>a[1].localeCompare(b[1],'es'));
 const selected=choices.has(previous)?previous:(sorted[0]?.[0]||'');
 if(!sorted.length){$s('modalBody').innerHTML='<p class="muted">Todavía no hay entrenamientos registrados. Guardá un ejercicio y acá vas a ver su evolución.</p>';return}
 const a=records(selected);const metric=selectedMetric in metrics?selectedMetric:'weight';const useRpe=typeof effortScale==='function'&&effortScale()==='rpe';const effortMetricLabel=useRpe?'RPE máximo registrado':'RIR mínimo registrado';
 const latest=a.at(-1); const hasMulti=a.some(x=>x.weights.length>1);
 const first=a[0];
 const opts=sorted.map(([id,name])=>`<option value="${html(id)}" ${id===selected?'selected':''}>${html(name)}</option>`).join('');
 $s('modalBody').innerHTML=`<div class="stats-controls"><label>Ejercicio<select id="statsExercise">${opts}</select></label><label>Gráfico<select id="statsMetric">${Object.entries(metrics).map(([key,label])=>`<option value="${key}" ${metric===key?'selected':''}>${html(key==='rir'?effortMetricLabel:label)}</option>`).join('')}</select></label></div><div class="stats-grid"><div class="stats-tile"><small>Semanas registradas</small><b>${a.length}</b></div><div class="stats-tile"><small>Última carga máxima</small><b>${fmt(latest.weight)} kg</b></div><div class="stats-tile"><small>Último volumen</small><b>${fmt(latest.volume)}</b></div></div>${svgChart(a.map(r=>({w:r.week,v:metric==='rir'&&useRpe?(r.rir===null?null:Math.max(1,10-r.rir)):r[metric]})),metric==='rir'?effortMetricLabel:metrics[metric])}<p class="stats-note">${metric==='weight'?'Muestra la mayor carga utilizada en una serie de cada sesión.':metric==='volume'?'Volumen = suma de kg × repeticiones registradas (ambos lados en ejercicios unilaterales). No mide directamente hipertrofia.':metric==='rir'?(useRpe?'Se muestra el RPE equivalente al RIR más bajo registrado; un RPE mayor significa más proximidad al fallo.':'Se muestra el RIR más bajo de las series registradas; un RIR menor significa mayor proximidad al fallo.'):'Suma las repeticiones de las series con peso y repeticiones registrados.'} ${hasMulti?'Hay sesiones con diferentes pesos por serie.':''} Las descargas también aparecen; interpretá los cambios teniendo eso en cuenta.</p><div class="stats-records">${a.slice().reverse().map(x=>`<div class="stats-record"><span>Semana ${x.week}${x.kind==='deload'?' · descarga':''}</span><span>${fmt(x.weight)} kg máx. · ${fmt(x.reps)} reps · ${useRpe?'RPE':'RIR'} ${fmt(useRpe?(x.rir===null?null:Math.max(1,10-x.rir)):x.rir)}</span></div>`).join('')}</div>`;
 $s('statsExercise').addEventListener('change',build);
 $s('statsMetric').addEventListener('change',build);
}
$s('evolution').addEventListener('click',()=>{if(typeof guardDirty==='function'&&!guardDirty())return;modal('Mi evolución', '<p class="muted">Cargando…</p>');build()});
})();
