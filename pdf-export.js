/* Obsidiana | Informes PDF con tarjetas y tablas, sin conexión ni librerías externas.
   Exporta objetivos incluso antes de realizar la sesión, más registros guardados. */
(function(root){
'use strict';
const PW=595.28,PH=841.89,L=38,R=PW-38,W=R-L,BOTTOM=54;
const C={ink:'#171B23',dark:'#111319',slate:'#363B48',purple:'#A77BE8',purplePale:'#F0E8FA',white:'#FFFFFF',bg:'#F8F9FB',line:'#DFE3EB',muted:'#656D7B',soft:'#F2F4F7',green:'#167B66',greenPale:'#E6F6F1',amber:'#94621E',amberPale:'#FFF1DB'};
const rgb=hex=>{const n=hex.replace('#','');return [0,2,4].map(i=>(parseInt(n.slice(i,i+2),16)/255).toFixed(4)).join(' ')};
const latin=value=>String(value??'').normalize('NFC').replace(/[\u2010-\u2015]/g,'-')
 .replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"')
 .replace(/[\u2022\u25cf\u2713\u26a1\u2192]/g,'-').replace(/\u2026/g,'...')
 .replace(/\u00a0/g,' ').replace(/\r/g,'').replace(/[^\x20-\x7E\xA0-\xFF\n\t]/g,'?');
const esc=s=>latin(s).replace(/\\/g,'\\\\').replace(/\(/g,'\\(').replace(/\)/g,'\\)').replace(/[\n\t]/g,' ');
const val=x=>x===null||x===undefined||x===''||!Number.isFinite(Number(x))?'--':String(x);
const fmtNum=x=>Number.isFinite(Number(x))?Number(x).toLocaleString('es-AR',{maximumFractionDigits:1}):'--';
const dt=x=>{const d=new Date(x||Date.now());return Number.isFinite(d.getTime())?d.toLocaleDateString('es-AR'):'Sin fecha'};
const effortText=x=>{const n=Number(x);if(x==null||x===''||!Number.isFinite(n))return '--';return String(Math.round((10-n)*2)/2)};
const isDone=s=>Array.isArray(s)&&s.length>0&&s.every(z=>z.kg!==null&&z.kg!==undefined&&z.kg!==''&&Number.isFinite(Number(z.kg))&&Number(z.reps)>0&&z.rir!==null&&z.rir!==undefined&&z.rir!==''&&Number.isFinite(Number(z.rir)));
function widthOf(s,size,bold){let w=0;for(const c of latin(s)){if('ilI.,:;!\'|'.includes(c))w+=.27;else if('MW@#%'.includes(c))w+=.82;else if(c===' ')w+=.27;else w+=bold?.60:.52;}return w*size;}
function fit(s,px,size=10,bold=false){const raw=latin(s).replace(/\n/g,' ');if(widthOf(raw,size,bold)<=px)return raw;let t=raw;while(t.length>1&&widthOf(t+'...',size,bold)>px)t=t.slice(0,-1);return t+'...'}
function wrap(value,maxwidth,size=9,bold=false){
 const output=[];for(const p of latin(value).split('\n')){
  if(!p.trim()){output.push('');continue}let current='';
  const pieces=p.match(/\S+/g)||[];
  for(let word of pieces){
   while(widthOf(word,size,bold)>maxwidth){
    if(current){output.push(current);current=''}
    let n=1;while(n<word.length&&widthOf(word.slice(0,n+1),size,bold)<=maxwidth)n++;
    output.push(word.slice(0,n));word=word.slice(n);
   }
   if(!word)continue;
   const next=current?current+' '+word:word;
   if(widthOf(next,size,bold)>maxwidth&&current){output.push(current);current=word}else current=next;
  }
  if(current)output.push(current);
 }
 return output;
}
function buildReport(input){
 if(!input||!Array.isArray(input.days))throw new Error('No hay datos válidos para exportar.');
 const days=input.days.map(d=>({...d,items:(Array.isArray(d.exercises)?d.exercises:[]).filter(e=>e&&(e.plan?.sets?.length||e.updated))})).filter(d=>d.items.length);
 if(!days.length)throw new Error('No hay ejercicios ni objetivos planificados en el período seleccionado.');
 let exerciseCount=0,setCount=0,volume=0,plannedCount=0;
 for(const d of days)for(const e of d.items){
  exerciseCount++;plannedCount+=(e.plan?.sets||[]).length;
  if(!e.updated)continue;
  for(const s of (e.sets||[])){
   if(s.kg===null||s.kg===undefined||!Number.isFinite(Number(s.kg))||!Number.isFinite(Number(s.reps))||Number(s.reps)<=0)continue;
   setCount++;volume+=Number(s.kg)*Number(s.reps);
  }
 }
 const pages=[];let stream=[],cy=0,daySeq=0;
 function setFill(col){stream.push(rgb(col)+' rg')}
 function setStroke(col){stream.push(rgb(col)+' RG')}
 function rectangle(x,y,w,h,color,stroke=null,lw=1){if(color)setFill(color);if(stroke){setStroke(stroke);stream.push(lw+' w')}stream.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${stroke?(color?'B':'S'):'f'}`)}
 function rounded(x,y,w,h,r,color,stroke=null){r=Math.min(r,h/2,w/2);if(color)setFill(color);if(stroke){setStroke(stroke);stream.push('.8 w')}
  const k=.55228475*r;
  stream.push(`${x+r} ${y} m ${x+w-r} ${y} l ${x+w-r+k} ${y} ${x+w} ${y+r-k} ${x+w} ${y+r} c ${x+w} ${y+h-r} l ${x+w} ${y+h-r+k} ${x+w-r+k} ${y+h} ${x+w-r} ${y+h} c ${x+r} ${y+h} l ${x+r-k} ${y+h} ${x} ${y+h-r+k} ${x} ${y+h-r} c ${x} ${y+r} l ${x} ${y+r-k} ${x+r-k} ${y} ${x+r} ${y} c h ${stroke?(color?'B':'S'):'f'}`);
 }
 function txt(s,x,y,size=9,bold=false,col=C.ink){setFill(col);stream.push(`BT /${bold?'F2':'F1'} ${size} Tf 1 0 0 1 ${Number(x).toFixed(2)} ${Number(y).toFixed(2)} Tm (${esc(s)}) Tj ET`)}
 function lines(arr,x,y,size=9,col=C.ink,lead=13,bold=false){arr.forEach((v,i)=>txt(v,x,y-i*lead,size,bold,col))}
 function drawGem(x,y){ // pequeño símbolo geométrico de marca
  setFill(C.purple);stream.push(`${x+9} ${y+20} m ${x+18} ${y+10} l ${x+9} ${y} l ${x} ${y+10} l h f`);
  setFill('#7650A8');stream.push(`${x+9} ${y+20} m ${x+18} ${y+10} l ${x+9} ${y+10} l h f`);
  setFill('#C6A2F2');stream.push(`${x+9} ${y+20} m ${x+9} ${y+10} l ${x} ${y+10} l h f`);
 }
 function page(){
  stream=[];pages.push(stream);rectangle(0,0,PW,PH,C.white);rectangle(0,PH-103,PW,103,C.dark);rectangle(0,PH-106,PW,3,C.purple);
  drawGem(L,PH-71);txt('O B S I D I A N A',L+29,PH-48,14,true,C.white);txt('INFORME DE ENTRENAMIENTO',L+29,PH-66,10,false,'#E4D8F6');
  txt('OBJETIVOS Y RESULTADOS',R-168,PH-50,8,true,'#B7BDC8');
  cy=PH-125;
 }
 function room(h){if(cy-h<BOTTOM)page()}
 function badge(e,x,y){
  const done=!!e.updated&&isDone(e.sets),planned=!e.updated;
  const label=planned?'PLANIFICADO':done?'COMPLETO':'PARCIAL';
  const bg=planned?C.purplePale:done?C.greenPale:C.amberPale;
  const fg=planned?'#69489F':done?C.green:C.amber;
  rounded(x,y,92,19,9,bg);txt(label,x+9,y+6,8,true,fg)
 }
 function summary(){
  const h=110;room(h+12);const top=cy;rounded(L,top-h,W,h,11,C.bg,C.line);
  txt('PERÍODO',L+15,top-21,8,true,C.muted);txt(`${input.scope==='day'?'DÍA':'SEMANA'}  ${val(input.week)}`,L+15,top-40,15,true,C.ink);
  txt('PERFIL',L+150,top-21,8,true,C.muted);txt(fit(input.person||'Mi entrenamiento personal',W-190,11,true),L+150,top-40,11,true,C.slate);
  txt('Generado: '+dt(input.created),L+15,top-56,8,false,C.muted);
  const labels=[['EJERCICIOS PLAN.',exerciseCount],['SERIES HECHAS',setCount],['VOLUMEN REGISTRADO',fmtNum(volume)+' kg']];
  const sx=L+15, cardW=(W-40)/3;
  labels.forEach(([lab,n],i)=>{const x=sx+i*(cardW+5);rounded(x,top-101,cardW,38,7,C.white,C.line);txt(lab,x+9,top-76,7,true,C.muted);txt(String(n),x+9,top-94,12,true,i===2?C.green:C.ink)});
  cy-=h+15;
 }
 function dayHeader(d){room(105);const h=39,top=cy;rounded(L,top-h,W,h,8,C.slate);
  txt(fit(d.name||'Día '+(d.number||daySeq),W-145,12,true),L+14,top-25,12,true,C.white);
  const qty=d.items.length+' ejercicio'+(d.items.length===1?'':'s');txt(qty,R-19-widthOf(qty,8),top-24,8,false,'#E8E3EE');cy-=h+11;
 }
 function planned(e){
  if(!Array.isArray(e.plan?.sets)||!e.plan.sets.length)return ['Sin objetivo planificado'];
  const v=e.plan.sets.map((s,i)=>`S${i+1} ${val(s.reps)} reps / ${val(s.kg)} kg`).join('   |   ');
  const eff=e.plan.rir===null||e.plan.rir===undefined?'':`   |   RIR ${val(e.plan.rir)} / RPE ${effortText(e.plan.rir)}`;
  return wrap(v+eff,W-38,8.8);
 }
 const ROW_H=23;
 function card(e,part,rows,opts={}){
  const first=opts.first, final=opts.final;
  const name=(e.name||'Ejercicio')+(first?'':' (continuación)');
  const goalLines=first?planned(e):[];
  const notesLines=final&&e.notes?.trim()?wrap(e.notes,W-61,8.8):[];
  const videoLines=final&&e.videoUrl?wrap(e.videoUrl,W-110,8.1):[];
  const topH=(first?82+goalLines.length*12:49);
  const footH=(notesLines.length?32+notesLines.length*12:0)+(videoLines.length?25+videoLines.length*11:0);
  const h=topH+25+Math.max(1,rows.length)*ROW_H+footH+13;
  room(h+10);const top=cy,bottom=top-h;
  rounded(L,bottom,W,h,9,C.white,C.line);rounded(L+1,bottom+2,4,h-4,2,C.purple);
  txt(fit(name,W-137,11.5,true),L+15,top-23,11.5,true,C.ink);
  badge(e,L+W-107,top-31);
  if(first){
   txt(e.updated?'Registro: '+dt(e.updated):'Aún sin entrenamiento guardado',L+15,top-39,7.7,false,C.muted);
   txt('OBJETIVO PLANIFICADO',L+15,top-55,7.7,true,C.muted);
   lines(goalLines,L+15,top-70,8.8,C.slate,12);
  }else txt('Series realizadas (continuación)',L+15,top-41,8,false,C.muted);
  const headY=top-topH;
  rectangle(L+13,headY-23,W-26,23,C.purplePale);
  const cols=[L+25,L+130,L+246,L+360,L+437];
  [['SERIE',0],['PESO',1],['REPS',2],['RIR',3],['RPE',4]].forEach(([label,i])=>txt(label,cols[i],headY-15,8,true,C.slate));
  if(!rows.length){
   rectangle(L+13,headY-23-ROW_H,W-26,ROW_H,C.bg);
   txt('SIN REGISTRO REALIZADO - solo objetivo planificado',L+25,headY-23-ROW_H+7,8.3,false,C.muted);
  }
  rows.forEach((s,i)=>{
   const y=headY-23-(i+1)*ROW_H;
   if(i%2===0)rectangle(L+13,y,W-26,ROW_H,C.bg);
   const idx=(opts.start||0)+i+1;
   const cells=[String(idx),`${val(s.kg)} kg`,String(val(s.reps)),val(s.rir),effortText(s.rir)];
   cells.forEach((v,k)=>txt(fit(v,k===1?99:75,9,k===0),cols[k],y+7,9,k===0,k===0?C.purple:C.ink));
  });
  let tail=headY-23-Math.max(1,rows.length)*ROW_H-11;
  if(notesLines.length){
   txt('COMENTARIOS',L+15,tail,8,true,C.muted);tail-=16;
   const noteH=notesLines.length*12+10;rounded(L+14,tail-noteH+7,W-28,noteH,6,C.soft);
   lines(notesLines,L+23,tail-3,8.8,C.slate,12);tail-=noteH+8;
  }
  if(videoLines.length){txt('VIDEO:',L+15,tail,8,true,C.purple);lines(videoLines,L+62,tail,8.1,C.slate,11)}
  cy-=h+11;
 }
 function noteCard(title,part,kind='COMENTARIOS'){
  const linesText=part;const h=39+linesText.length*12;room(h+9);const top=cy;
  rounded(L,top-h,W,h,8,C.bg,C.line);txt(fit(kind+' - '+title,W-32,9,true),L+14,top-20,9,true,C.purple);lines(linesText,L+14,top-36,8.8,C.slate,12);cy-=h+9;
 }
 function renderExercise(e){
  const all=e.updated&&Array.isArray(e.sets)?e.sets:[];
  const name=e.name||'Ejercicio';let idx=0;
  // Si un ejercicio completo entra en una página, no lo partimos entre hojas.
  const goalAll=planned(e);
  const allNotes=e.notes?.trim()?wrap(e.notes,W-61,8.8):[];
  const allVideo=e.videoUrl?wrap(e.videoUrl,W-110,8.1):[];
  const fullHeight=82+goalAll.length*12+25+Math.max(1,all.length)*ROW_H+13
   +(allNotes.length?32+allNotes.length*12:0)+(allVideo.length?25+allVideo.length*11:0);
  if(all.length<=10 && fullHeight+10<=PH-125-BOTTOM && cy-fullHeight-10<BOTTOM)page();
  if(!all.length){card(e,0,[],{first:true,final:true,start:0});return;}
  while(idx<all.length){
   const first=idx===0;const goal=first?planned(e):[];
   const base=(first?82+goal.length*12:49)+25+13+10;
   if(cy-base-ROW_H<BOTTOM)page();
   const free=cy-BOTTOM-base;
   const n=Math.max(1,Math.min(10,Math.floor(free/ROW_H),all.length-idx));
   const last=idx+n>=all.length;
   // Solo agregamos notas y vídeo si caben en esta tarjeta.
   const notesLines=last&&e.notes?.trim()?wrap(e.notes,W-61,8.8):[];
   const videoLines=last&&e.videoUrl?wrap(e.videoUrl,W-110,8.1):[];
   const extra=(notesLines.length?32+notesLines.length*12:0)+(videoLines.length?25+videoLines.length*11:0);
   const canInclude=last&&(cy-base-n*ROW_H-extra>=BOTTOM);
   card(e,0,all.slice(idx,idx+n),{first,final:canInclude,start:idx});
   idx+=n;
   if(last&&!canInclude){
    if(notesLines.length){for(let p=0;p<notesLines.length;p+=35)noteCard(name,notesLines.slice(p,p+35))}
    if(videoLines.length)noteCard(name,videoLines,'VIDEO');
   }
  }
 }
 page();summary();
 for(const d of days){daySeq++;dayHeader(d);for(const e of d.items)renderExercise(e)}
 room(45);rounded(L,cy-36,W,36,8,C.purplePale);txt('Incluye objetivos aun sin completar la semana.',L+12,cy-16,8.6,true,C.slate);
 txt('Solo refleja lo realizado si ese registro fue guardado.',L+12,cy-29,8,C.muted);
 const objs=[null];const add=x=>{objs.push(x);return objs.length-1};
 const catalog=add(''),pagesRoot=add('');
 const f1=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
 const f2=add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
 const refs=[];
 pages.forEach((cmd,i)=>{
  const footer=cmd;
  const pct=`Página ${i+1} / ${pages.length}`;
  footer.push(rgb(C.muted)+' rg');footer.push(`BT /F1 8 Tf 1 0 0 1 ${L} 27 Tm (Obsidiana  -  Informe privado) Tj ET`);
  footer.push(`BT /F1 8 Tf 1 0 0 1 ${(R-widthOf(pct,8)).toFixed(2)} 27 Tm (${esc(pct)}) Tj ET`);
  const raw=footer.join('\n')+'\n';
  const st=add(`<< /Length ${raw.length} >>\nstream\n${raw}endstream`);
  const pg=add(`<< /Type /Page /Parent ${pagesRoot} 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${st} 0 R >>`);
  refs.push(`${pg} 0 R`);
 });
 objs[pagesRoot]=`<< /Type /Pages /Kids [${refs.join(' ')}] /Count ${refs.length} >>`;
 objs[catalog]=`<< /Type /Catalog /Pages ${pagesRoot} 0 R >>`;
 let pdf='%PDF-1.4\n%\xE2\xE3\xCF\xD3\n',off=[0];
 for(let i=1;i<objs.length;i++){off.push(pdf.length);pdf+=`${i} 0 obj\n${objs[i]}\nendobj\n`}
 const xref=pdf.length;pdf+=`xref\n0 ${objs.length}\n0000000000 65535 f \n`;
 for(let i=1;i<off.length;i++)pdf+=String(off[i]).padStart(10,'0')+' 00000 n \n';
 pdf+=`trailer\n<< /Size ${objs.length} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
 return Uint8Array.from(pdf,x=>x.charCodeAt(0)&255);
}
function toBase64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.slice(i,i+8192));return btoa(s)}
async function sharePDF(bytes,name){
 if(root.Capacitor?.isNativePlatform?.()){
  if(typeof root.obsidianaNativePdf!=='function')throw new Error('Falta el módulo PDF nativo. Sincronizá Capacitor y compilá la APK.');
  await root.obsidianaNativePdf(name,toBase64(bytes));return;
 }
 const blob=new Blob([bytes],{type:'application/pdf'}),file=new File([blob],name,{type:'application/pdf'});
 if(navigator.share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:'Informe Obsidiana'});return}
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{a.remove();URL.revokeObjectURL(url)},30000);
}
function setup(){
 const button=document.getElementById('pdfExport');if(!button)return;
 button.addEventListener('click',()=>{
  if(typeof root.obsidianaCloseMenu==='function')root.obsidianaCloseMenu();
  if(typeof guardDirty==='function'&&!guardDirty())return;
  const title=document.getElementById('modalTitle'),body=document.getElementById('modalBody'),overlay=document.getElementById('overlay');
  title.textContent='Exportar informe en PDF';
  body.innerHTML='<p>Exportá objetivos y resultados por día o semana, incluso si todavía no completaste el entrenamiento.</p><div class="pdf-export-dialog"><button type="button" class="button primary" id="obsPdfDay">Día actual</button><button type="button" class="button" id="obsPdfWeek">Semana completa</button></div><p id="obsPdfStatus" class="sub" role="status">Incluye todos los objetivos. Los resultados solo aparecen si ya fueron guardados.</p>';
  overlay.classList.add('open');
  for(const [id,scope] of [['obsPdfDay','day'],['obsPdfWeek','week']]){
   document.getElementById(id).onclick=async()=>{
    const status=document.getElementById('obsPdfStatus'),choice=document.getElementById(id);choice.disabled=true;status.textContent='Preparando el informe...';
    try{
     const w=week(),days=scope==='day'?[day()]:w.days;
     const pdf=buildReport({created:new Date().toISOString(),week:currentWeek,scope,person:typeof activeWorkspace==='function'&&activeWorkspace()?'Alumno: '+activeWorkspace():'Mi entrenamiento personal',effort:effortScale(),days});
     const name=`Obsidiana-Semana${currentWeek}-${scope==='day'?'Dia'+currentDay:'Completa'}.pdf`;
     await sharePDF(pdf,name);status.textContent='Informe creado. Comprobá que se haya guardado o compartido.';
    }catch(e){if(e?.name==='AbortError'){status.textContent='Se canceló la exportación.'}else{status.textContent='No se pudo exportar: '+(e.message||e);console.error(e)}}finally{choice.disabled=false}
   };
  }
 });
}
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup()}
root.ObsidianaPDF={buildReport};if(typeof module!=='undefined'&&module.exports)module.exports={buildReport};
})(typeof globalThis!=='undefined'?globalThis:this);
