/* Obsidiana Conectada · invitaciones vinculadas a fichas de alumnos.
   La asociación entre ficha y vínculo se guarda localmente; Supabase sigue
   siendo la autoridad para el estado pending/accepted/revoked. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const client=()=>window.obsidianaSupabase;
const escape=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const people=()=>typeof coachData==='function'?coachData():[];
let cache=[];
async function user(){
 const sb=client();if(!sb)throw Error('La conexión aún está iniciándose. Reintentá en unos segundos.');
 const {data,error}=await sb.auth.getUser();if(error)throw error;
 if(!data?.user)throw Error('Iniciá sesión con Google para vincular cuentas.');
 return data.user;
}
function show(title,body){$('modalTitle').textContent=title;$('modalBody').innerHTML=body;$('overlay').classList.add('open');window.obsidianaCloseMenu?.();}
function rowDate(d){try{return new Date(d).toLocaleDateString('es-AR')}catch{return ''}}
function expired(x){return x.status==='pending'&&Date.now()-new Date(x.created_at).getTime()>7*24*3600*1000}
async function allCoachLinks(me){
 const {data,error}=await client().from('coach_students')
  .select('id,coach_id,student_id,status,invitation_code,created_at')
  .eq('coach_id',me.id).in('status',['pending','accepted'])
  .order('created_at',{ascending:false}).limit(250);
 if(error)throw error;
 cache=data||[];
 return cache;
}
async function currentState(me,student,rows){
 if(!student?.onlineLinkId)return null;
 return rows.find(x=>x.id===student.onlineLinkId)||null;
}
function studentStatus(student,row){
 if(!row)return 'Sin cuenta vinculada';
 if(row.status==='accepted')return '✓ Cuenta vinculada';
 return expired(row)?'Invitación vencida · cancelala para generar otra':'Invitación pendiente de aceptar';
}
function onlineControls(student,index,row){
 if(row?.status==='accepted')return `<button type="button" class="button small danger" data-coach-unlink="${index}">Desvincular cuenta</button>`;
 if(row?.status==='pending')return `<button type="button" class="button small" data-coach-invite="${index}">Ver código</button><button type="button" class="button small danger" data-coach-cancel-invite="${index}">Cancelar invitación</button>`;
 return `<button type="button" class="button small" data-coach-invite="${index}">+ Invitar a ${escape(student.name)}</button>`;
}
async function refreshStudentCards(){
 try{
  if(typeof window.obsidianaReady?.then==='function')await window.obsidianaReady;
  const me=await user();const rows=await allCoachLinks(me);
  let googleNames=new Map();
  try{const remote=await window.obsidianaConnected?.links?.();googleNames=new Map((remote?.list||[]).map(x=>[x.id,x.linkedDisplay||'']));}catch(_){/* La asociación sigue funcionando aunque el nombre remoto no esté disponible. */}
  let dirty=false;
  for(const [i,student] of people().entries()){
   if(student.onlineLinkId && !rows.some(x=>x.id===student.onlineLinkId)){
    // Es una referencia a una invitación cancelada/revocada, no una cuenta activa.
    student.onlineLinkId=null;student.onlineInviteCode='';dirty=true;
   }
   const row=await currentState(me,student,rows);
   const el=document.querySelector(`[data-obs-student-online="${i}"]`);
   if(!el || !document.getElementById('addCoachStudent'))continue;
   const label=el.querySelector('.obs-connection-status');
   if(label){label.className='obs-connection-status'+(row?.status==='accepted'?' is-linked':row?.status==='pending'?' is-pending':'');const googleName=row?.status==='accepted'?String(googleNames.get(row.id)||'').trim():'';label.textContent=studentStatus(student,row)+(googleName&&googleName!=='Cuenta vinculada'?' · Google: '+googleName:'');}
   const actions=el.querySelector('.obs-connection-actions');if(actions)actions.innerHTML=onlineControls(student,i,row);
  }
  if(dirty)await persist();
 }catch(err){
  document.querySelectorAll('.obs-connection-status').forEach(el=>el.textContent='No se pudo consultar la vinculación: '+(err.message||err));
 }
}
async function inviteForStudent(index){
 try{
  if(typeof window.obsidianaReady?.then==='function')await window.obsidianaReady;
  const student=people()[index];if(!student)throw Error('Seleccioná primero una ficha de alumno.');
  const me=await user();const rows=await allCoachLinks(me);
  const current=await currentState(me,student,rows);
  if(current){
   if(current.status==='accepted'){
    show('Cuenta vinculada · '+student.name,'<p>✓ Esta ficha ya tiene una cuenta vinculada. Podés enviarle una planificación desde «Abrir rutina → Compartir con cuenta».</p><button type="button" class="button" id="obsReturnStudents">← Mis alumnos</button>');
    $('obsReturnStudents').onclick=()=>coachView();return;
   }
   show('Invitación para '+student.name,`<p>${expired(current)?'Esta invitación venció. Cancelala desde la ficha para generar una nueva.':'Compartí este código con '+escape(student.name)+'. La invitación vence a los 7 días.'}</p><div class="obs-invitation-detail"><strong class="link-code">${escape(current.invitation_code)}</strong><button type="button" class="button primary" id="obsCopyInvite">Copiar código</button><button type="button" class="button danger" id="obsCancelHere">Cancelar invitación</button></div><button type="button" class="button" id="obsReturnStudents">← Mis alumnos</button>`);
   $('obsCopyInvite').onclick=()=>copyCode(current.invitation_code);
   $('obsCancelHere').onclick=()=>cancelForStudent(index);
   $('obsReturnStudents').onclick=()=>coachView();return;
  }
  if(!confirm(`¿Generar una invitación online para «${student.name}»?\n\nCuando el alumno acepte, su ficha mostrará «Cuenta vinculada».`))return;
  const {data,error}=await client().from('coach_students').insert({coach_id:me.id}).select('id,invitation_code,created_at,status').single();
  if(error)throw error;
  student.onlineLinkId=data.id;student.onlineInviteCode=data.invitation_code;
  try{await persist()}catch(err){
   await client().rpc('obsidiana_unlink_account',{p_link_id:data.id});
   student.onlineLinkId=null;student.onlineInviteCode='';throw err;
  }
  await inviteForStudent(index);
 }catch(err){alert('Invitación: '+(err.message||err))}
}
async function copyCode(code){try{await navigator.clipboard.writeText(code);alert('Código copiado')}catch{prompt('Copiá el código:',code)}}
async function revoke(linkId,title,studentIndex){
 if(!confirm(`¿${title}?\n\nEl código dejará de funcionar y no se borrarán las rutinas ni los resultados guardados.`))return false;
 const {data,error}=await client().rpc('obsidiana_unlink_account',{p_link_id:linkId});
 if(error)throw error;if(data!==true)throw Error('No se pudo confirmar la operación.');
 for(const st of people())if(st.onlineLinkId===linkId){st.onlineLinkId=null;st.onlineInviteCode='';}
 const me=await user();if(model?.linkedAliases)delete model.linkedAliases[me.id+':'+linkId];
 await persist();return true;
}
async function cancelForStudent(index){try{
 const st=people()[index];if(!st?.onlineLinkId)throw Error('Este alumno no tiene una invitación pendiente.');
 const me=await user(),rows=await allCoachLinks(me),row=await currentState(me,st,rows);
 if(!row){st.onlineLinkId=null;await persist();coachView();return}
 if(row.status!=='pending')throw Error('La invitación ya fue aceptada. Usá «Desvincular cuenta».');
 if(await revoke(row.id,'Cancelar la invitación de «'+st.name+'»',index))coachView();
 }catch(err){alert('Cancelar invitación: '+(err.message||err))}}
