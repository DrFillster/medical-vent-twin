'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const form = $('settings');
  const number = id => Number($(id).value);
  let worker = null, timer = null, latest = null;
  let clinicalWorker = null, clinicalHumModExport = null, clinicalSnapshot = null;
  const chartNames = ['pressure', 'flow', 'volume'];
  const metrics = ['ppeak', 'pplat', 'dp', 'vti', 'vte', 'mv'];
  function readinessLabel(status) {
    const labels = {
      ready: 'Ready',
      'cohort-calibrated': 'Cohort-calibrated',
      'required-explicit-input': 'Required input',
      'required-external-data': 'External data required',
      missing: 'Missing',
    };
    return labels[status] || status;
  }

  let clinicalManifest = null;

  function renderClinicalCase(caseId) {
    if (!clinicalManifest) return;
    const c = clinicalManifest.cases.find(item => item.id === caseId);
    if (!c) return;
    const readiness = c.readiness;
    $('clinical-summary').textContent = c.narrative;
    $('clinical-severity').textContent =
      c.severity[0].toUpperCase() + c.severity.slice(1);
    $('clinical-recruitability').textContent =
      c.recruitability[0].toUpperCase() + c.recruitability.slice(1);
    $('clinical-executable').textContent = readiness.executable ? 'Yes' : 'Not yet';
    $('clinical-executable').dataset.status = readiness.executable ? 'ready' : 'blocked';

    const container = $('clinical-readiness');
    container.replaceChildren();
    for (const [name, entry] of Object.entries(readiness.fields)) {
      const row = document.createElement('div');
      row.className = 'readiness-row';
      const label = document.createElement('span');
      label.className = 'readiness-name';
      label.textContent = name.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
      const status = document.createElement('span');
      status.className = 'readiness-status';
      status.dataset.status = entry.status;
      status.textContent = readinessLabel(entry.status);
      row.append(label, status);
      if (entry.note) {
        const note = document.createElement('small');
        note.textContent = entry.note;
        row.append(note);
      }
      container.append(row);
    }
  }

  async function initializeClinicalPreview() {
    const select = $('clinical-case');
    try {
      const response = await fetch('./clinical-cases.json?v=0.5-alpha', { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      clinicalManifest = await response.json();
      if (!clinicalManifest || !Array.isArray(clinicalManifest.cases) ||
          clinicalManifest.cases.length !== 9) {
        throw new Error('clinical case manifest is invalid');
      }
      select.replaceChildren();
      for (const c of clinicalManifest.cases) {
        const option = document.createElement('option');
        option.value = c.id;
        option.textContent = c.name;
        select.append(option);
      }
      const preferred = 'berlin-moderate-moderate-aspiration';
      select.value = Array.from(select.options).some(o => o.value === preferred)
        ? preferred
        : select.options[0]?.value || '';
      if (select.value) renderClinicalCase(select.value);
      select.addEventListener('change', () => {
        renderClinicalCase(select.value);
        if (clinicalWorker) {
          stopClinicalWorker();
          $('clinical-session-status').textContent =
            'Case changed. Reinitialize the clinical session for the selected case.';
        }
      });
    } catch (error) {
      $('clinical-summary').textContent =
        'Clinical case catalog could not be loaded. The mechanics lab remains available.';
      $('clinical-executable').textContent = 'Unavailable';
      $('clinical-readiness').textContent = error.message;
      select.disabled = true;
    }
  }

  function clinicalNumber(id) {
    const value = Number($(id).value);
    if (!Number.isFinite(value)) throw new Error(id + ' must be a finite number');
    return value;
  }

  function syncClinicalMode() {
    const mode = $('clinical-mode').value;
    const vc = mode === 'VC_AC';
    const pc = mode === 'PC_AC';
    $('clinical-vc-fields').hidden = !vc;
    $('clinical-pc-fields').hidden = !pc;
    ['clinical-vt', 'clinical-flow', 'clinical-vc-pause'].forEach(id => {
      $(id).required = vc && id !== 'clinical-vc-pause';
      $(id).disabled = !vc;
    });
    ['clinical-pinsp', 'clinical-ti', 'clinical-pc-pause'].forEach(id => {
      $(id).required = pc && id !== 'clinical-pc-pause';
      $(id).disabled = !pc;
    });
  }

  function displayClinicalValue(value) {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—';
  }

  function renderClinicalSnapshot(snapshot) {
    clinicalSnapshot = snapshot;
    $('clinical-live').hidden = false;
    $('clinical-time').textContent = displayClinicalValue(snapshot.timeSec);
    $('clinical-current-mode').textContent = snapshot.ventilator?.mode || '—';
    $('clinical-current-peep').textContent = displayClinicalValue(snapshot.ventilator?.peepCmH2O);
    $('clinical-pao2').textContent = displayClinicalValue(snapshot.systemic?.gasExchange?.pao2MmHg);
    $('clinical-paco2').textContent = displayClinicalValue(snapshot.systemic?.gasExchange?.paco2MmHg);
    $('clinical-hr').textContent = displayClinicalValue(snapshot.systemic?.hemodynamics?.heartRatePerMin);
    $('clinical-map').textContent = displayClinicalValue(snapshot.systemic?.hemodynamics?.meanArterialPressureMmHg);
    $('clinical-dp').textContent = displayClinicalValue(snapshot.pulmonary?.measurements?.drivingPressureCmH2O);
    $('clinical-session-status').textContent =
      'Session active · ' + snapshot.coupling.mode +
      (snapshot.ventilatorChangePending ? ' · ventilator change pending next breath boundary' : '') +
      ' · HumMod replay does not synthesize systemic response to Vent interventions.';
    $('clinical-new-peep').value = snapshot.ventilator?.peepCmH2O ?? '';
    $('clinical-reset').disabled = false;
  }

  function stopClinicalWorker() {
    if (clinicalWorker) clinicalWorker.terminate();
    clinicalWorker = null;
    clinicalSnapshot = null;
    $('clinical-live').hidden = true;
    $('clinical-reset').disabled = true;
    $('clinical-initialize').disabled = false;
  }

  function showClinicalError(message, diagnostics) {
    $('clinical-session-error').hidden = false;
    $('clinical-session-error').textContent = message;
    $('clinical-session-status').textContent = 'Clinical session not advanced.';
    if (diagnostics) console.error('Clinical twin diagnostics', diagnostics);
  }

  function clinicalVentilationPayload() {
    const mode = $('clinical-mode').value;
    const payload = {
      mode,
      fio2: clinicalNumber('clinical-fio2'),
      peep: clinicalNumber('clinical-peep'),
      rr: clinicalNumber('clinical-rr'),
    };
    if (mode === 'VC_AC') {
      payload.vtL = clinicalNumber('clinical-vt');
      payload.inspiratoryFlowLps = clinicalNumber('clinical-flow');
      payload.inspiratoryPauseSec = clinicalNumber('clinical-vc-pause');
    } else if (mode === 'PC_AC') {
      payload.pinspCmH2O = clinicalNumber('clinical-pinsp');
      payload.inspiratoryTimeSec = clinicalNumber('clinical-ti');
      payload.inspiratoryPauseSec = clinicalNumber('clinical-pc-pause');
    } else {
      throw new Error('Choose VC-AC or PC-AC');
    }
    return payload;
  }

  function startClinicalWorker() {
    if (typeof Worker === 'undefined') {
      throw new Error('This browser cannot run the clinical simulation worker');
    }
    stopClinicalWorker();
    clinicalWorker = new Worker('./clinical-worker.js?v=0.5-alpha');
    clinicalWorker.onerror = () => showClinicalError(
      'Could not load the clinical simulation worker. Confirm the generated engine bundle is current.');
    clinicalWorker.onmessage = ({ data }) => {
      if (data.type === 'error') {
        showClinicalError(data.message, data.diagnostics);
        $('clinical-initialize').disabled = false;
        return;
      }
      if (data.type === 'initialized') {
        $('clinical-session-error').hidden = true;
        $('clinical-initialize').disabled = true;
        renderClinicalSnapshot(data.snapshot);
        return;
      }
      if (data.type === 'snapshot') {
        $('clinical-session-error').hidden = true;
        renderClinicalSnapshot(data.snapshot);
        return;
      }
      if (data.type === 'reset-complete') {
        stopClinicalWorker();
        $('clinical-session-status').textContent = 'Session reset. Explicit inputs are preserved.';
      }
    };
    return clinicalWorker;
  }

  async function loadHumModFile(file) {
    clinicalHumModExport = null;
    if (!file) {
      $('clinical-hummod-status').textContent =
        'Attach a canonical Vent trajectory or raw HumMod System.X series.';
      return;
    }
    const text = await file.text();
    const parsed = JSON.parse(text);

    let canonical;
    let sourceKind;
    if (parsed.schema === 'vent-hummod-trajectory/v1') {
      canonical = parsed;
      sourceKind = 'canonical trajectory';
    } else if (parsed.schema === 'hummod-raw-series/v1') {
      if (!window.VENT || typeof VENT.convertHumModRawSeries !== 'function') {
        throw new Error('Raw HumMod conversion is unavailable in this browser build');
      }
      canonical = VENT.convertHumModRawSeries(parsed);
      sourceKind = 'raw System.X series converted to canonical seconds';
    } else {
      throw new Error(
        'HumMod file schema must be vent-hummod-trajectory/v1 or hummod-raw-series/v1');
    }

    if (!Array.isArray(canonical.rows) || canonical.rows.length === 0) {
      throw new Error('HumMod trajectory must contain at least one row');
    }
    clinicalHumModExport = canonical;
    $('clinical-hummod-status').textContent =
      'Loaded ' + sourceKind + ' · ' + (canonical.trajectoryId || '(missing ID)') +
      ' · full validation occurs during session initialization.';
  }

  function initializeClinicalSessionUi() {
    syncClinicalMode();
    $('clinical-mode').addEventListener('change', syncClinicalMode);
    $('clinical-hummod-file').addEventListener('change', async event => {
      $('clinical-session-error').hidden = true;
      try {
        await loadHumModFile(event.target.files?.[0] || null);
      } catch (error) {
        clinicalHumModExport = null;
        $('clinical-hummod-status').textContent = 'Trajectory rejected.';
        showClinicalError(error.message);
      }
    });

    $('clinical-session-form').addEventListener('submit', event => {
      event.preventDefault();
      $('clinical-session-error').hidden = true;
      if (!$('clinical-session-form').reportValidity()) return;
      try {
        if (!clinicalHumModExport) throw new Error('Attach a HumMod trajectory before initialization');
        const w = startClinicalWorker();
        const recruitable = clinicalNumber('clinical-recruitment');
        w.postMessage({
          type: 'initialize',
          payload: {
            caseId: $('clinical-case').value,
            humModExport: clinicalHumModExport,
            ventilation: clinicalVentilationPayload(),
            initialRecruitmentState: {
              normal: 1,
              recruitable,
              consolidated: 0,
            },
            dt: clinicalNumber('clinical-dt'),
          },
        });
        $('clinical-session-status').textContent = 'Initializing Vent + HumMod replay session…';
      } catch (error) {
        showClinicalError(error.message);
      }
    });

    $('clinical-run').addEventListener('click', () => {
      try {
        if (!clinicalWorker) throw new Error('Initialize a clinical session first');
        clinicalWorker.postMessage({ type: 'runFor', seconds: clinicalNumber('clinical-run-seconds') });
      } catch (error) { showClinicalError(error.message); }
    });

    $('clinical-set-peep').addEventListener('click', () => {
      try {
        if (!clinicalWorker) throw new Error('Initialize a clinical session first');
        clinicalWorker.postMessage({ type: 'setPEEP', valueCmH2O: clinicalNumber('clinical-new-peep') });
      } catch (error) { showClinicalError(error.message); }
    });

    $('clinical-apply-vent').addEventListener('click', () => {
      try {
        if (!clinicalWorker) throw new Error('Initialize a clinical session first');
        clinicalWorker.postMessage({
          type: 'requestVentilationChange',
          ventilation: clinicalVentilationPayload(),
        });
      } catch (error) { showClinicalError(error.message); }
    });

    $('clinical-insp-hold').addEventListener('click', () => {
      try {
        if (!clinicalWorker) throw new Error('Initialize a clinical session first');
        clinicalWorker.postMessage({ type: 'requestInspiratoryHold', durationSec: 0.5 });
      } catch (error) { showClinicalError(error.message); }
    });

    $('clinical-exp-hold').addEventListener('click', () => {
      try {
        if (!clinicalWorker) throw new Error('Initialize a clinical session first');
        clinicalWorker.postMessage({ type: 'requestExpiratoryHold', durationSec: 0.5 });
      } catch (error) { showClinicalError(error.message); }
    });

    $('clinical-reset').addEventListener('click', () => {
      if (clinicalWorker) clinicalWorker.postMessage({ type: 'reset' });
      else stopClinicalWorker();
    });
  }

  const examples = {
    reference: { preset: 'phenotype_baseline', mode: 'VC', peep: 5, rr: 14, vt: 480, flow: 30, pause: 0.5, recruitment: 0, pinsp: 12, ti: 0.8,
      note: 'Observe the pressure rise during filling, then the pressure drop during the inspiratory pause.' },
    recruitment: { preset: 'phenotype_high_recruitability', mode: 'VC', peep: 10, rr: 22, vt: 350, flow: 30, pause: 0.3, recruitment: 50, pinsp: 12, ti: 0.8,
      note: 'A declared 50% of recruitable tissue starts open. Compare PEEP 10 and 15 while holding the other settings fixed; each run starts fresh.' },
    pressure: { preset: 'phenotype_moderate_recruitability', mode: 'PC', peep: 10, rr: 20, vt: 350, flow: 30, pause: 0.3, recruitment: 50, pinsp: 12, ti: 0.8,
      note: 'The pressure target is PEEP plus inspiratory pressure. Change that pressure and observe the delivered volume.' },
  };
  function syncControls() {
    const vc = $('mode').value === 'VC';
    $('vc-fields').hidden = !vc; $('pc-fields').hidden = vc;
    ['vt', 'flow', 'pause'].forEach(id => $(id).disabled = !vc);
    ['pinsp', 'ti'].forEach(id => $(id).disabled = vc);
    const baseline = $('preset').value === 'phenotype_baseline';
    $('recruitment').disabled = baseline;
    if (baseline) $('recruitment').value = 0;
    $('recruitment-note').textContent = baseline
      ? 'The reference phenotype has no recruitable pool. Normal tissue starts open; consolidated tissue starts closed.'
      : 'Explicit starting state of the recruitable pool, not a fraction of the whole lung. Normal tissue starts open; consolidated tissue starts closed.';
  }
  function clearResults(message) {
    latest = null; $('download').disabled = true;
    metrics.forEach(id => $('m-' + id).textContent = '—');
    chartNames.forEach(id => $(id + '-chart').replaceChildren());
    $('recruitment-bars').replaceChildren();
    $('diag').textContent = 'No completed run for these settings.';
    $('result-caption').textContent = message;
    $('plateau-note').textContent = 'Plateau and driving pressure require a settled volume-control pause.';
  }
  function stopWorker() {
    if (worker) worker.terminate(); worker = null;
    clearTimeout(timer); timer = null;
    $('fields').disabled = false; $('run').disabled = false;
    $('run').innerHTML = 'Run simulation <span aria-hidden="true">→</span>';
    $('cancel').hidden = true; $('progress').hidden = true;
    $('results').setAttribute('aria-busy', 'false');
  }
  function showError(message, diagnostics) {
    stopWorker();
    clearResults('Run stopped. No complete result is displayed.');
    $('error').hidden = false; $('error').textContent = message;
    $('status').textContent = 'Revise the settings and try again.';
    if (diagnostics) $('diag').textContent = JSON.stringify(diagnostics, null, 2);
  }
  function scenario() {
    return { preset: $('preset').value, mode: $('mode').value, peep: number('peep'), rr: number('rr'),
      vt: number('vt') / 1000, flow: number('flow') / 60, pause: number('pause'), pinsp: number('pinsp'), ti: number('ti'),
      recruitment: number('recruitment') / 100, breaths: number('breaths'), dt: number('dt') };
  }
  const ns = 'http://www.w3.org/2000/svg';
  function svgNode(tag, attributes, text) {
    const n = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([key, value]) => n.setAttribute(key, value));
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function drawChart(name, rows) {
    const svg = $(name + '-chart'); svg.replaceChildren();
    // Coordinate width follows the actual panel so tick text stays readable on phones.
    const width = Math.max(230, svg.getBoundingClientRect().width || 650), height = 160;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const data = rows.map(r => ({ t: r.t, y: name === 'flow' ? r.flow * 60 : r[name] }));
    let lo = Math.min(0, ...data.map(r => r.y)), hi = Math.max(1, ...data.map(r => r.y));
    const pad = (hi - lo) * 0.08; hi += pad; if (lo < 0) lo -= pad;
    const left = 44, right = width - 12, top = 10, bottom = 133, tmax = data.at(-1).t;
    const x = t => left + t / tmax * (right - left), y = v => bottom - (v - lo) / (hi - lo) * (bottom - top);
    for (let i = 0; i <= 3; i++) {
      const v = lo + (hi - lo) * i / 3;
      svg.append(svgNode('line', { x1: left, x2: right, y1: y(v), y2: y(v), class: 'grid' }));
      svg.append(svgNode('text', { x: left - 6, y: y(v) + 4, 'text-anchor': 'end' }, Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1)));
    }
    svg.append(svgNode('line', { x1: left, x2: right, y1: y(0), y2: y(0), class: 'zero' }));
    [0, 0.5, 1].forEach(f => svg.append(svgNode('text', { x: x(tmax * f), y: 154, 'text-anchor': f === 0 ? 'start' : f === 1 ? 'end' : 'middle' }, `${(tmax * f).toFixed(1)} s`)));
    svg.append(svgNode('path', { class: 'trace', d: data.map((r, i) => `${i ? 'L' : 'M'}${x(r.t).toFixed(2)},${y(r.y).toFixed(2)}`).join(' ') }));
  }
  function render(result) {
    latest = result;
    const m = result.metrics;
    const values = { ppeak: m.Ppeak, pplat: m.Pplat, dp: m.drivingPressure, vti: m.VtInspired * 1000, vte: m.VtExpired * 1000, mv: m.MV };
    for (const [key, value] of Object.entries(values)) $('m-' + key).textContent = Number.isFinite(value) ? value.toFixed(['vti','vte'].includes(key) ? 0 : 1) : '—';
    const s = result.scenario;
    $('result-caption').textContent = `${$('preset').selectedOptions[0].textContent} · ${s.mode} · PEEP ${s.peep} · RR ${s.rr}/min · ${s.breaths} breaths · ${s.dt * 1000} ms timestep`;
    $('plateau-note').textContent = result.plateauNote;
    chartNames.forEach(name => drawChart(name, result.waveform));
    $('recruitment-bars').replaceChildren();
    for (const c of result.compartments) {
      const row = document.createElement('div'); row.className = 'recruit-row';
      const label = document.createElement('div'); label.className = 'recruit-text';
      const name = document.createElement('span'); name.textContent = c.id[0].toUpperCase() + c.id.slice(1);
      const value = document.createElement('span'); value.textContent = `${(100 * c.recruitment).toFixed(0)}% open`;
      label.append(name, value);
      const bar = document.createElement('div'); bar.className = 'bar'; bar.setAttribute('aria-hidden', 'true');
      const fill = document.createElement('span'); fill.style.width = (c.recruitment * 100) + '%'; bar.append(fill);
      row.append(label, bar); $('recruitment-bars').append(row);
    }
    $('diag').textContent = JSON.stringify({ version: result.version, scenario: s, solver: result.stats, compartments: result.compartments }, null, 2);
    $('download').disabled = false;
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    stopWorker(); clearResults('Running this scenario…'); $('error').hidden = true;
    const input = scenario();
    if (typeof Worker === 'undefined') { showError('This browser cannot run background simulations. Try a current Safari, Chrome, Firefox, or Edge browser.'); return; }
    $('fields').disabled = true; $('run').disabled = true; $('run').textContent = 'Running…';
    $('cancel').hidden = false; $('progress').hidden = false; $('progress').value = 0;
    $('status').textContent = 'Computing breaths. You can cancel at any time.'; $('results').setAttribute('aria-busy', 'true');
    try { worker = new Worker('./worker.js?v=0.4.5'); }
    catch (error) { showError('Could not start the simulation worker: ' + error.message); return; }
    timer = setTimeout(() => showError('Run exceeded two minutes and was stopped. Try fewer breaths or a larger timestep.'), 120000);
    worker.onerror = () => showError('Could not load the simulation engine. Reload the page; if this persists, check that all release files were deployed together.');
    worker.onmessage = ({ data }) => {
      if (data.type === 'progress') { $('progress').value = data.progress; return; }
      if (data.type === 'error') { showError(data.message, data.diagnostics); return; }
      if (data.type === 'result') {
        stopWorker(); render(data.result); $('status').textContent = 'Run complete. Results are ready below.';
        // Focus the result heading after an explicit run, including on mobile.
        $('results').focus({ preventScroll: true });
        if (window.matchMedia('(max-width: 700px)').matches) $('results').scrollIntoView({ behavior: 'auto', block: 'start' });
      }
    };
    worker.postMessage(input);
  });
  $('cancel').addEventListener('click', () => { stopWorker(); clearResults('Run canceled. Adjust settings to start again.'); $('status').textContent = 'Canceled.'; });
  form.addEventListener('input', () => { if (!worker) { clearResults('Settings changed. Run again to update the results.'); $('error').hidden = true; } });
  form.addEventListener('change', event => {
    if (event.target.id === 'example') {
      const example = examples[$('example').value];
      for (const [id, value] of Object.entries(example)) if (id !== 'note') $(id).value = value;
      $('example-note').textContent = example.note;
    }
    syncControls();
    clearResults('Scenario ready. Run to see the response.');
  });
  $('download').addEventListener('click', () => {
    if (!latest) return;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(latest, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `vent-run-v${latest.version}.json`;
    a.hidden = true;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (latest) chartNames.forEach(name => drawChart(name, latest.waveform)); }, 150); });
  initializeClinicalPreview();
  initializeClinicalSessionUi();
  syncControls();
})();
