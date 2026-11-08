/* Obsidiana - Navegación unificada para web y PWA iPhone.
   Mantiene los mismos elementos, IDs y handlers: solo los reubica. */
(function () {
  'use strict';

  const toolbar = document.querySelector('.toolbar');
  const daytools = document.querySelector('.daytools');
  const week = document.getElementById('week');
  if (!toolbar || !daytools || !week || document.querySelector('.mobile-compact-primary')) return;

  const primary = document.createElement('div');
  primary.className = 'mobile-compact-primary';
  const weekLabel = document.createElement('label');
  weekLabel.className = 'mobile-week-select';
  const weekCaption = document.createElement('span');
  weekCaption.textContent = 'SEMANA';
  weekLabel.append(weekCaption, week);
  primary.append(weekLabel);

  const menu = document.createElement('details');
  menu.className = 'mobile-compact-menu';
  const summary = document.createElement('summary');
  summary.setAttribute('aria-label', 'Abrir opciones de Obsidiana');
  summary.innerHTML = '<span aria-hidden="true">☰</span> <span>Menú</span>';
  const panel = document.createElement('div');
  panel.className = 'mobile-compact-panel';
  panel.setAttribute('aria-label', 'Herramientas de Obsidiana');
  menu.append(summary, panel);
  primary.append(menu);
  toolbar.prepend(primary);

  const groups = [
    ['Planificación', ['autoWeek', 'addWeek', 'deloadWeek']],
    ['Compartir y alumnos', ['shareToggle', 'coachPanel', 'studentLink']],
    ['Historial y respaldo', ['evolution', 'pdfExport', 'export', 'import']],
    ['Organizar días', ['addDay', 'renameDay', 'moveDayUp', 'moveDayDown', 'deleteMenuToggle']]
  ];
  for (const [title, ids] of groups) {
    const group = document.createElement('section');
    group.className = 'mobile-compact-group';
    const caption = document.createElement('b');
    caption.textContent = title;
    group.append(caption);
    for (const id of ids) {
      const button = document.getElementById(id);
      if (!button) continue;
      const element = (id === 'shareToggle' || id === 'deleteMenuToggle') ? button.parentElement : button;
      if (element) group.append(element);
    }
    panel.append(group);
  }
  // Permite importar JSON sin alterar el evento onchange existente.
  const importFile = document.getElementById('importFile');
  if (importFile) panel.append(importFile);
  daytools.classList.add('mobile-daytools-hidden');
  toolbar.classList.add('obs-nav-ready');

  function closeMenu() {
    if (!menu.open) return;
    menu.open = false;
    for (const [toggleId, optionsId] of [['shareToggle', 'shareChoices'], ['deleteMenuToggle', 'deleteOptions']]) {
      const toggle = document.getElementById(toggleId);
      const options = document.getElementById(optionsId);
      if (options) options.classList.add('hidden');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
  }
  window.obsidianaCloseMenu = closeMenu;

  // Acciones de submenú (Enviar, Eliminar) muestran primero sus opciones.
  // Todas las otras acciones cierran Menú, incluso las agregadas por Supabase.
  menu.addEventListener('click', function (event) {
    const button = event.target.closest('button');
    if (!button || !panel.contains(button)) return;
    if (button.id === 'shareToggle' || button.id === 'deleteMenuToggle') return;
    closeMenu();
  });
  document.addEventListener('pointerdown', function (event) {
    if (menu.open && !menu.contains(event.target)) closeMenu();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') closeMenu();
  });
  // Si se abre una ventana modal desde cualquier función, nunca queda el menú por encima.
  const overlay = document.getElementById('overlay');
  if (overlay && window.MutationObserver) {
    new MutationObserver(function () {
      if (overlay.classList.contains('open')) closeMenu();
    }).observe(overlay, {attributes: true, attributeFilter: ['class']});
  }
})();
