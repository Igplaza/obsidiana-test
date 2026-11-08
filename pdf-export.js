/* Obsidiana · PDF portátil sin conexión ni bibliotecas externas.
   Exporta únicamente registros que ya fueron guardados. No sube datos a la nube. */
(function (root) {
'use strict';
const PAGE_W = 595.28, PAGE_H = 841.89, LEFT = 43, RIGHT = 552, BOTTOM = 55;
const latin = value => String(value ?? '').replace(/[\u2010-\u2015]/g, '-')
 .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"')
 .replace(/[\u2022\u25cf\u2713\u26a1\u2192]/g, '-').replace(/\u2026/g, '...')
 .replace(/\r/g,'').replace(/[^\x20-\x7E\xA0-\xFF\n\t]/g, '?');
const esc = value => latin(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\n\t]/g, ' ');
const num = v => v === null || v === undefined || !Number.isFinite(Number(v)) ? '--' : String(v);
const fmt = date => {try{return new Date(date).toLocaleString('es-AR')}catch{return String(date ?? '')}};
const wrap=(text,max)=>{
 const out=[];
 for(const raw of latin(text).split('\n')){
  let line='';
  for(const word of (raw.match(/\S+/g)||[])){
   if(!line){line=word;continue;}
   if(line.length+1+word.length<=max){line+=' '+word;continue;}
   out.push(line);line=word;
  }
  while(line.length>max){out.push(line.slice(0,max));line=line.slice(max)}
  out.push(line);
 }
 return out;
};
function buildReport(input){
 if(!input || !Array.isArray(input.days))throw new Error('No hay datos válidos para exportar.');
 const pages=[];let cmds=[], y=0;
 const newPage=()=>{
  cmds=['1 1 1 rg 0 0 '+PAGE_W+' '+PAGE_H+' re f','0.09 0.10 0.14 rg 0 789 '+PAGE_W+' 53 re f','0.64 0.45 0.89 rg 0 785 '+PAGE_W+' 4 re f'];
  y=768;pages.push(cmds);
  text('OBSIDIANA  /  REPORTE DE ENTRENAMIENTO',LEFT,805,14,true,true);
 };
 function text(value,x,base,size=10,bold=false,white=false){
  const c=white?'1 1 1 rg':'0.11 0.14 0.18 rg';
  cmds.push(`${c} BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(2)} ${base.toFixed(2)} Tm (${esc(value)}) Tj ET`);
 }
 function ensure(space=18){if(y-space<BOTTOM)newPage()}
 function line(value,size=10,bold=false,indent=0,sep=14){
  const max=Math.max(25,Math.floor((RIGHT-LEFT-indent)/(size*0.52)));
  for(const part of wrap(value,max)){
   ensure(sep+3);text(part,LEFT+indent,y,size,bold);y-=sep;
  }
 }
 function block(name){
  ensure(50);y-=7;
  cmds.push(`0.92 0.90 0.96 rg ${LEFT-3} ${(y-6).toFixed(1)} ${RIGHT-LEFT+6} 21 re f`);
  text(name,LEFT+6,y,11,true);y-=28;
 }
 function hr(){ensure(13);cmds.push(`0.83 0.85 0.88 RG 0.4 w ${LEFT} ${y} m ${RIGHT} ${y} l S`);y-=13}
 newPage();
 line(`Generado: ${fmt(input.created || new Date().toISOString())}`,9);
 line(`Perfil: ${input.person || 'Entrenamiento personal'}  |  Semana ${input.week}  |  ${input.scope==='day'?'Día':'Semana completa'}`,11,true,0,16);
 line(`Escala de registro: ${input.effort==='rpe'?'RPE (1 a 10)':'RIR'}  ·  El detalle de esfuerzo incluye ambas equivalencias.`,9);
 y-=6;hr();
 let total=0, seriesTotal=0;
 for(const d of input.days){
  const saved=d.exercises.filter(e=>e.updated);
  if(!saved.length)continue;
  block(d.name || 'Día '+d.number);
  for(const e of saved){
   total++;
   ensure(68);
   line(e.name,12,true,0,17);
   line('Estado: '+(e.sets?.length && e.sets.every(s=>s.kg!==null&&s.reps>0&&s.rir!==null&&s.rir!==undefined)?'completo':'registro parcial')+'   |   Guardado: '+fmt(e.updated),8,false,0,13);
   if(e.plan?.sets?.length){
    line('Objetivo: '+e.plan.sets.map(x=>num(x.kg)+' kg x '+num(x.reps)).join(' / ')+`  |  RIR objetivo ${num(e.plan.rir)}`,8,false,0,13);
   }
   for(let i=0;i<(e.sets||[]).length;i++){
    const s=e.sets[i];seriesTotal++;
    const validEffort=s.rir!==null&&s.rir!==undefined&&Number.isFinite(Number(s.rir));
    const rpe=validEffort?Math.max(1,Math.min(10,Math.round((10-s.rir)*2)/2)):'--';
    line(`Serie ${i+1}:  ${num(s.kg)} kg  x  ${num(s.reps)} reps   |   RIR ${validEffort?s.rir:'--'}  /  RPE ${rpe}`,9,false,12,14);
   }
   if((e.notes||'').trim()){line('Comentarios:',9,true);line(e.notes,9,false,12,13)}
   if(e.videoUrl)line('Video: '+e.videoUrl,8,false,12,12);
   y-=5;hr();
  }
 }
 if(!total)throw new Error('No hay ejercicios guardados en el período seleccionado. Guardá un registro antes de exportar.');
 ensure(33);line(`TOTAL: ${total} ejercicio(s) guardado(s) · ${seriesTotal} serie(s)`,10,true,0,15);
 line('Documento informativo: refleja los registros guardados, no datos pendientes de guardar.',8);
 const objs=[null];
 const add=str=>{objs.push(str);return objs.length-1};
 const catalog=add('');const pagesObj=add('');
 const f1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 const f2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const refs=[];
 for(let p=0;p<pages.length;p++){
  const cmd=pages[p];
  cmd.push(`0.48 0.50 0.55 rg BT /F1 8 Tf 1 0 0 1 ${LEFT} 30 Tm (Obsidiana - entrenamiento) Tj ET`);
  cmd.push(`0.48 0.50 0.55 rg BT /F1 8 Tf 1 0 0 1 490 30 Tm (Pagina ${p+1}/${pages.length}) Tj ET`);
  const stream=cmd.join('\n')+'\n';
  const st=add(`<< /Length ${stream.length} >>\nstream\n${stream}endstream`);
  const page=add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${st} 0 R >>`);
  refs.push(page+' 0 R');
 }
 objs[pagesObj]=`<< /Type /Pages /Kids [${refs.join(' ')}] /Count ${refs.length} >>`;
 objs[catalog]=`<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
 let pdf='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';const offsets=[0];
 for(let i=1;i<objs.length;i++){
  offsets.push(pdf.length);
  pdf+=`${i} 0 obj\n${objs[i]}\nendobj\n`;
 }
 const xref=pdf.length;
 pdf+=`xref\n0 ${objs.length}\n0000000000 65535 f \n`;
 for(let i=1;i<offsets.length;i++)pdf+=String(offsets[i]).padStart(10,'0')+' 00000 n \n';
 pdf+=`trailer\n<< /Size ${objs.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Uint8Array.from(pdf,c=>c.charCodeAt(0)&0xff);
}
function toBase64(bytes){let data='';for(let i=0;i<bytes.length;i+=8192)data+=String.fromCharCode(...bytes.slice(i,i+8192));return btoa(data)}
async function sharePDF(bytes,name){
 if(root.Capacitor?.isNativePlatform?.()){
  if(typeof root.obsidianaNativePdf!=='function')throw new Error('Falta el módulo PDF nativo. Ejecutá android:prepare y compilá la nueva APK.');
  await root.obsidianaNativePdf(name,toBase64(bytes));return;
 }
 const blob=new Blob([bytes],{type:'application/pdf'});
 const file=new File([blob],name,{type:'application/pdf'});
 if(navigator.share && navigator.canShare?.({files:[file]})){
  await navigator.share({files:[file],title:'Reporte Obsidiana'});return;
 }
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;
 document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},30000);
}
function setup(){
 const button=document.getElementById('pdfExport');if(!button)return;
 button.addEventListener('click',()=>{
  if(typeof root.obsidianaCloseMenu==='function')root.obsidianaCloseMenu();
  if(typeof guardDirty==='function'&&!guardDirty())return;
  if(!root.obsPdfExport){/* no-op */}
  const title=document.getElementById('modalTitle'),body=document.getElementById('modalBody'),overlay=document.getElementById('overlay');
  title.textContent='Exportar entrenamiento en PDF';
  body.innerHTML='<p>Compartí lo que realmente registraste, con pesos, repeticiones, RIR/RPE y comentarios.</p><div class="pdf-export-dialog"><button type="button" class="button primary" id="obsPdfDay">Día actual</button><button type="button" class="button" id="obsPdfWeek">Semana completa</button></div><p id="obsPdfStatus" class="sub" role="status">No se incluyen cambios sin guardar.</p>';
  overlay.classList.add('open');
  for(const [id,scope] of [['obsPdfDay','day'],['obsPdfWeek','week']]){
   document.getElementById(id).onclick=async ()=>{
    const status=document.getElementById('obsPdfStatus');const choice=document.getElementById(id);choice.disabled=true;status.textContent='Generando PDF…';
    try{
     const w=week();const days=scope==='day'?[day()]:w.days;
     const pdf=buildReport({created:new Date().toISOString(),week:currentWeek,scope,person:typeof activeWorkspace==='function'&&activeWorkspace()?'Alumno: '+activeWorkspace():'Mi entrenamiento personal',effort:effortScale(),days});
     const filename=`Obsidiana-Semana${currentWeek}-${scope==='day'?'Dia'+currentDay:'Completa'}.pdf`;
     await sharePDF(pdf,filename);
     status.textContent='PDF generado. Comprobá que se haya guardado o compartido.';
    }catch(err){if(err?.name==='AbortError'){status.textContent='Se canceló la exportación.';}else{status.textContent='No se pudo exportar: '+(err.message||err);console.error(err)}}
    finally{choice.disabled=false}
   };
  }
 });
}
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
}
root.ObsidianaPDF={buildReport};
if(typeof module!=='undefined'&&module.exports)module.exports={buildReport};
})(typeof globalThis!=='undefined'?globalThis:this);
