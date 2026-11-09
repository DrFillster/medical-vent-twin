'use strict';
// Presentation adapter. Engine state, scheduling, physics and canonical units remain owned by app.js.
(() => {
  const $ = id => document.getElementById(id);
  let snapshot = null;
  let panelDraft = null;
  const fields = ['clinical-mode','clinical-fio2','clinical-peep','clinical-rr','clinical-vt','clinical-flow','clinical-vc-pause','clinical-pinsp','clinical-ti','clinical-pc-pause'];
  const setText = (id, text) => { $(id).textContent = text; };
  const fixed = (v, n = 1) => Number.isFinite(v) ? v.toFixed(n) : '—';
  function monitorPath(id, kind, rate) {
    const svg=$(id); if(!svg) return;
    const width=600, cycles=Math.max(2,Math.min(9,Math.round((rate||60)/12))), pts=[];
    const wave=phase=>{
      if(kind==='ecg'){if(phase<.08)return 0;if(phase<.14)return .10*Math.sin((phase-.08)/.06*Math.PI);if(phase<.20)return -.08*Math.sin((phase-.14)/.06*Math.PI);if(phase<.225)return .92*Math.sin((phase-.20)/.025*Math.PI);if(phase<.255)return -.34*Math.sin((phase-.225)/.03*Math.PI);if(phase<.48)return .18*Math.sin((phase-.255)/.225*Math.PI);return 0;}
      if(kind==='art'){if(phase<.08)return 0;if(phase<.18)return .95*Math.sin((phase-.08)/.10*Math.PI/2);if(phase<.55)return .95-.55*((phase-.18)/.37);if(phase<.64)return .35+.09*Math.sin((phase-.55)/.09*Math.PI);return .35*(1-(phase-.64)/.36);}
      if(kind==='pleth'){if(phase<.12)return 0;if(phase<.28)return .9*Math.sin((phase-.12)/.16*Math.PI/2);if(phase<.55)return .9-.45*((phase-.28)/.27);if(phase<.66)return .45+.10*Math.sin((phase-.55)/.11*Math.PI);return .45*(1-(phase-.66)/.34);}
      if(kind==='co2'){if(phase<.18)return 0;if(phase<.30)return (phase-.18)/.12*.78;if(phase<.62)return .78+.08*((phase-.30)/.32);if(phase<.72)return .86*(1-(phase-.62)/.10);return 0;} return 0;};
    for(let i=0;i<=720;i++){const x=i/720*width,phase=(i/720*cycles)%1,amp=wave(phase),base=kind==='ecg'?54:76,scale=kind==='ecg'?36:54;pts.push((i?'L':'M')+x.toFixed(1)+' '+(base-amp*scale).toFixed(1));}
    const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',pts.join(' '));svg.replaceChildren(p);
  }
  function renderMonitorWaves(hr,rr){monitorPath('icu-ecg-wave','ecg',hr);monitorPath('icu-art-wave','art',hr);monitorPath('icu-pleth-wave','pleth',hr);monitorPath('icu-co2-wave','co2',rr);}
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
  const activeControls = ['clinical-run','clinical-apply-vent','clinical-insp-hold','clinical-exp-hold','clinical-measure-mechanics'];
  function renderStandby() {
    snapshot = null;
    $('clinical-arrest-banner').hidden = true;
    $('clinical-quick-start').textContent = 'Start patient';
    for (const id of ['servo-ppeak','servo-pplat','servo-dp','servo-measured-rr','servo-vte','servo-ve','servo-o2','servo-peep','servo-volume','servo-rate','clinical-hr','clinical-map','clinical-co','clinical-sao2','clinical-pao2','clinical-paco2','clinical-ph']) setText(id,'—');
    setText('servo-clock','0'); setText('servo-status','Start the reference patient to begin monitoring');
    for (const id of ['icu-hr','icu-art','icu-rr','icu-cvp','icu-spo2','icu-etco2']) setText(id,'—');
    renderMonitorWaves(60,12);
    setText('servo-applied-state','Start patient to apply reference settings');
    document.querySelector('.servo-statusbar').classList.remove('servo-arrest-alert');
    for (const id of activeControls) $(id).disabled = true;
    for (const id of ['clinical-pressure-chart','clinical-flow-chart','clinical-volume-chart']) $(id).replaceChildren();
    renderRunState();
  }
  document.addEventListener('vent:reset', renderStandby);
  document.addEventListener('vent:snapshot', event => {
    const initializing = !snapshot;
    if (initializing) for (const id of activeControls) $(id).disabled = false;
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
    const hemo = snapshot.systemic?.hemodynamics || {};
    const gas = snapshot.systemic?.gasExchange || {};
    setText('icu-hr', fixed(hemo.heartRatePerMin, 0));
    setText('icu-art', fixed(hemo.meanArterialPressureMmHg, 0));
    setText('icu-rr', fixed(breath?.RR ?? v.rrPerMin ?? v.rr, 0));
    setText('icu-cvp', fixed(hemo.rightAtrialPressureMmHg, 1));
    setText('icu-spo2', Number.isFinite(gas.sao2Fraction) ? String(Math.round(gas.sao2Fraction * 100)) : '—');
    setText('icu-etco2', fixed(gas.endTidalCo2ProxyMmHg, 0));
    renderMonitorWaves(hemo.heartRatePerMin, breath?.RR ?? v.rrPerMin ?? v.rr);
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
  renderStandby();
  for (const id of ['clinical-pressure-chart','clinical-flow-chart','clinical-volume-chart']) {
    const text = document.createElementNS('http://www.w3.org/2000/svg','text');
    text.setAttribute('x','50%');text.setAttribute('y','50%');text.setAttribute('text-anchor','middle');
    text.textContent='Start patient · advance time to display waveform';$(id).append(text);
  }
})();
