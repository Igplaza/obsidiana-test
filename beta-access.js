/* OBSIDIANA - Beta cerrada. Solo acceso normal autorizado por Supabase.
   La autorización real de datos compartidos está en las políticas RLS/RPC.
   Una aplicación web distribuida públicamente no puede ofrecer DRM infalible. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const screen = $('obsBetaGate');
  if (!screen) return;
  const status = $('obsBetaStatus');
  const note = $('obsBetaNote');
  const login = $('obsBetaLogin');
  const retry = $('obsBetaRetry');
  const logout = $('obsBetaLogout');
  let requestId = 0;
  let api = null;
  let currentUserId = null;
  let checking = false;
  let lastVerification = 0;

  function lock(message, detail, actions = {}) {
    screen.hidden = false;
    document.body.classList.add('obs-beta-locked');
    status.textContent = message;
    note.textContent = detail;
    login.hidden = !actions.login;
    retry.hidden = !actions.retry;
    logout.hidden = !actions.logout;
  }
  function unlock() {
    screen.hidden = true;
    document.body.classList.remove('obs-beta-locked');
    lastVerification = Date.now();
  }
  async function verify() {
    if (checking) { requestId++; return; }
    checking = true;
    const own = ++requestId;
    lock('Verificando tu acceso…', 'Comprobando la autorización de la beta privada.');
    try {
      api = window.obsidianaSupabase;
      if (!api) throw new Error('La conexión con Google todavía no está disponible.');
      // Sin sesión: mostrar Google. Con sesión: verificar la identidad en servidor.
      const { data: storedSession, error: sessionError } = await api.auth.getSession();
      if (own !== requestId) return;
      if (sessionError) throw sessionError;
      if (!storedSession?.session) {
        currentUserId = null;
        lock('Obsidiana · Beta privada', 'Iniciá sesión con Google para continuar. Solo pueden entrar las cuentas habilitadas para las pruebas.', {login:true, retry:true});
        return;
      }
      const { data: identity, error: identityError } = await api.auth.getUser();
      if (own !== requestId) return;
      if (identityError) throw identityError;
      const user = identity?.user;
      if (!user) {
        currentUserId = null;
        lock('Obsidiana · Beta privada', 'Iniciá sesión con Google para continuar. Solo pueden entrar las cuentas habilitadas para las pruebas.', {login:true, retry:true});
        return;
      }
      currentUserId = user.id;
      const { data, error } = await api.from('beta_access')
        .select('enabled')
        .eq('user_id', user.id)
        .maybeSingle();
      if (own !== requestId) return;
      if (error) throw error;
      if (data?.enabled === true) {
        unlock();
      } else {
        lock('Cuenta pendiente de autorización', 'Iniciaste sesión correctamente, pero esta cuenta todavía no está habilitada para la beta. Avisale al administrador para que la autorice en Supabase.', {retry:true, logout:true});
      }
    } catch (error) {
      if (own !== requestId) return;
      lock('No se pudo comprobar el acceso', 'Conectate a internet y tocá «Reintentar». Los entrenamientos guardados en este dispositivo no se borraron. Detalle: '+(error?.message || String(error)), {retry:true, logout:!!currentUserId});
    } finally {
      checking = false;
      if (own !== requestId) setTimeout(verify, 0);
    }
  }

  login.addEventListener('click', () => {
    const button = $('authButton');
    if (!button) { lock('Inicio de sesión no disponible','Reabrí la aplicación e intentá nuevamente.', {retry:true}); return; }
    button.click();
  });
  retry.addEventListener('click', () => void verify());
  logout.addEventListener('click', async () => {
    try {
      if (!api) api = window.obsidianaSupabase;
      const { error } = await api.auth.signOut();
      if (error) throw error;
      currentUserId = null;
      lock('Obsidiana · Beta privada', 'Iniciá sesión con una cuenta autorizada.', {login:true, retry:true});
    } catch(err) { lock('No se pudo cerrar la sesión', String(err.message || err), {retry:true, logout:true}); }
  });

  function begin() {
    api = window.obsidianaSupabase;
    if (!api) {
      lock('Preparando Obsidiana…','Esperando la conexión con Google.', {retry:true});
      setTimeout(begin, 200);
      return;
    }
    // Retrasar la consulta fuera de los callbacks de auth para no bloquear el cliente.
    api.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED')
        setTimeout(() => void verify(), 0);
    });
    void verify();
  }
  lock('Obsidiana · Beta privada','Comprobando tu cuenta…');
  begin();
  setInterval(() => {
    if (document.visibilityState === 'visible' && Date.now() - lastVerification > 4 * 60 * 1000) void verify();
  }, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - lastVerification > 5 * 60 * 1000) void verify();
  });
})();
