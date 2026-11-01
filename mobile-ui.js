/* Presentación compacta para pantallas pequeñas.
   Reubica los mismos botones, conservando IDs y sus eventos. */
(function(){
  if (!window.matchMedia('(max-width:760px)').matches) return;
  const toolbar=document.querySelector('.toolbar');
  const daytools=document.querySelector('.daytools');
  if(!toolbar || !daytools) return;
  const week=document.getElementById('week');
  const progress=document.getElementById('autoWeek');
  const controls=document.createElement('div');
  controls.className='mobile-main-controls';
  toolbar.insertBefore(controls,toolbar.firstChild);
  controls.append(week,progress);

  const details=document.createElement('details');
  details.className='mobile-options';
  details.innerHTML='<summary class="button small">Opciones <span aria-hidden="true">▾</span></summary><div class="mobile-options-content"></div>';
  toolbar.append(details);
  const options=details.querySelector('.mobile-options-content');
  ['addWeek','deloadWeek','shareToggle','coachPanel','evolution','export','import'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el) return;
    options.append(id==='shareToggle'?el.closest('.share-menu'):el);
  });
  const file=document.getElementById('importFile'); if(file) options.append(file);

  const dayRow=daytools.querySelector('.row');
  const dayDetails=document.createElement('details');
  dayDetails.className='mobile-day-options';
  dayDetails.innerHTML='<summary class="button small">Editar días <span aria-hidden="true">▾</span></summary><div class="mobile-day-options-content"></div>';
  if(dayRow){
    dayRow.append(dayDetails);
    const dcontent=dayDetails.querySelector('.mobile-day-options-content');
    ['renameDay','moveDayUp','moveDayDown','deleteMenuToggle'].forEach(id=>{
      const el=document.getElementById(id);
      if(el) dcontent.append(id==='deleteMenuToggle'?el.closest('.delete-menu'):el);
    });
  }
})();