async function disconnectForStudent(index){try{
 const st=people()[index];if(!st?.onlineLinkId)throw Error('Esta ficha no tiene una cuenta vinculada.');
 const me=await user(),rows=await allCoachLinks(me),row=await currentState(me,st,rows);
 if(!row){st.onlineLinkId=null;await persist();coachView();return}
 if(row.status!=='accepted')throw Error('La invitación sigue pendiente: usá «Cancelar invitación».');
 if(await revoke(row.id,'Desvincular la cuenta de «'+st.name+'»',index))coachView();
 }catch(err){alert('Desvincular: '+(err.message||err))}}
async function linkStudent(){
 try{
  await user();
  show('Vincular entrenador',`<p>Ingresá el código de invitación que te dio tu entrenador.</p><label>Código <input id="obsInvitationInput" maxlength="20" autocomplete="off" autocapitalize="characters" placeholder="Ej.: A1B2C3D4E5"></label><div class="actions"><button type="button" class="button primary" id="obsAcceptInvite">Aceptar invitación</button></div><p id="obsLinkFeedback" class="sub"></p>`);
  $('obsAcceptInvite').onclick=async()=>{
   const btn=$('obsAcceptInvite'),feedback=$('obsLinkFeedback'),code=$('obsInvitationInput').value.trim().toUpperCase();
   if(!/^[A-F0-9]{10}$/.test(code)){feedback.textContent='El código debe tener 10 caracteres.';return}
   btn.disabled=true;feedback.textContent='Vinculando…';
   try{const {error}=await client().rpc('accept_coach_invitation',{p_code:code});if(error)throw error;feedback.textContent='✓ Vinculación realizada correctamente';btn.hidden=true}
   catch(err){feedback.textContent='No se pudo vincular: '+(err.message||err)}finally{btn.disabled=false}
  };
 }catch(err){alert(err.message||err)}
}
async function assignToStudent(linkId){
 const free=people().map((x,i)=>({x,i})).filter(({x})=>!x.onlineLinkId);
 if(!free.length){alert('No hay fichas sin cuenta vinculada. Creá una ficha de alumno desde «Mis alumnos».');return}
 show('Asignar cuenta a un alumno',`<p>Seleccioná a qué ficha local corresponde esta invitación o cuenta vinculada.</p><label>Alumno<select id="obsAssignStudent">${free.map(({x,i})=>`<option value="${i}">${escape(x.name)}</option>`).join('')}</select></label><button class="button primary" id="obsConfirmAssign">Asignar a ficha</button><p class="sub">Esto no cambia la cuenta de Google: solo la relaciona con la ficha que elegiste en este dispositivo.</p>`);
 $('obsConfirmAssign').onclick=async()=>{
  const idx=Number($('obsAssignStudent').value),student=people()[idx];if(!student||student.onlineLinkId)return;
  if(!confirm(`¿Asociar esta cuenta a «${student.name}»? Verificá que sea la persona correcta.`))return;
  student.onlineLinkId=linkId;const r=cache.find(x=>x.id===linkId);student.onlineInviteCode=r?.invitation_code||'';
  await persist();coachView();
 };
}
async function showLinks(){try{
 const me=await user();const rows=await allCoachLinks(me);
 let full=[];
 try{const result=await window.obsidianaConnected?.links?.();full=result?.list||[]}catch(e){console.warn('No se pudo consultar nombres de cuentas:',e)}
 const byId=new Map(full.map((x,i)=>[x.id,{link:x,index:i}]));
 const html=rows.map(x=>{
  const st=people().find(p=>p.onlineLinkId===x.id),found=byId.get(x.id),pending=x.status==='pending';
  const label=st?.name|| (found?window.obsidianaConnected.localLabel(me,found.link,found.index):'Cuenta vinculada sin ficha');
  return `<div class="obs-link-row obs-link-manage"><div><strong>${escape(label)}</strong> · ${pending?'Invitación pendiente': 'Cuenta vinculada'}<small>${pending?escape(x.invitation_code)+(expired(x)?' · VENCIDA':' · vence a los 7 días'):'Aceptada'} · ${rowDate(x.created_at)}</small></div><div class="obs-link-buttons">${st?'':`<button type="button" class="button small" data-obs-link-assign="${x.id}">Asignar a ficha</button>`}<button type="button" class="button small danger" data-obs-link-revoke="${x.id}">${pending?'Cancelar invitación':'Desvincular'}</button></div></div>`;
 }).join('');
 show('Vinculaciones online',`<p>Las invitaciones nuevas se generan desde la ficha de cada alumno. Si tenés vínculos anteriores sin asignar, podés asociarlos a una ficha.</p>${html||'<p>No hay invitaciones ni cuentas vinculadas.</p>'}<button type="button" class="button" id="obsBackToStudents">← Mis alumnos</button>`);
 $('obsBackToStudents').onclick=()=>coachView();
 $('modalBody').querySelectorAll('[data-obs-link-assign]').forEach(b=>b.onclick=()=>assignToStudent(b.dataset.obsLinkAssign));
 $('modalBody').querySelectorAll('[data-obs-link-revoke]').forEach(b=>b.onclick=async()=>{
  const id=b.dataset.obsLinkRevoke,row=rows.find(x=>x.id===id);if(!row)return;
  b.disabled=true;
  try{if(await revoke(id,(row.status==='pending'?'Cancelar invitación':'Desvincular cuenta')+'',null))await showLinks();else b.disabled=false}
  catch(err){alert('Vinculaciones: '+(err.message||err));b.disabled=false}
 });
 }catch(err){alert('Vinculaciones: '+(err.message||err))}}
window.obsidianaLinking={showLinks,inviteForStudent,cancelForStudent,disconnectForStudent,refreshStudentCards,allCoachLinks};
$('studentLink')?.addEventListener('click',linkStudent);
})();
