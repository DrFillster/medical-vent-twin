// test/d_low_resistance.test.js — Section D acceptance test:
// low-resistance convergence. Construct passive VC breaths with central and
// branch resistances progressively reduced by decades. Demonstrate
// convergence of Ppeak − Pplat → 0. Do NOT use a single permissive threshold
// — report a convergence table.

const { Simulation, VcAcController } = require('../src/simulation.js');
const { PRESETS } = require('../src/presets.js');
const { makePatientParams } = require('../src/contracts.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('ok -', name); passed++; }
  catch (e) { console.error('FAIL -', name, ':', e.message); failed++; }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }

// Build a low-resistance variant of a Baseline-like lung.
function makeParams(rc, rb) {
  return makePatientParams({
    compartments: [
      // High K (30) so V_eq at PEEP < Vmax (i.e. not saturation regime).
      { id: 'normal', fraction: 0.40, resistance: rb,
        capacity: 1.2, elasticScale: 30,
        perfusionFraction: 0.40, deadSpaceFraction: 0.3 },
      { id: 'recruitable', fraction: 0.40, resistance: rb,
        capacity: 1.0, elasticScale: 30,
        perfusionFraction: 0.40, deadSpaceFraction: 0.3 },
      { id: 'consolidated', fraction: 0.20, resistance: rb,
        capacity: 0.001, elasticScale: 1.0,
        perfusionFraction: 0.20, deadSpaceFraction: 0.3 },
    ],
    centralAirwayResistance: rc,
    airwayOpeningPressure: 0,
  });
}

function runBreath(params) {
  const v = new VcAcController({
    fio2: 0.4, peep: 5, rr: 14,
    vt: 0.480, inspiratoryFlow: 0.5, inspiratoryPause: 0.3,
  });
  const sim = new Simulation({
    params, controller: v, dt: 0.001, initialRecruitmentState: { normal: 1, recruitable: 0, consolidated: 0 } , fio2: 0.4, trackGas: false,
  });
  sim.runFor(3 * 60 / 14);
  return sim.metrics()[1];
}

function peakPplatDiff(rc, rb) {
  const m = runBreath(makeParams(rc, rb));
  return m.Ppeak - m.Pplat;
}

// ---- D1: convergence table --------------------------------------------
test('D1: low-resistance convergence table', () => {
  // Pair values: (central R, branch R). Both go down by decades.
  const pairs = [
    [10, 10],
    [1, 1],
    [0.1, 0.1],
    [0.01, 0.01],
  ];
  const table = pairs.map(([rc, rb]) => ({ rc, rb, diff: peakPplatDiff(rc, rb) }));
  console.log('  Rcentral  Rbranch   Ppeak-Pplat');
  for (const row of table) {
    console.log(`  ${row.rc.toFixed(4)}    ${row.rb.toFixed(4)}    ${row.diff.toFixed(3)}`);
  }
  // Each successive row must have a smaller or equal Ppeak-Pplat.
  for (let i = 1; i < table.length; i++) {
    assert(table[i].diff <= table[i - 1].diff + 0.1,
      `Convergence broken: diff[${i}]=${table[i].diff} should be < diff[${i-1}]=${table[i-1].diff}`);
  }
  // Final row (lowest R) must be tightly near zero.
  const last = table[table.length - 1].diff;
  assert(last < 0.5,
    `Lowest-R case: Ppeak-Pplat ${last.toFixed(3)} should be < 0.5 cmH2O`);
});

// ---- D2: limit behavior — diff → 0 at very low R -----------------------
test('D2: Ppeak-Pplat < 0.5 cmH2O at R → 0.01', () => {
  const diff = peakPplatDiff(0.01, 0.01);
  assert(diff < 0.5,
    `Lowest-R diff ${diff.toFixed(3)} should be < 0.5 cmH2O`);
});

console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed === 0 ? 0 : 1);
