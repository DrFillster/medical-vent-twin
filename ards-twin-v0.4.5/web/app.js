'use strict';
(() => {
  const $ = id => document.getElementById(id);
  const form = $('settings');
  const number = id => Number($(id).value);
  let worker = null, timer = null, latest = null;
  const chartNames = ['pressure', 'flow', 'volume'];
  const metrics = ['ppeak', 'pplat', 'dp', 'vti', 'vte', 'mv'];
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
    const url = URL.createObjectURL(new Blob([JSON.stringify(latest, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `vent-run-v${latest.version}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (latest) chartNames.forEach(name => drawChart(name, latest.waveform)); }, 150); });
  syncControls();
})();
