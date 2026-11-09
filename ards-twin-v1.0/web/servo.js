'use strict';
// Presentation adapter. Engine state, scheduling, physics and canonical units remain owned by app.js.
(() => {
  const $ = id => document.getElementById(id);
  let snapshot = null;
  let panelDraft = null;
  const fields = ['clinical-mode','clinical-fio2','clinical-peep','clinical-rr','clinical-vt','clinical-flow','clinical-vc-pause','clinical-pinsp','clinical-ti','clinical-pc-pause'];
  const setText = (id, text) => { $(id).textContent = text; };
  const fixed = (v, n = 1) => Number.isFinite(v) ? v.toFixed(n) : '—';
  function syncDeviceUnits() {
    $('servo-vt').value = $('clinical-vt').value === '' ? '' : String(Math.round(Number($('clinical-vt').value) * 1000));
    $('servo-flow').value = $('clinical-flow').value === '' ? '' : String(Number((Number($('clinical-flow').value) * 60).toFixed(6)));
    const vt = Number($('clinical-vt').value), flow = Number($('clinical-flow').value);
    const pause = Number($('clinical-vc-pause').value), period = 60 / Number($('clinical-rr').value);
    const ti = vt / flow + pause, te = period - ti;
    setText('servo-timing', flow > 0 && te > 0 ? 'Volume-control timing · Ti ' + ti.toFixed(2) + ' s · Te ' + te.toFixed(2) + ' s · I:E 1:' + (te / ti).toFixed(1) : 'Enter a valid volume, flow, pause and rate.');
  }
  const timing = document.createElement('p'); timing.id = 'servo-timing'; timing.className = 'servo-timing';
  $('clinical-vc-fields').append(timing);
  for (const [device, canonical, factor] of [['servo-vt','clinical-vt',1000],['servo-flow','clinical-flow',60]]) {
    $(device).addEventListener('input', () => {
      $(canonical).value = $(device).value === '' ? '' : String(Number($(device).value) / factor);
      $(canonical).dispatchEvent(new Event('input', {bubbles:true}));
    });
  }
  $('clinical-session-form').addEventListener('input', syncDeviceUnits);
  function openPanel(name, focus) {
    if (name === 'settings') {
      panelDraft = Object.fromEntries(fields.map(id => [id, $(id).value]));
      syncDeviceUnits();
    }
    const dialog = $('servo-' + name + '-panel');
    dialog.showModal();
    if (focus) $(focus).focus();
  }
  document.querySelectorAll('[data-panel]').forEach(button => button.addEventListener('click', () => openPanel(button.dataset.panel, button.dataset.focus)));
  document.querySelectorAll('[data-close-panel]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  $('servo-cancel-settings').addEventListener('click', () => {
    const v = snapshot?.ventilator;
    const restore = v ? {'clinical-mode':v.mode,'clinical-fio2':v.fio2,'clinical-peep':v.peepCmH2O,'clinical-rr':v.rrPerMin ?? v.rr,'clinical-vt':v.vtL,'clinical-flow':v.inspiratoryFlowLps,'clinical-vc-pause':v.inspiratoryPauseSec} : panelDraft;
    for (const [id,value] of Object.entries(restore || {})) {
      if (value != null) $(id).value = String(value);
    }
    $('clinical-mode').dispatchEvent(new Event('change', {bubbles:true}));
    $('clinical-fio2').dispatchEvent(new Event('input', {bubbles:true}));
    syncDeviceUnits();
  });
  // Run state is reported from the actual controls, never from a second simulation clock.
  function renderRunState() {
    setText('servo-run-state', snapshot ? ($('clinical-pause-continuous').disabled ? 'PAUSED / BOUNDED ADVANCE' : 'RUNNING') : 'STANDBY');
  }
  new MutationObserver(renderRunState).observe($('clinical-pause-continuous'), {attributes:true,attributeFilter:['disabled']});
  new MutationObserver(() => {
    const state = $('clinical-settings-state').textContent;
    setText('servo-applied-state', snapshot ? state : 'Start patient to apply reference settings');
  }).observe($('clinical-settings-state'), {childList:true,subtree:true});
  document.addEventListener('vent:snapshot', event => {
    const initializing = !snapshot;
    snapshot = event.detail;
    $('clinical-quick-start').textContent = 'Restart reference patient';
    const v = snapshot.ventilator || {}, m = snapshot.pulmonary?.measurements || {};
    setText('servo-clock', fixed(snapshot.timeSec, 1));
    setText('servo-o2', Number.isFinite(v.fio2) ? String(Math.round(v.fio2 * 100)) : '—');
    setText('servo-peep', fixed(v.peepCmH2O));
    setText('servo-volume', Number.isFinite(v.vtL) ? String(Math.round(v.vtL * 1000)) : '—');
    setText('servo-rate', fixed(v.rrPerMin ?? v.rr, 0));
    setText('servo-ppeak', fixed(m.lastCompletedBreath?.Ppeak));
    setText('servo-pplat', fixed(m.plateauPressureCmH2O));
    setText('servo-dp', fixed(m.drivingPressureCmH2O));
    const breath = m.lastCompletedBreath;
    setText('servo-measured-rr', fixed(breath?.RR));
    setText('servo-vte', fixed(Number.isFinite(breath?.VtExpired) ? breath.VtExpired * 1000 : null, 0));
    setText('servo-ve', fixed(breath ? breath.VtExpired * breath.RR : null, 2));
    const arrested = Boolean(snapshot.systemic?.decompensation?.cardiacArrest);
    setText('servo-status', arrested ? 'CARDIAC ARREST · ' + (snapshot.systemic.decompensation.arrestRhythm || 'ARREST') : snapshot.ventilatorChangePending ? 'Settings pending · applying at the next completed breath boundary' : 'Patient active · controlled ventilation · no spontaneous effort');
    document.querySelector('.servo-statusbar').classList.toggle('servo-arrest-alert', arrested);
    // Close setup only after successful initialization. Errors leave the form available.
    if (initializing && $('servo-settings-panel').open && $('clinical-initialize').disabled) $('servo-settings-panel').close();
    renderRunState();
  });
  const error = document.createElement('p');
  error.setAttribute('role','alert'); error.className = 'servo-panel-error';
  $('servo-settings-panel').querySelector('.servo-panel-content').append(error);
  new MutationObserver(() => { error.textContent = $('clinical-session-error').hidden ? '' : $('clinical-session-error').textContent; }).observe($('clinical-session-error'), {attributes:true,childList:true,subtree:true});
  for (const id of ['clinical-pressure-chart','clinical-flow-chart','clinical-volume-chart']) {
    const text = document.createElementNS('http://www.w3.org/2000/svg','text');
    text.setAttribute('x','50%');text.setAttribute('y','50%');text.setAttribute('text-anchor','middle');
    text.textContent='Start patient · advance time to display waveform';$(id).append(text);
  }
})();
