'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const form = $('settings');
  const number = id => Number($(id).value);
  let worker = null, timer = null, latest = null;
  let clinicalWorker = null, clinicalHumModExport = null, clinicalRecruitmentHistory = null, clinicalSnapshot = null;
  let clinicalContinuousRun = false;
  let clinicalContinuousTimer = null;
  let clinicalInterventions = [];
  let clinicalPhysiologyTrend = [];
  let clinicalLastAppliedVentilation = null;
  const CLINICAL_TREND_MAX_POINTS = 1800;
  const SYNTHETIC_DEMO_HUMMOD = Object.freeze({
    schema: 'vent-hummod-trajectory/v1',
    trajectoryId: 'synthetic-demo-fixture-not-real-hummod',
    source: Object.freeze({
      repository: 'riliescu/hummod-standalone',
      revision: '8dab57e05631f779bf5020fe0dd51874d8ae98c1',
      exporterVersion: 'synthetic-demo-fixture/1',
    }),
    symbols: Object.freeze([
      'PO2Artys.Pressure',
      'CO2Artys.Pressure',
      'BloodPh.ArtysPh',
      'Heart-Rate.Rate',
      'SystemicArtys.Pressure',
      'CardiacOutput.Flow(L/Min)',
    ]),
    rows: Object.freeze([
      Object.freeze({ timestampSec: 0, values: Object.freeze({
        'PO2Artys.Pressure': 80,
        'CO2Artys.Pressure': 40,
        'BloodPh.ArtysPh': 7.40,
        'Heart-Rate.Rate': 90,
        'SystemicArtys.Pressure': 75,
        'CardiacOutput.Flow(L/Min)': 5.0,
      }) }),
      Object.freeze({ timestampSec: 30, values: Object.freeze({
        'PO2Artys.Pressure': 79,
        'CO2Artys.Pressure': 40.5,
        'BloodPh.ArtysPh': 7.39,
        'Heart-Rate.Rate': 91,
        'SystemicArtys.Pressure': 74,
        'CardiacOutput.Flow(L/Min)': 5.0,
      }) }),
      Object.freeze({ timestampSec: 120, values: Object.freeze({
        'PO2Artys.Pressure': 78,
        'CO2Artys.Pressure': 41,
        'BloodPh.ArtysPh': 7.38,
        'Heart-Rate.Rate': 92,
        'SystemicArtys.Pressure': 73,
        'CardiacOutput.Flow(L/Min)': 4.9,
      }) }),
    ]),
  });

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

    const calibrationPanel = $('clinical-calibration-panel');
    const isReference = caseId === 'berlin-moderate-moderate-aspiration';
    calibrationPanel.hidden = !isReference;
    if (isReference && window.VENT &&
        typeof VENT.buildReferenceCaseCalibration === 'function') {
      const profile = VENT.buildReferenceCaseCalibration();
      $('clinical-calibration-envelope').textContent =
        profile.clinicalAxis.berlinSeverity + ' Berlin / cohort-calibrated';
      $('clinical-calibration-ri').textContent =
        profile.mechanicalAxis.recruitmentToInflationRatioTarget == null
          ? 'Not assigned'
          : String(profile.mechanicalAxis.recruitmentToInflationRatioTarget);
      $('clinical-calibration-aop').textContent =
        profile.airwayOpeningPressure.modelValueCmH2O + ' cmH₂O · model construct';
      $('clinical-calibration-note').textContent =
        'The intermediate recruitability label is a Vent mechanical construct, not a clinical R/I classification. ' +
        'R/I remains unassigned until a validated recruitability protocol is implemented and measured.';
    }
  }

  async function initializeClinicalPreview() {
    const select = $('clinical-case');
    try {
      const response = await fetch('./clinical-cases.json?v=0.6', { cache: 'no-store' });
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
        if ($('clinical-systemic-provider')?.value === 'live-reduced-hummod' &&
            select.value !== 'berlin-moderate-moderate-aspiration') {
          $('clinical-provider-status').textContent =
            'This case is not enabled for live reduced HumMod yet. Select the moderate/intermediate aspiration reference case or use trajectory replay.';
        }
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

  function syncClinicalProvider() {
    const live = $('clinical-systemic-provider').value === 'live-reduced-hummod';
    $('clinical-hummod-file-block').hidden = live;
    $('clinical-hummod-file').disabled = live;
    $('clinical-provider-status').textContent = live
      ? 'LIVE REDUCED HUMMOD CORE · experimental · reference aspiration case + VC-AC only · not full HumMod · not clinically validated.'
      : 'TRAJECTORY REPLAY · attach a canonical Vent trajectory or raw HumMod System.X series. Vent interventions do not alter replayed systemic values.';
    $('clinical-coupling-note').textContent = live
      ? 'Live reduced HumMod mode couples Vent recruitment/perfusion and mean airway pressure into source-aligned reduced gas, thorax, and circulation equations. Remaining engineering boundaries are explicit synthetic assumptions.'
      : 'Under fixed HumMod replay, Vent interventions change pulmonary mechanics only. The systemic trajectory does not synthesize a new response.';
    const reference = 'berlin-moderate-moderate-aspiration';
    for (const option of Array.from($('clinical-case').options)) {
      option.disabled = live && option.value !== reference;
    }
    for (const option of Array.from($('clinical-mode').options)) {
      option.disabled = live && option.value === 'PC_AC';
    }
    if (live) {
      if ($('clinical-case').value !== reference) {
        $('clinical-case').value = reference;
        renderClinicalCase(reference);
      }
      if ($('clinical-mode').value !== 'VC_AC') {
        $('clinical-mode').value = 'VC_AC';
        syncClinicalMode();
      }
      $('clinical-executable').textContent = 'Live preview';
      $('clinical-executable').dataset.status = 'ready';
    }
  }

  function syncClinicalInitializationMode() {
    const history = $('clinical-init-mode').value === 'history';
    $('clinical-explicit-recruitment').hidden = history;
    $('clinical-history-recruitment').hidden = !history;
    $('clinical-recruitment').disabled = history;
    $('clinical-recruitment').required = !history;
    $('clinical-recruitment-history-file').disabled = !history;
    $('clinical-recruitment-history-file').required = history;
  }

  function displayClinicalValue(value) {
    return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—';
  }

  function displayClinicalInteger(value) {
    return typeof value === 'number' && Number.isFinite(value) ? String(Math.round(value)) : '—';
  }

  function formatClinicalClock(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return hours > 0
      ? String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0')
      : String(minutes).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  }

  function renderClinicalInterventions() {
    const log = $('clinical-intervention-log');
    if (!log) return;
    log.replaceChildren();
    if (!clinicalInterventions.length) {
      const empty = document.createElement('li');
      empty.className = 'clinical-intervention-empty';
      empty.textContent = 'No interventions yet.';
      log.append(empty);
      return;
    }
    for (const event of [...clinicalInterventions].reverse()) {
      const item = document.createElement('li');
      const clock = document.createElement('time');
      clock.textContent = formatClinicalClock(event.timeSec);
      const text = document.createElement('span');
      text.textContent = event.label;
      item.append(clock, text);
      log.append(item);
    }
  }

  function recordClinicalIntervention(label, details) {
    const event = {
      timeSec: clinicalSnapshot?.timeSec ?? 0,
      label,
      details: details || null,
    };
    clinicalInterventions.push(event);
    renderClinicalInterventions();
    renderClinicalPhysiologyTrends();
    return event;
  }

  function formatVentSettingChange(label, previous, next, unit, formatter) {
    const fmt = formatter || (value => String(value));
    if (previous == null || next == null || Number(previous) === Number(next)) return null;
    return label + ' ' + fmt(previous) + ' → ' + fmt(next) + (unit ? ' ' + unit : '');
  }

  function clinicalVentilatorDifferences() {
    if (!clinicalSnapshot) return [];
    let next;
    try { next = clinicalVentilationPayload(); } catch (_) { return []; }
    const current = clinicalSnapshot.ventilator || {};
    return [
      formatVentSettingChange('FiO₂', current.fio2, next.fio2, '', value => Number(value).toFixed(2)),
      formatVentSettingChange('PEEP', current.peepCmH2O, next.peep, 'cmH₂O'),
      formatVentSettingChange('RR', current.rrPerMin ?? current.rr, next.rr, '/min'),
      formatVentSettingChange('VT', current.vtL, next.vtL, 'mL', value => String(Math.round(Number(value) * 1000))),
      formatVentSettingChange('Flow', current.inspiratoryFlowLps, next.inspiratoryFlowLps, 'L/s', value => Number(value).toFixed(2)),
      formatVentSettingChange('Pause', current.inspiratoryPauseSec, next.inspiratoryPauseSec, 's'),
      formatVentSettingChange('Pinsp', current.pinspCmH2O, next.pinspCmH2O, 'cmH₂O'),
      formatVentSettingChange('Ti', current.inspiratoryTimeSec, next.inspiratoryTimeSec, 's'),
    ].filter(Boolean);
  }

  function renderClinicalPendingSettings() {
    const feedback = $('clinical-pending-summary');
    const state = $('clinical-settings-state');
    if (!feedback || !state || !clinicalSnapshot) return;
    const changes = clinicalVentilatorDifferences();
    if (clinicalSnapshot.ventilatorChangePending) {
      state.textContent = 'Pending next breath';
      state.dataset.status = 'pending';
      feedback.textContent = 'Ventilator change sent. Waiting for the next completed breath boundary.';
    } else if (changes.length) {
      state.textContent = 'Edited · not applied';
      state.dataset.status = 'edited';
      feedback.textContent = 'Unapplied: ' + changes.join(' · ');
    } else {
      state.textContent = 'Current';
      state.dataset.status = 'current';
      feedback.textContent = 'Displayed settings match the active ventilator.';
    }
  }

  function latestClinicalManeuver(snapshot, kind) {
    const hold = kind === 'inspiratory'
      ? snapshot?.pulmonary?.measurements?.inspiratoryHold
      : snapshot?.pulmonary?.measurements?.expiratoryHold;
    return hold || null;
  }

  function showClinicalManeuverResult(action, snapshot) {
    const result = $('clinical-maneuver-result');
    if (!result) return;
    const m = snapshot?.pulmonary?.measurements || {};
    if (action === 'requestInspiratoryHold') {
      const hold = latestClinicalManeuver(snapshot, 'inspiratory');
      if (hold && Number.isFinite(m.plateauPressureCmH2O)) {
        const dp = Number.isFinite(m.drivingPressureCmH2O)
          ? ' · Driving pressure ' + displayClinicalValue(m.drivingPressureCmH2O) + ' cmH₂O'
          : '';
        result.textContent = 'Inspiratory hold completed at ' + formatClinicalClock(snapshot.timeSec) +
          ' · Plateau pressure ' + displayClinicalValue(m.plateauPressureCmH2O) + ' cmH₂O' + dp + '.';
        recordClinicalIntervention(
          'Inspiratory hold · Pplat ' + displayClinicalValue(m.plateauPressureCmH2O) + ' cmH₂O',
          { type: 'inspiratory-hold', measurement: hold });
      } else {
        result.textContent = 'Inspiratory hold completed, but a valid plateau pressure was not available.';
      }
    } else if (action === 'requestExpiratoryHold') {
      const hold = latestClinicalManeuver(snapshot, 'expiratory');
      if (hold && Number.isFinite(m.totalPeepCmH2O)) {
        const intrinsic = Number.isFinite(m.intrinsicPeepCmH2O)
          ? ' · Intrinsic PEEP ' + displayClinicalValue(m.intrinsicPeepCmH2O) + ' cmH₂O'
          : '';
        result.textContent = 'Expiratory hold completed at ' + formatClinicalClock(snapshot.timeSec) +
          ' · Total PEEP ' + displayClinicalValue(m.totalPeepCmH2O) + ' cmH₂O' + intrinsic + '.';
        recordClinicalIntervention(
          'Expiratory hold · total PEEP ' + displayClinicalValue(m.totalPeepCmH2O) + ' cmH₂O',
          { type: 'expiratory-hold', measurement: hold });
      } else {
        result.textContent = 'Expiratory hold completed, but a valid total PEEP was not available.';
      }
    } else if (action === 'performPassiveMechanics') {
      result.textContent = Number.isFinite(m.plateauPressureCmH2O) && Number.isFinite(m.totalPeepCmH2O)
        ? 'Both holds completed · Pplat ' + displayClinicalValue(m.plateauPressureCmH2O) +
          ' cmH₂O · total PEEP ' + displayClinicalValue(m.totalPeepCmH2O) +
          ' cmH₂O · driving pressure ' + displayClinicalValue(m.drivingPressureCmH2O) + ' cmH₂O.'
        : 'Combined mechanics maneuver completed with incomplete measurements.';
      recordClinicalIntervention('Passive mechanics · inspiratory + expiratory holds',
        { type: 'passive-mechanics', measurements: m });
    }
  }

  function captureClinicalPhysiologyTrend(snapshot) {
    const point = {
      timeSec: Number(snapshot?.timeSec),
      pao2: Number(snapshot?.systemic?.gasExchange?.pao2MmHg),
      paco2: Number(snapshot?.systemic?.gasExchange?.paco2MmHg),
      map: Number(snapshot?.systemic?.hemodynamics?.meanArterialPressureMmHg),
      pH: Number(snapshot?.systemic?.gasExchange?.pH),
    };
    if (!Number.isFinite(point.timeSec)) return;
    const previous = clinicalPhysiologyTrend[clinicalPhysiologyTrend.length - 1];
    if (previous && previous.timeSec === point.timeSec) {
      clinicalPhysiologyTrend[clinicalPhysiologyTrend.length - 1] = point;
    } else {
      clinicalPhysiologyTrend.push(point);
      if (clinicalPhysiologyTrend.length > CLINICAL_TREND_MAX_POINTS) {
        clinicalPhysiologyTrend.splice(0, clinicalPhysiologyTrend.length - CLINICAL_TREND_MAX_POINTS);
      }
    }
  }

  function drawClinicalTrend(svgId, field, decimals) {
    const svg = $(svgId);
    if (!svg) return;
    svg.replaceChildren();
    const data = clinicalPhysiologyTrend
      .map(row => ({ t: row.timeSec, y: row[field] }))
      .filter(row => Number.isFinite(row.t) && Number.isFinite(row.y));
    if (data.length < 2) {
      svg.append(svgNode('text', { x: '50%', y: '50%', 'text-anchor': 'middle' }, 'Run patient to build trend'));
      return;
    }
    const width = Math.max(230, svg.getBoundingClientRect().width || 650);
    const height = 160;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    const left = 44, right = width - 12, top = 10, bottom = 133;
    const t0 = data[0].t;
    const t1 = Math.max(data[data.length - 1].t, t0 + 1);
    let lo = Math.min(...data.map(row => row.y));
    let hi = Math.max(...data.map(row => row.y));
    const range = Math.max(hi - lo, field === 'pH' ? 0.02 : 1);
    lo -= range * 0.12;
    hi += range * 0.12;
    const x = t => left + (t - t0) / (t1 - t0) * (right - left);
    const y = value => bottom - (value - lo) / (hi - lo) * (bottom - top);
    for (let i = 0; i <= 3; i++) {
      const value = lo + (hi - lo) * i / 3;
      svg.append(svgNode('line', { x1:left, x2:right, y1:y(value), y2:y(value), class:'grid' }));
      svg.append(svgNode('text', { x:left - 6, y:y(value) + 4, 'text-anchor':'end' }, value.toFixed(decimals)));
    }
    for (const event of clinicalInterventions) {
      if (event.timeSec < t0 || event.timeSec > t1) continue;
      const marker = svgNode('line', { x1:x(event.timeSec), x2:x(event.timeSec), y1:top, y2:bottom, class:'intervention-marker' });
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = formatClinicalClock(event.timeSec) + ' · ' + event.label;
      marker.append(title);
      svg.append(marker);
    }
    [0, 0.5, 1].forEach(fraction => {
      const value = t0 + (t1 - t0) * fraction;
      svg.append(svgNode('text', {
        x:x(value), y:154,
        'text-anchor':fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle',
      }, formatClinicalClock(value)));
    });
    svg.append(svgNode('path', {
      class:'trace',
      d:data.map((row,index) => `${index ? 'L' : 'M'}${x(row.t).toFixed(2)},${y(row.y).toFixed(2)}`).join(' '),
    }));
  }

  function renderClinicalPhysiologyTrends() {
    drawClinicalTrend('clinical-pao2-trend', 'pao2', 0);
    drawClinicalTrend('clinical-paco2-trend', 'paco2', 0);
    drawClinicalTrend('clinical-map-trend', 'map', 0);
    drawClinicalTrend('clinical-ph-trend', 'pH', 2);
  }

  function drawClinicalTrace(svgId, rows, field) {
    const svg = $(svgId);
    svg.replaceChildren();
    if (!Array.isArray(rows) || rows.length < 2) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', '50%');
      text.setAttribute('y', '50%');
      text.setAttribute('text-anchor', 'middle');
      text.textContent = 'Advance the session to draw this trace';
      svg.append(text);
      return;
    }

    const width = Math.max(230, svg.getBoundingClientRect().width || 650);
    const height = 160;
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const t0 = rows[0].t;
    const data = rows.map(row => ({
      t: row.t - t0,
      y: row[field],
    })).filter(row => Number.isFinite(row.t) && Number.isFinite(row.y));

    if (data.length < 2) return;

    let lo = Math.min(0, ...data.map(row => row.y));
    let hi = Math.max(1e-9, ...data.map(row => row.y));
    const range = Math.max(hi - lo, 1e-9);
    const pad = range * 0.08;
    hi += pad;
    if (lo < 0) lo -= pad;

    const left = 44;
    const right = width - 12;
    const top = 10;
    const bottom = 133;
    const tmax = Math.max(data[data.length - 1].t, 1e-9);
    const x = t => left + t / tmax * (right - left);
    const y = value => bottom - (value - lo) / (hi - lo) * (bottom - top);

    for (let i = 0; i <= 3; i++) {
      const value = lo + (hi - lo) * i / 3;
      svg.append(svgNode('line', {
        x1: left, x2: right, y1: y(value), y2: y(value), class: 'grid',
      }));
      svg.append(svgNode('text', {
        x: left - 6, y: y(value) + 4, 'text-anchor': 'end',
      }, Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(2)));
    }

    svg.append(svgNode('line', {
      x1: left, x2: right, y1: y(0), y2: y(0), class: 'zero',
    }));

    [0, 0.5, 1].forEach(fraction => {
      const value = tmax * fraction;
      svg.append(svgNode('text', {
        x: x(value),
        y: 154,
        'text-anchor': fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle',
      }, value.toFixed(1) + ' s'));
    });

    svg.append(svgNode('path', {
      class: 'trace',
      d: data.map((row, index) =>
        `${index ? 'L' : 'M'}${x(row.t).toFixed(2)},${y(row.y).toFixed(2)}`).join(' '),
    }));
  }

  function renderClinicalSnapshot(snapshot) {
    clinicalSnapshot = snapshot;
    captureClinicalPhysiologyTrend(snapshot);
    $('clinical-live').hidden = false;
    $('clinical-time').textContent = displayClinicalValue(snapshot.timeSec);
    $('clinical-current-mode').textContent = snapshot.ventilator?.mode || '—';
    $('clinical-current-peep').textContent = displayClinicalValue(snapshot.ventilator?.peepCmH2O);
    $('clinical-current-fio2').textContent = typeof snapshot.ventilator?.fio2 === 'number'
      ? snapshot.ventilator.fio2.toFixed(2) : '—';
    $('clinical-current-rr').textContent = displayClinicalValue(snapshot.ventilator?.rrPerMin ?? snapshot.ventilator?.rr);
    $('clinical-current-vt').textContent = typeof snapshot.ventilator?.vtL === 'number'
      ? Math.round(snapshot.ventilator.vtL * 1000) : '—';
    $('clinical-pao2').textContent = displayClinicalInteger(snapshot.systemic?.gasExchange?.pao2MmHg);
    $('clinical-paco2').textContent = displayClinicalInteger(snapshot.systemic?.gasExchange?.paco2MmHg);
    const clinicalPh = snapshot.systemic?.gasExchange?.pH;
    $('clinical-ph').textContent = typeof clinicalPh === 'number' && Number.isFinite(clinicalPh)
      ? clinicalPh.toFixed(2)
      : '—';
    $('clinical-hr').textContent = displayClinicalValue(snapshot.systemic?.hemodynamics?.heartRatePerMin);
    $('clinical-map').textContent = displayClinicalInteger(snapshot.systemic?.hemodynamics?.meanArterialPressureMmHg);
    const cardiacOutputMlPerMin = snapshot.systemic?.hemodynamics?.cardiacOutputMlPerMin;
    $('clinical-co').textContent = typeof cardiacOutputMlPerMin === 'number' && Number.isFinite(cardiacOutputMlPerMin)
      ? (cardiacOutputMlPerMin / 1000).toFixed(2)
      : '—';
    $('clinical-pplat').textContent = displayClinicalValue(snapshot.pulmonary?.measurements?.plateauPressureCmH2O);
    $('clinical-total-peep').textContent = displayClinicalValue(snapshot.pulmonary?.measurements?.totalPeepCmH2O);
    $('clinical-autopeep').textContent = displayClinicalValue(snapshot.pulmonary?.measurements?.intrinsicPeepCmH2O);
    $('clinical-dp').textContent = displayClinicalValue(snapshot.pulmonary?.measurements?.drivingPressureCmH2O);
    const clinicalWaveform = snapshot.pulmonary?.recentWaveform || [];
    drawClinicalTrace('clinical-pressure-chart', clinicalWaveform, 'pressureCmH2O');
    drawClinicalTrace('clinical-flow-chart', clinicalWaveform, 'flowLps');
    drawClinicalTrace('clinical-volume-chart', clinicalWaveform, 'volumeL');
    renderClinicalPhysiologyTrends();
    $('clinical-session-status').textContent =
      'Patient active · ' +
      (snapshot.ventilatorChangePending ? 'ventilator change pending next breath boundary' : 'settings applied') +
      (snapshot.coupling.mode === 'live-reduced-hummod-ards-core'
        ? ' · dynamic cardiopulmonary simulation'
        : ' · fixed systemic trajectory replay');
    if (document.activeElement !== $('clinical-new-peep')) {
      $('clinical-new-peep').value = snapshot.ventilator?.peepCmH2O ?? '';
    }
    $('clinical-reset').disabled = false;
    renderClinicalPendingSettings();
    if (clinicalContinuousRun && clinicalWorker) {
      scheduleClinicalContinuousStep();
    }
  }

  function scheduleClinicalContinuousStep() {
    if (!clinicalContinuousRun || !clinicalWorker) return;
    if (clinicalContinuousTimer != null) clearTimeout(clinicalContinuousTimer);
    clinicalContinuousTimer = setTimeout(() => {
      clinicalContinuousTimer = null;
      if (!clinicalContinuousRun || !clinicalWorker) return;
      clinicalWorker.postMessage({ type: 'runFor', seconds: 1 });
    }, 1000);
  }

  function stopClinicalContinuousRun() {
    clinicalContinuousRun = false;
    if (clinicalContinuousTimer != null) clearTimeout(clinicalContinuousTimer);
    clinicalContinuousTimer = null;
    const runButton = $('clinical-run-continuous');
    const pauseButton = $('clinical-pause-continuous');
    if (runButton) runButton.disabled = !clinicalWorker;
    if (pauseButton) pauseButton.disabled = true;
  }

  function stopClinicalWorker() {
    stopClinicalContinuousRun();
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
    clinicalInterventions = [];
    clinicalPhysiologyTrend = [];
    renderClinicalInterventions();
    renderClinicalPhysiologyTrends();
    clinicalWorker = new Worker('./clinical-worker.js?v=0.6');
    clinicalWorker.onerror = () => showClinicalError(
      'Could not load the clinical simulation worker. Confirm the generated engine bundle is current.');
    clinicalWorker.onmessage = ({ data }) => {
      if (data.type === 'error') {
        stopClinicalContinuousRun();
        showClinicalError(data.message, data.diagnostics);
        $('clinical-initialize').disabled = false;
        return;
      }
      if (data.type === 'initialized') {
        $('clinical-session-error').hidden = true;
        $('clinical-initialize').disabled = true;
        $('clinical-run-continuous').disabled = false;
        $('clinical-pause-continuous').disabled = true;
        renderClinicalSnapshot(data.snapshot);
        return;
      }
      if (data.type === 'snapshot') {
        $('clinical-session-error').hidden = true;
        renderClinicalSnapshot(data.snapshot);
        if (data.action === 'requestInspiratoryHold' || data.action === 'requestExpiratoryHold' ||
            data.action === 'performPassiveMechanics') {
          showClinicalManeuverResult(data.action, data.snapshot);
          $('clinical-insp-hold').disabled = false;
          $('clinical-exp-hold').disabled = false;
        }
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

  async function loadRecruitmentHistoryFile(file) {
    clinicalRecruitmentHistory = null;
    if (!file) {
      $('clinical-recruitment-history-status').textContent =
        'Attach a vent-recruitment-history/v1 file containing an explicit prior state and sustained pressure segments.';
      return;
    }
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!window.VENT || typeof VENT.validateRecruitmentHistory !== 'function') {
      throw new Error('Recruitment-history validation is unavailable in this browser build');
    }
    VENT.validateRecruitmentHistory(parsed);
    clinicalRecruitmentHistory = parsed;
    $('clinical-recruitment-history-status').textContent =
      'Loaded recruitment history · ' + parsed.segments.length +
      ' pressure segment' + (parsed.segments.length === 1 ? '' : 's') +
      ' · current recruitment will be derived by Vent.';
  }

  function loadSyntheticDemoInputs() {
    stopClinicalWorker();
    clinicalHumModExport = SYNTHETIC_DEMO_HUMMOD;
    clinicalRecruitmentHistory = null;

    $('clinical-case').value = 'berlin-moderate-moderate-aspiration';
    renderClinicalCase($('clinical-case').value);
    $('clinical-mode').value = 'VC_AC';
    syncClinicalMode();
    $('clinical-fio2').value = '0.60';
    $('clinical-peep').value = '8';
    $('clinical-rr').value = '20';
    $('clinical-init-mode').value = 'explicit';
    syncClinicalInitializationMode();
    $('clinical-recruitment').value = '0.35';
    $('clinical-vt').value = '0.42';
    $('clinical-flow').value = '0.70';
    $('clinical-vc-pause').value = '0.20';
    $('clinical-dt').value = '0.002';
    $('clinical-hummod-file').value = '';
    $('clinical-recruitment-history-file').value = '';
    $('clinical-systemic-provider').value = 'replay';
    syncClinicalProvider();
    $('clinical-hummod-status').textContent =
      'SYNTHETIC DEMO DATA LOADED · systemic values are fixture-only and are not a real HumMod trajectory.';
    $('clinical-recruitment-history-status').textContent =
      'Explicit synthetic current recruitment state selected for demo.';
    $('clinical-session-error').hidden = true;
    $('clinical-session-status').textContent =
      'Synthetic demo inputs loaded. Review the values, then initialize the session.';
  }

  function initializeClinicalSessionUi() {
    syncClinicalMode();
    syncClinicalInitializationMode();
    syncClinicalProvider();
    $('clinical-load-demo').addEventListener('click', loadSyntheticDemoInputs);
    $('clinical-quick-start').addEventListener('click', () => {
      stopClinicalWorker();
      clinicalHumModExport = null;
      clinicalRecruitmentHistory = null;
      $('clinical-case').value = 'berlin-moderate-moderate-aspiration';
      renderClinicalCase($('clinical-case').value);
      $('clinical-systemic-provider').value = 'live-reduced-hummod';
      $('clinical-mode').value = 'VC_AC';
      $('clinical-fio2').value = '0.60';
      $('clinical-peep').value = '8';
      $('clinical-rr').value = '20';
      $('clinical-init-mode').value = 'explicit';
      $('clinical-recruitment').value = '0.35';
      $('clinical-vt').value = '0.42';
      $('clinical-flow').value = '0.70';
      $('clinical-vc-pause').value = '0.20';
      $('clinical-dt').value = '0.002';
      syncClinicalMode();
      syncClinicalInitializationMode();
      syncClinicalProvider();
      $('clinical-session-error').hidden = true;
      $('clinical-session-panel').open = true;
      $('clinical-session-status').textContent =
        'Reference patient loaded. Starting live cardiopulmonary simulation…';
      $('clinical-session-form').requestSubmit();
      $('clinical-session-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $('clinical-systemic-provider').addEventListener('change', () => {
      syncClinicalProvider();
      if (clinicalWorker) {
        stopClinicalWorker();
        $('clinical-session-status').textContent = 'Systemic provider changed. Reinitialize the clinical session.';
      }
    });
    $('clinical-mode').addEventListener('change', () => {
      syncClinicalMode();
      if ($('clinical-systemic-provider').value === 'live-reduced-hummod' &&
          $('clinical-mode').value !== 'VC_AC') {
        $('clinical-provider-status').textContent =
          'Live reduced HumMod currently supports VC-AC only. Choose VC-AC or switch to trajectory replay.';
      }
    });
    $('clinical-init-mode').addEventListener('change', () => {
      syncClinicalInitializationMode();
      if (clinicalWorker) {
        stopClinicalWorker();
        $('clinical-session-status').textContent =
          'Recruitment initialization mode changed. Reinitialize the clinical session.';
      }
    });
    $('clinical-recruitment-history-file').addEventListener('change', async event => {
      $('clinical-session-error').hidden = true;
      try {
        await loadRecruitmentHistoryFile(event.target.files?.[0] || null);
      } catch (error) {
        clinicalRecruitmentHistory = null;
        $('clinical-recruitment-history-status').textContent = 'Recruitment history rejected.';
        showClinicalError(error.message);
      }
    });
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
        const provider = $('clinical-systemic-provider').value;
        if (provider === 'replay' && !clinicalHumModExport) {
          throw new Error('Attach a HumMod trajectory before replay initialization');
        }
        if (provider === 'live-reduced-hummod') {
          if ($('clinical-case').value !== 'berlin-moderate-moderate-aspiration') {
            throw new Error('Live reduced HumMod is currently limited to the moderate/intermediate aspiration reference case');
          }
          if ($('clinical-mode').value !== 'VC_AC') {
            throw new Error('Live reduced HumMod currently supports VC-AC only');
          }
        }
        const w = startClinicalWorker();
        const payload = {
          caseId: $('clinical-case').value,
          ventilation: clinicalVentilationPayload(),
          dt: clinicalNumber('clinical-dt'),
        };
        if (provider === 'replay') payload.humModExport = clinicalHumModExport;
        if ($('clinical-init-mode').value === 'history') {
          if (!clinicalRecruitmentHistory) {
            throw new Error('Attach a recruitment history before initialization');
          }
          payload.initializationHistory = clinicalRecruitmentHistory;
        } else {
          payload.initialRecruitmentState = {
            normal: 1,
            recruitable: clinicalNumber('clinical-recruitment'),
            consolidated: 0,
          };
        }
        w.postMessage({
          type: 'initialize',
          provider,
          payload,
        });
        $('clinical-session-status').textContent = provider === 'live-reduced-hummod'
          ? 'Initializing Vent + live reduced HumMod cardiopulmonary session…'
          : 'Initializing Vent + HumMod replay session…';
      } catch (error) {
        showClinicalError(error.message);
      }
    });

    $('clinical-run').addEventListener('click', () => {
      try {
        if (!clinicalWorker) throw new Error('Initialize a clinical session first');
        if (clinicalContinuousRun) throw new Error('Pause continuous advancement before using a fixed advance');
        clinicalWorker.postMessage({ type: 'runFor', seconds: clinicalNumber('clinical-run-seconds') });
      } catch (error) { showClinicalError(error.message); }
    });

    $('clinical-run-continuous').addEventListener('click', () => {
      try {
        if (!clinicalWorker) throw new Error('Initialize a clinical session first');
        if (clinicalContinuousRun) return;
        clinicalContinuousRun = true;
        $('clinical-run-continuous').disabled = true;
        $('clinical-pause-continuous').disabled = false;
        $('clinical-session-status').textContent = 'Patient running continuously at 1× real time…';
        scheduleClinicalContinuousStep();
      } catch (error) { showClinicalError(error.message); }
    });

    $('clinical-pause-continuous').addEventListener('click', () => {
      stopClinicalContinuousRun();
      $('clinical-session-status').textContent = 'Patient paused · state preserved.';
    });

    $('clinical-set-peep')?.addEventListener('click', () => {
      try {
        if (!clinicalWorker) throw new Error('Initialize a clinical session first');
        const nextPeep = clinicalNumber('clinical-new-peep');
        const previousPeep = clinicalSnapshot?.ventilator?.peepCmH2O;
        clinicalWorker.postMessage({ type: 'setPEEP', valueCmH2O: nextPeep });
        $('clinical-peep').value = String(nextPeep);
        const peepChange = formatVentSettingChange('PEEP', previousPeep, nextPeep, 'cmH₂O');
        if (peepChange) recordClinicalIntervention(peepChange, { setting: 'peepCmH2O', previous: previousPeep, next: nextPeep });
        $('clinical-session-status').textContent = clinicalContinuousRun
          ? 'PEEP change sent · patient continues running in real time…'
          : 'PEEP change sent · patient state preserved.';
      } catch (error) { showClinicalError(error.message); }
    });

    ['clinical-mode','clinical-fio2','clinical-peep','clinical-rr','clinical-vt','clinical-flow','clinical-vc-pause','clinical-pinsp','clinical-ti','clinical-pc-pause']
      .forEach(id => $(id)?.addEventListener('input', renderClinicalPendingSettings));

    $('clinical-apply-vent').addEventListener('click', () => {
      try {
        if (!clinicalWorker) throw new Error('Initialize a clinical session first');
        const nextVentilation = clinicalVentilationPayload();
        const previousVentilation = clinicalSnapshot?.ventilator || {};
        clinicalWorker.postMessage({
          type: 'requestVentilationChange',
          ventilation: nextVentilation,
        });
        const changes = clinicalVentilatorDifferences();
        if (changes.length) {
          recordClinicalIntervention(changes.join(' · '), { type: 'ventilator-settings', requested: nextVentilation });
        }
        $('clinical-session-status').textContent = clinicalContinuousRun
          ? 'Ventilator settings sent · patient continues running in real time…'
          : 'Ventilator settings sent · patient state preserved.';
      } catch (error) { showClinicalError(error.message); }
    });

    $('clinical-measure-mechanics').addEventListener('click', () => {
      try {
        if (!clinicalWorker) throw new Error('Initialize a clinical session first');
        clinicalWorker.postMessage({
          type: 'performPassiveMechanics',
          holdDurationSec: 0.5,
          maxAdvanceSecPerHold: 90,
        });
        $('clinical-session-status').textContent =
          'Measuring passive mechanics with simulated zero-flow holds…';
      } catch (error) { showClinicalError(error.message); }
    });

    $('clinical-export-session').addEventListener('click', () => {
      try {
        if (!clinicalSnapshot) throw new Error('Initialize a clinical session first');
        if (!window.VENT || typeof VENT.createClinicalSessionRecord !== 'function') {
          throw new Error('Clinical session export is unavailable in this browser build');
        }
        const baseRecord = VENT.createClinicalSessionRecord(clinicalSnapshot);
        const record = { ...baseRecord };
        record.physiologyTrend = clinicalPhysiologyTrend.map(point => ({ ...point }));
        record.interventions = clinicalInterventions.map(event => ({
          timeSec: event.timeSec,
          clock: formatClinicalClock(event.timeSec),
          label: event.label,
          details: event.details,
        }));
        const json = JSON.stringify(record, null, 2);
        const a = document.createElement('a');
        a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
        a.download = 'vent-clinical-session-' + record.case.id + '.json';
        a.style.display = 'none';
        document.body.append(a);
        a.click();
        requestAnimationFrame(() => a.remove());
      } catch (error) { showClinicalError(error.message); }
    });

    $('clinical-insp-hold').addEventListener('click', () => {
      try {
        if (!clinicalWorker) throw new Error('Initialize a clinical session first');
        $('clinical-insp-hold').disabled = true;
        $('clinical-exp-hold').disabled = true;
        $('clinical-maneuver-result').textContent =
          'Inspiratory hold requested · waiting for end inspiration and zero flow…';
        clinicalWorker.postMessage({ type: 'requestInspiratoryHold', durationSec: 0.5 });
      } catch (error) { showClinicalError(error.message); }
    });

    $('clinical-exp-hold').addEventListener('click', () => {
      try {
        if (!clinicalWorker) throw new Error('Initialize a clinical session first');
        $('clinical-insp-hold').disabled = true;
        $('clinical-exp-hold').disabled = true;
        $('clinical-maneuver-result').textContent =
          'Expiratory hold requested · waiting for end expiration and zero flow…';
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
    const json = JSON.stringify(latest, null, 2);
    const a = document.createElement('a');
    a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(json);
    a.download = `vent-run-v${latest.version}.json`;
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    requestAnimationFrame(() => a.remove());
  });
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (latest) chartNames.forEach(name => drawChart(name, latest.waveform)); }, 150); });
  initializeClinicalPreview();
  initializeClinicalSessionUi();
  syncControls();
})();
