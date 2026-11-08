/* Obsidiana Conectada — intercambios por cuenta vinculada. Datos locales independientes. */
(()=>{'use strict';
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function sb(){if(!window.obsidianaSupabase)throw Error('Esperá a que se inicie la conexión con Google.');return window.obsidianaSupabase;}
async function current(){const {data,error}=await sb().auth.getUser();if(error)throw error;if(!data?.user)throw Error('Iniciá sesión con Google primero.');return data.user;}
async function links(){
 const me=await current();
 const {data,error}=await sb().from('coach_students').select('id,coach_id,student_id,status,created_at').eq('status','accepted').or(`coach_id.eq.${me.id},student_id.eq.${me.id}`).order('created_at',{ascending:false});
 if(error)throw error;
 let people=[];
 try{const reply=await sb().rpc('obsidiana_linked_accounts');if(!reply.error)people=reply.data||[];
 else console.warn('Obsidiana: falta función de nombres en Supabase',reply.error.message);
 }catch(err){console.warn('Sin nombres de Supabase:',err)}
 const byLink=new Map(people.map(p=>[p.link_id,p]));
 const list=(data||[]).map(x=>({...x,linkedDisplay:byLink.get(x.id)?.display_name||''}));
 return {me,list};
}
function localLabel(me,x,index){
 const student=x.coach_id===me.id && Array.isArray(model?.coachStudents)
   ? model.coachStudents.find(s=>s.onlineLinkId===x.id) : null;
 if(student?.name)return student.name;
 const alias=model?.linkedAliases?.[me.id+':'+x.id];
 const label=String(alias||x.linkedDisplay||'').trim();
 if(label && label!=='Cuenta vinculada')return label;
 return (x.coach_id===me.id?'Alumno':'Entrenador')+' '+(index+1)+' (asigná un nombre)';
}

function popup(title,markup){$('modalTitle').textContent=title;$('modalBody').innerHTML=markup;$('overlay').classList.add('open');}
async function send(){try{
 if(typeof window.obsidianaReady?.then==='function')await window.obsidianaReady;
 const {me,list:all}=await links();
 let list=all;
 const active=typeof activeWorkspace==='function'?activeWorkspace():'';
 if(active){
  const student=(model.coachStudents||[]).find(s=>s.name===active);
  list=all.filter(x=>x.coach_id===me.id && student?.onlineLinkId===x.id);
  if(!list.length){popup('Compartir con cuenta','<p>«'+escape(active)+'» todavía no tiene una cuenta vinculada asociada a su ficha. Entrá en «Mis alumnos» y generá la invitación desde su perfil o asigná la vinculación existente.</p>');return;}
 }else{
  list=all.filter(x=>x.student_id===me.id);
  if(!list.length){popup('Compartir con cuenta',all.some(x=>x.coach_id===me.id)?'<p>Para enviar una planificación, primero abrí la rutina del alumno desde «Mis alumnos». Así Obsidiana elige la cuenta correcta automáticamente.</p>':'<p>No hay cuentas vinculadas activas. Las invitaciones se generan desde la ficha de cada alumno.</p>');return;}
 }
 const options=list.map((x,i)=>`<option value="${i}">${escape(localLabel(me,x,i))}</option>`).join('');
 popup('Compartir con cuenta vinculada',`<p>El envío llegará a la bandeja de la otra persona, sin enlaces.</p>${active?`<p class="sub">Ficha activa: <strong>${escape(active)}</strong> · destinatario vinculado automáticamente.</p>`:``}<label>Cuenta vinculada<select id="obsRecipient">${options}</select></label><div class="obs-account-actions"><button type="button" class="button small" id="obsRenameRecipient">✎ Cambiar nombre</button><button type="button" class="button small danger" id="obsUnlinkRecipient">Desvincular cuenta</button></div><p class="muted" style="font-size:11px">El nombre es solo una etiqueta para reconocer tus cuentas vinculadas. No cambia la cuenta ni la vinculación.</p><label>Qué enviar<select id="obsSendScope"><option value="day">Entrenamiento actual</option><option value="week">Semana actual</option></select></label><p class="muted">Solo se envía la planificación o el resultado que confirmes. No se sincroniza tu historial personal.</p><button type="button" class="button primary" id="obsConfirmRemote">Enviar ahora</button><p id="obsRemoteFeedback" class="muted" role="status"></p>`);
 $('obsRenameRecipient').onclick=async()=>{
 const select=$('obsRecipient');const i=Number(select.value),x=list[i];if(!x)return;
 const current=localLabel(me,x,i);
 const value=prompt('Nombre para identificar esta cuenta vinculada:',current);
 if(value===null)return;
 const name=value.trim();if(!name||name.length>80){alert('Ingresá un nombre de hasta 80 caracteres.');return;}
 model.linkedAliases??={};model.linkedAliases[me.id+':'+x.id]=name;
 try{await persist();select.options[i].textContent=name;}catch(err){alert('No se pudo guardar el nombre: '+err.message)}
};
$('obsUnlinkRecipient').onclick=async()=>{
 const idx=Number($('obsRecipient').value),x=list[idx];if(!x)return;
 const name=localLabel(me,x,idx);
 if(!confirm('¿Desvincular a «'+name+'»?\n\nDejará de aparecer como destinatario para compartir rutinas y resultados. Sus registros guardados en los dispositivos no se borran. Para volver a conectarse necesitarán otra invitación.'))return;
 const button=$('obsUnlinkRecipient');button.disabled=true;
 try{const {data,error}=await sb().rpc('obsidiana_unlink_account',{p_link_id:x.id});if(error)throw error;
   if(data!==true)throw Error('No se pudo confirmar la desvinculación.');
   if(model?.linkedAliases){delete model.linkedAliases[me.id+':'+x.id];await persist();}
   await send();
 }catch(e){alert('No se pudo desvincular: '+(e.message||e));button.disabled=false;}
};
$('obsConfirmRemote').onclick=async()=>{const button=$('obsConfirmRemote'),msg=$('obsRemoteFeedback');button.disabled=true;msg.textContent='Enviando…';try{
  if(typeof guardDirty==='function'&&!guardDirty())throw Error('Primero guardá los cambios pendientes.');
  const x=list[Number($('obsRecipient').value)],scope=$('obsSendScope').value;
  const coach=me.id===x.coach_id,kind=coach?'plan':'results';
  if(coach&&!activeWorkspace())throw Error('Primero abrí la rutina del alumno desde «Mis alumnos».');
  if(!coach&&activeWorkspace())throw Error('Volvé a tu entrenamiento personal para enviar resultados.');
  const displayName=coach?activeWorkspace():String(model.shareStudent||me.email?.split('@')[0]||'Alumno').slice(0,80);
  const payload={app:'obsidiana',v:1,type:kind,scope,student:displayName,week:currentWeek,from:me.id,created:new Date().toISOString(),days:shareDays(scope,kind),id:uid()};
  shareValid(payload);
  const {error}=await sb().from('training_exchanges').insert({link_id:x.id,sender_id:me.id,recipient_id:coach?x.student_id:x.coach_id,kind,scope,payload});if(error)throw error;
  msg.textContent='✓ Enviado. La otra persona lo verá en «Recibidos».';button.hidden=true;
 }catch(e){msg.textContent='No se pudo enviar: '+(e.message||e);button.disabled=false;}};
 }catch(e){alert('Compartir: '+(e.message||e));}}
async function inbox(){try{
 if(typeof window.obsidianaReady?.then==='function')await window.obsidianaReady;
 const me=await current();const {data,error}=await sb().from('training_exchanges').select('id,kind,scope,payload,created_at').eq('recipient_id',me.id).order('created_at',{ascending:false}).limit(60);if(error)throw error;
 const rows=(data||[]).map((e,i)=>`<div class="obs-inbox-row"><div><strong>${e.kind==='plan'?'Planificación':'Resultados'} · ${e.scope==='day'?'Entrenamiento':'Semana'} ${escape(e.payload?.week)}</strong><small>${escape(e.payload?.student)} · ${new Date(e.created_at).toLocaleString('es-AR')}</small></div><button class="button small primary" data-obs-import="${i}">Ver e importar</button></div>`).join('');
 popup('Recibidos',`<p>Revisá y confirmá cada importación. La aplicación no sobrescribe nada automáticamente.</p>${rows||'<p>Aún no recibiste entrenamientos.</p>'}<button id="obsRefreshInbox" class="button small">Actualizar</button>`);
 $('obsRefreshInbox').onclick=inbox;
 $('modalBody').querySelectorAll('[data-obs-import]').forEach(button=>button.addEventListener('click',()=>{const item=data[Number(button.dataset.obsImport)];try{shareValid(item.payload);previewIncoming(item.payload)}catch(e){alert('Envío inválido: '+e.message)}}));
 }catch(e){alert('Recibidos: '+(e.message||e));}}
function setup(){
 const toolbar=document.querySelector('.toolbar');if(!toolbar||$('obsOnlineSend'))return;
 const sendBtn=document.createElement('button');sendBtn.id='obsOnlineSend';sendBtn.type='button';sendBtn.className='button small';sendBtn.textContent='⇧ Compartir con cuenta';sendBtn.onclick=send;
 const inboxBtn=document.createElement('button');inboxBtn.id='obsOnlineInbox';inboxBtn.type='button';inboxBtn.className='button small';inboxBtn.textContent='⇩ Recibidos';inboxBtn.onclick=inbox;
 const mobilePanel=document.querySelector('.mobile-compact-panel');
 if(mobilePanel){
   let group=mobilePanel.querySelector('.obs-connected-group');
   if(!group){group=document.createElement('section');group.className='mobile-compact-group obs-connected-group';const heading=document.createElement('b');heading.textContent='Obsidiana Conectada';group.append(heading);mobilePanel.append(group);}
   group.append(sendBtn,inboxBtn);
 }else toolbar.append(sendBtn,inboxBtn);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
window.obsidianaConnected={send,inbox,links,localLabel};
})();
