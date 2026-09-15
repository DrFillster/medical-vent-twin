// app.js — ARDS Digital Twin v0.4.2 browser UI
// Loads the simulator bundle, runs VC-A/C breaths, displays metrics + waveform.

import {
  Simulation, VcAcController, PRESETS,
  makePatientParams,
} from '../ards-v042.bundle.js';

const $ = (id) => document.getElementById(id);

function num(id) { return parseFloat($(id).value); }

function setMetric(id, val, digits = 2) {
  $(id).textContent = Number.isFinite(val) ? val.toFixed(digits) : '—';
}

function runSimulation() {
  const preset = $('preset').value;
  const p = makePatientParams(PRESETS[preset]());
  const ctrl = new VcAcController({
    fio2: num('fio2'),
    peep: num('peep'),
    rr: num('rr'),
    vt: num('vt'),
    inspiratoryFlow: num('flow'),
    inspiratoryPause: num('pause'),
  });
  const dt = num('dt');
  const breaths = num('breaths');
  const cycleTime = 60 / ctrl.settings.rr;
  const sim = new Simulation({
    params: p, controller: ctrl, dt, trackGas: false,
  });
  sim.runFor(breaths * cycleTime);
  // Drop the first breath (warmup) if multiple.
  const ms = sim.metrics();
  // Find the last FULL breath (Ti > 0 — completed inspiration; the
  // trailing partial in `ms` has Te > 0 but Ppeak = 0 because no
  // inspiration has happened yet in that cycle).
  let last = ms[0] || {};
  for (let i = 1; i < ms.length; i++) {
    if ((ms[i].Ti || 0) > 0) last = ms[i];
  }
  setMetric('m-ppeak', last.Ppeak);
  setMetric('m-pplat', last.Pplat);
  setMetric('m-vti', last.VtInspired, 3);
  setMetric('m-vte', last.VtExpired, 3);
  setMetric('m-dp', last.drivingPressure);
  setMetric('m-rr', last.RR, 1);
  setMetric('m-mv', last.MV, 2);
  setMetric('m-tv', sim.state.totalVolume, 3);
  drawWaveform(sim, dt);
  drawRecruitment(sim);
  drawDetails(sim);
  drawDiag(sim);
}

function drawWaveform(sim, dt) {
  // Sample to ~600 points (every ~5-10 steps for performance).
  const trace = sim.trace;
  if (!trace || trace.length === 0) return;
  const N = trace.length;
  const stride = Math.max(1, Math.floor(N / 600));
  const samples = [];
  for (let i = 0; i < N; i += stride) {
    samples.push(trace[i]);
  }
  // Axes: x = time (s), left y = Paw (cmH2O), right y = Volume (L).
  const tMax = samples[samples.length - 1].t;
  const pawMax = Math.max(40, ...samples.map(s => s.output.airwayPressure || 0)) * 1.1;
  const volMax = Math.max(2, ...samples.map(s => s.output.totalVolume || 0)) * 1.1;
  const W = 800, H = 320;
  const xLeft = 40, xRight = W - 20, yTop = 20, yBot = 280;
  const xScale = (x) => xLeft + (x / tMax) * (xRight - xLeft);
  const yPaw = (v) => yBot - (v / pawMax) * (yBot - yTop);
  const yVol = (v) => yBot - (v / volMax) * (yBot - yTop);
  // Grid: horizontal lines every 10 cmH2O.
  const grid = $('grid');
  let gridHtml = '';
  for (let p = 0; p <= pawMax; p += 10) {
    gridHtml += `<line class="grid" x1="${xLeft}" y1="${yPaw(p)}" x2="${xRight}" y2="${yPaw(p)}"/>`;
  }
  grid.innerHTML = gridHtml;
  // Paw path.
  const pawPath = samples.map((s, i) => `${i === 0 ? 'M' : 'L'}${xScale(s.t).toFixed(1)},${yPaw(s.output.airwayPressure || 0).toFixed(1)}`).join(' ');
  $('paw-path').setAttribute('d', pawPath);
  // Vol path.
  const volPath = samples.map((s, i) => `${i === 0 ? 'M' : 'L'}${xScale(s.t).toFixed(1)},${yVol(s.output.totalVolume || 0).toFixed(1)}`).join(' ');
  $('vol-path').setAttribute('d', volPath);
  // Axis labels.
  const labels = $('axis-labels');
  labels.innerHTML = `
    <text class="label-text" x="42" y="18">${pawMax.toFixed(0)} cmH₂O</text>
    <text class="label-text" x="42" y="296">0</text>
    <text class="label-text" x="${W - 60}" y="18">${volMax.toFixed(1)} L</text>
    <text class="label-text" x="${(xLeft + xRight) / 2}" y="298">${tMax.toFixed(1)} s</text>
  `;
}

function drawRecruitment(sim) {
  const wrap = $('recruitment-bars');
  const labelOf = { normal: 'normal', recruitable: 'recruitable', consolidated: 'consolidated' };
  const finalCs = sim.state.compartments;
  const html = finalCs.map((cs, i) => {
    const r = cs.recruitment ?? 0;
    const pct = Math.round(r * 100);
    return `<div class="recruit-bar">
      <div class="recruit-fill" style="width:${pct}%"></div>
      <div class="recruit-label">${labelOf[cs.id] || cs.id} — r = ${r.toFixed(3)} (${pct}%)</div>
    </div>`;
  }).join('');
  wrap.innerHTML = html;
}

function drawDetails(sim) {
  const cs = sim.state.compartments;
  const lines = cs.map((c, i) => {
    const p = Math.round((c.alveolarPressure || 0) * 100) / 100;
    const v = Math.round((c.volume || 0) * 1000) / 1000;
    return `${c.id.padEnd(14)} V=${v.toString().padStart(7)} L   P_alv=${p.toString().padStart(7)} cmH₂O   r=${(c.recruitment ?? 0).toFixed(3)}`;
  });
  $('comp-details').textContent = lines.join('\n');
}

function drawDiag(sim) {
  const tr = sim.trace;
  if (!tr || tr.length === 0) {
    $('diag').textContent = '(no trace)';
    return;
  }
  const failures = tr.filter(s => s.output && s.output.solverFailure);
  const iters = tr.map(s => s.output && s.output.iterations).filter(x => typeof x === 'number');
  const total = iters.reduce((a, b) => a + b, 0);
  const avg = total / iters.length;
  const max = Math.max(...iters);
  const substeps = tr.map(s => s.output && s.output.substeps).filter(x => typeof x === 'number');
  const maxSub = substeps.length ? Math.max(...substeps) : 0;
  const lines = [
    `Steps:            ${tr.length}`,
    `Solver failures:  ${failures.length}`,
    `Newton iters:     avg=${avg.toFixed(2)} max=${max}`,
    `Max substeps:     ${maxSub}`,
    `Last step residual: ${(tr[tr.length - 1].output.residualNorm || 0).toExponential(3)}`,
  ];
  $('diag').textContent = lines.join('\n');
}

document.getElementById('run').addEventListener('click', () => {
  const btn = $('run');
  btn.disabled = true;
  btn.textContent = 'Running...';
  // Yield to browser to repaint.
  requestAnimationFrame(() => {
    try {
      const t0 = performance.now();
      runSimulation();
      const t1 = performance.now();
      console.log(`Simulation took ${(t1 - t0).toFixed(0)} ms`);
    } catch (e) {
      console.error(e);
      alert(`Simulation error: ${e.message}\n${e.stack || ''}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Run simulation';
    }
  });
});

// Auto-run with default settings.
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => $('run').click(), 100);
});
