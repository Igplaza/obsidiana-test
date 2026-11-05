/* Obsidiana Conectada — vinculación de prueba; no sincroniza entrenamientos. */
(function(){
const $=id=>document.getElementById(id);
const client=()=>window.obsidianaSupabase;
async function user(){
 const sb=client();if(!sb)throw Error('La conexión aún está iniciándose. Reintentá en unos segundos.');
 const {data,error}=await sb.auth.getUser();if(error)throw error;
 if(!data?.user)throw Error('Primero iniciá sesión con Google en Obsidiana.');
 return data.user;
}
function htmlEscape(s){return String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function show(title,body){
 const titleEl=$('modalTitle'),bodyEl=$('modalBody');
 titleEl.textContent=title;bodyEl.innerHTML=body;$('overlay').classList.add('open');
}
async function createInvite(){
 try{
  const me=await user();
  const {data,error}=await client().from('coach_students').insert({coach_id:me.id}).select('invitation_code,created_at').single();
  if(error)throw error;
  const code=data.invitation_code;
  show('Invitar alumno',`<p>Compartí este código con tu alumno. Vence en 7 días.</p><p class="link-code">${htmlEscape(code)}</p><button type="button" class="button primary" id="obsCopyInvite">Copiar código</button><p class="sub">El alumno debe abrir «Vincular entrenador» desde su Obsidiana e ingresar el código. Por ahora no se envían entrenamientos automáticamente.</p>`);
  $('obsCopyInvite').onclick=async()=>{try{await navigator.clipboard.writeText(code);alert('Código copiado')}catch{prompt('Copiá el código:',code)}};
 }catch(err){alert('Invitación: '+(err.message||err))}
}
async function linkStudent(){
 try{
  await user();
  show('Vincular entrenador',`<p>Ingresá el código que te dio tu entrenador.</p><label>Código de invitación<input id="obsInvitationInput" maxlength="20" autocomplete="off" autocapitalize="characters" placeholder="Ej.: A1B2C3D4E5"></label><div class="actions"><button type="button" class="button primary" id="obsAcceptInvite">Aceptar invitación</button></div><p id="obsLinkFeedback" class="sub"></p>`);
  $('obsAcceptInvite').onclick=async()=>{
   const btn=$('obsAcceptInvite'),status=$('obsLinkFeedback'),code=$('obsInvitationInput').value.trim().toUpperCase();
   if(!/^[A-F0-9]{10}$/.test(code)){status.textContent='Ingresá el código de 10 caracteres.';return}
   btn.disabled=true;status.textContent='Vinculando…';
   try{const {error}=await client().rpc('accept_coach_invitation',{p_code:code});if(error)throw error;status.textContent='✓ Vinculación realizada correctamente';btn.hidden=true}
   catch(err){status.textContent='No se pudo vincular: '+(err.message||err)}finally{btn.disabled=false}
  };
 }catch(err){alert(err.message||err)}
}
async function showLinks(){
 try{
  const me=await user();
  const {data,error}=await client().from('coach_students').select('invitation_code,status,created_at,accepted_at,student_id').eq('coach_id',me.id).order('created_at',{ascending:false}).limit(50);
  if(error)throw error;
  const list=data.map(x=>`<div class="obs-link-row"><b>${x.status==='accepted'?'✓ Alumno vinculado':'Pendiente'}</b><small>${x.status==='pending'?htmlEscape(x.invitation_code):'Cuenta vinculada'} · ${new Date(x.created_at).toLocaleDateString('es-AR')}</small></div>`).join('');
  show('Vinculaciones',`<p>Invitaciones de esta cuenta. Todavía no se comparten rutinas automáticamente.</p>${list||'<p>No hay invitaciones.</p>'}<button class="button primary" id="obsNewInvite">+ Nueva invitación</button>`);
  $('obsNewInvite').onclick=createInvite;
 }catch(err){alert('Vinculaciones: '+(err.message||err))}
}
window.obsidianaLinking={createInvite,showLinks};
$('studentLink')?.addEventListener('click',linkStudent);
})();
