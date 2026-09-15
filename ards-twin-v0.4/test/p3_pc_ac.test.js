// test/p3_pc_ac.test.js — P3: PC-A/C controller.

const { Simulation, PcAcController } = require('../src/simulation.js');
const { PRESETS } = require('../src/presets.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

function newSim(presetFn, opts = {}) {
  const params = presetFn();
  const vent = new PcAcController({
    fio2: opts.fio2 || 0.4,
    peep: opts.peep || 5,
    rr: opts.rr || 14,
    pinsp: opts.pinsp || 15,
    inspiratoryTime: opts.ti || 1.0,
    inspiratoryPause: opts.pause || 0,
  });
  return new Simulation({ params, controller: vent, dt: 0.001, fio2: opts.fio2 || 0.4 });
}

// ---- T1: rejection of invalid settings ----
test('PC-AC: rejects invalid settings', () => {
  let threw = 0;
  try { new PcAcController({ fio2: 0.5, peep: 5, rr: 0, pinsp: 15, inspiratoryTime: 1.0 }); }
  catch (_) { threw++; }
  try { new PcAcController({ fio2: 0.5, peep: 5, rr: 14, pinsp: -1, inspiratoryTime: 1.0 }); }
  catch (_) { threw++; }
  try { new PcAcController({ fio2: 0.5, peep: 5, rr: 14, pinsp: 15, inspiratoryTime: 0 }); }
  catch (_) { threw++; }
  try { new PcAcController({ fio2: 1.5, peep: 5, rr: 14, pinsp: 15, inspiratoryTime: 1.0 }); }
  catch (_) { threw++; }
  try { new PcAcController({ fio2: 0.5, peep: -1, rr: 14, pinsp: 15, inspiratoryTime: 1.0 }); }
  catch (_) { threw++; }
  try { new PcAcController({ fio2: 0.5, peep: 5, rr: 14, pinsp: 30, inspiratoryTime: 5.0 }); }
  catch (_) { threw++; }   // ti + pause > breath period
  // Sanity: a valid config does NOT throw.
  let validThrew = false;
  try { new PcAcController({ fio2: 0.5, peep: 5, rr: 14, pinsp: 15, inspiratoryTime: 1.0 }); }
  catch (_) { validThrew = true; }
  assert(!validThrew, 'valid PC-AC config should not throw');
  assert(threw === 6, `expected 6 throws from invalid configs, got ${threw}`);
});

// ---- T2: airway pressure tracks commanded pressure + PEEP ----
test('PC-AC: Paw tracks PEEP + pinsp during INSPIRATION', () => {
  const sim = newSim(PRESETS.Baseline, { peep: 5, pinsp: 15, ti: 1.0 });
  sim.runFor(2 * 60 / 14);
  // Sample an INSPIRATION row from the middle of a breath
  const inspStart = sim.trace.findIndex(p => p.phase === 'INSPIRATION' && p.t > 4);
  const inspEnd = sim.trace.findIndex((p, i) => i > inspStart && p.phase !== 'INSPIRATION');
  const inspRows = sim.trace.slice(inspStart, inspEnd);
  // After equilibration (Paw should be 20)
  const late = inspRows.slice(Math.floor(inspRows.length / 2));
  const peakPaw = Math.max(...late.map(r => r.output.airwayPressure));
  assert(peakPaw > 19 && peakPaw < 21,
    `Peak Paw ${peakPaw.toFixed(2)} should be ≈ 20 cmH2O`);
});

// ---- T3: Paw = PEEP during EXPIRATION ----
test('PC-AC: Paw returns to PEEP during EXPIRATION', () => {
  const sim = newSim(PRESETS.Baseline, { peep: 5, pinsp: 15, ti: 1.0 });
  sim.runFor(4 * 60 / 14);
  const expirRows = sim.trace.filter(p => p.phase === 'EXPIRATION' && p.t > 10);
  assert(expirRows.length > 100);
  const late = expirRows.slice(Math.floor(expirRows.length * 0.8));
  for (const r of late) {
    assert(Math.abs(r.output.airwayPressure - 5) < 0.1,
      `Paw ${r.output.airwayPressure.toFixed(2)} should = PEEP 5`);
  }
});

// ---- T4: inspiratory flow is decelerating in a passive RC lung ----
test('PC-AC: inspiratory flow is decelerating (passive RC)', () => {
  const sim = newSim(PRESETS.Baseline, { peep: 5, pinsp: 15, ti: 1.0 });
  sim.runFor(2 * 60 / 14);
  // Sample INSPIRATION flow trajectory
  const inspStart = sim.trace.findIndex(p => p.phase === 'INSPIRATION' && p.t > 4);
  const inspEnd = sim.trace.findIndex((p, i) => i > inspStart && p.phase !== 'INSPIRATION');
  const inspRows = sim.trace.slice(inspStart, inspEnd);
  // Q should start high and decay
  const qFirst = inspRows[5].output.airwayFlow;
  const qMid = inspRows[Math.floor(inspRows.length / 2)].output.airwayFlow;
  const qLast = inspRows[inspRows.length - 5].output.airwayFlow;
  assert(qFirst > qMid, `flow not decelerating: ${qFirst} > ${qMid}?`);
  assert(qMid > qLast, `flow not decelerating: ${qMid} > ${qLast}?`);
});

// ---- T5: Vt emerges from mechanics, lower compliance → lower Vt ----
test('PC-AC: lower compliance reduces Vt at identical pressure', () => {
  function vWithK(K) {
    const p = PRESETS.Baseline();
    for (const c of p.compartments) {
      c.capacity = c.capacity * (30 / K);
      c.elasticScale = K;
    }
    const sim = newSim(() => p, { peep: 5, pinsp: 15, ti: 1.0 });
    sim.runFor(5 * 60 / 14);
    const ms = sim.metrics().slice(2, -1);
    return ms.reduce((s, m) => s + m.VtInspired, 0) / ms.length;
  }
  const normalVt = vWithK(30);
  const stiffVt = vWithK(60);  // half compliance
  assert(stiffVt < normalVt,
    `stiffer Vt ${stiffVt.toFixed(3)} should be < normal ${normalVt.toFixed(3)}`);
  // Should be roughly half
  const ratio = stiffVt / normalVt;
  assert(ratio < 0.9,
    `Vt ratio ${ratio.toFixed(2)} should reflect halved compliance`);
});

// ---- T6: deterministic traces ----
test('PC-AC: deterministic — same inputs → identical traces', () => {
  function trace() {
    const sim = newSim(PRESETS.Baseline, { peep: 5, pinsp: 15, ti: 1.0 });
    sim.runFor(2 * 60 / 14);
    return sim.trace.map(p => ({
      t: p.t, V: p.output.totalVolume, Paw: p.output.airwayPressure,
    }));
  }
  const a = trace();
  const b = trace();
  assert(a.length === b.length);
  for (let i = 0; i < a.length; i++) {
    assert(Math.abs(a[i].V - b[i].V) < 1e-9);
    assert(Math.abs(a[i].Paw - b[i].Paw) < 1e-9);
  }
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
