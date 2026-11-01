/* Interfaz móvil compacta: conserva los mismos nodos/IDs y listeners. */
(function(){
  if (!window.matchMedia('(max-width:760px)').matches) return;
  const toolbar=document.querySelector('.toolbar');
  const daytools=document.querySelector('.daytools');
  if(!toolbar||!daytools) return;
  const week=document.getElementById('week');
  const addExercise=document.getElementById('addExercise');
  const primary=document.createElement('div');
  primary.className='mobile-compact-primary';
  toolbar.prepend(primary);
  const selectLabel=document.createElement('label');
  selectLabel.className='mobile-week-select';
  selectLabel.innerHTML='<span>SEMANA</span>';
  selectLabel.append(week);
  primary.append(selectLabel);

  const details=document.createElement('details');
  details.className='mobile-compact-menu';
  details.innerHTML='<summary aria-label="Abrir herramientas">☰ <span>Menú</span></summary><div class="mobile-compact-panel"></div>';
  primary.append(details);
  const panel=details.querySelector('.mobile-compact-panel');
  const groups=[
    ['Planificación',['autoWeek','addWeek','deloadWeek']],
    ['Compartir y alumnos',['shareToggle','coachPanel']],
    ['Seguimiento y datos',['evolution','export','import']],
    ['Organizar días',['addDay','renameDay','moveDayUp','moveDayDown','deleteMenuToggle']]
  ];
  groups.forEach(([title,ids])=>{
    const group=document.createElement('section');
    group.className='mobile-compact-group';
    const heading=document.createElement('b');heading.textContent=title;group.append(heading);
    ids.forEach(id=>{
      const el=document.getElementById(id);
      if(!el) return;
      const parent=(id==='shareToggle'||id==='deleteMenuToggle')?el.parentElement:el;
      if(parent) group.append(parent);
    });
    panel.append(group);
  });
  const file=document.getElementById('importFile');if(file)panel.append(file);
  // Conservamos el elemento «daytools» sin sus controles para ahorrar espacio.
  daytools.classList.add('mobile-daytools-hidden');
  // Los eventos existentes se conservan al trasladar los elementos.
  document.addEventListener('click',e=>{
    if(!details.open||details.contains(e.target))return;
    details.open=false;
  });
})();
