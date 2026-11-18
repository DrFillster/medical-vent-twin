'use strict';

const fs = require('fs');
const path = require('path');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
} = require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { getBerlinCase } = require('../../ards-twin-v1.0/src/berlin_case_catalog.js');

const INPUT = '/Users/philipbernard/mimic-data/derived/controlled_fit_inputs.jsonl';
const OUTPUT = process.env.OUTPUT || '/Users/philipbernard/mimic-data/derived/controlled_fit_results.jsonl';
const START_INDEX = Number(process.env.START_INDEX || 0);
const MAX_EVENTS = Number(process.env.MAX_EVENTS || 5);
const DEEP_REFINE = process.env.DEEP_REFINE === '1';

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function finite(x) { return typeof x === 'number' && Number.isFinite(x); }

function ventilationFrom(row) {
  const v = row.vent;
  if (row.hummod_mode === 'VC_AC') {
    const vtL = v.vt_set_ml / 1000;
    const flowLps = finite(v.flow_l_min)
      ? v.flow_l_min / 60
      : vtL / v.inspiratory_time_sec;
    return {
      mode: 'VC_AC', fio2: v.fio2_percent / 100, peep: v.peep, rr: v.rr_set,
      vtL, inspiratoryFlowLps: flowLps, inspiratoryPauseSec: 0,
    };
  }
  if (row.hummod_mode === 'PC_AC') {
    if (!finite(v.inspiratory_time_sec)) return null;
    return {
      mode: 'PC_AC', fio2: v.fio2_percent / 100, peep: v.peep, rr: v.rr_set,
      pinspCmH2O: v.pinsp, inspiratoryTimeSec: v.inspiratory_time_sec,
      inspiratoryPauseSec: 0,
    };
  }
  return null;
}

function mechanicsParams({
  stiffnessScale,
  centralResistance,
  consolidatedPerfusionFraction,
}) {
  const c = getBerlinCase(LIVE_HUMMOD_REFERENCE_CASE_ID);
  const p = JSON.parse(JSON.stringify(c.phenotype.mechanicsParams));
  for (const comp of p.compartments) comp.elasticScale *= stiffnessScale;
  p.centralAirwayResistance = centralResistance;

  // Model-native effective shunt phenotype: redistribute perfusion while
  // preserving total perfusion = 1. The consolidated compartment remains
  // nonventilated, so its perfusion is an explicit fixed-shunt burden. The
  // remaining perfusion keeps the reference normal:recruitable ratio (55:30).
  const qCon = consolidatedPerfusionFraction;
  const remaining = 1 - qCon;
  const qNormal = remaining * (55 / 85);
  const qRecruitable = remaining * (30 / 85);
  for (const comp of p.compartments) {
    if (comp.id === 'normal') comp.perfusionFraction = qNormal;
    else if (comp.id === 'recruitable') comp.perfusionFraction = qRecruitable;
    else if (comp.id === 'consolidated') comp.perfusionFraction = qCon;
  }
  return p;
}

function runCandidate(row, pars, fidelity = 'search') {
  const ventilation = ventilationFrom(row);
  if (!ventilation) return { error: 'unsupported-or-incomplete-controller-inputs' };
  const vtMl = row.hummod_mode === 'VC_AC'
    ? row.vent.vt_set_ml
    : (finite(row.targets.vt_observed_ml) ? row.targets.vt_observed_ml : 500);
  const dsMl = clamp(pars.deadSpaceFraction * vtMl, 20, Math.max(25, vtMl - 20));
  try {
    const session = createBerlinLiveHumModSession({
      caseId: LIVE_HUMMOD_REFERENCE_CASE_ID,
      ventilation,
      initialRecruitmentState: {
        normal: 1,
        recruitable: pars.baselineRecruitment,
        consolidated: 0,
      },
      patientMechanicsParams: mechanicsParams({
        stiffnessScale: pars.stiffnessScale,
        centralResistance: pars.centralResistance,
        consolidatedPerfusionFraction: pars.consolidatedPerfusionFraction,
      }),
      patientDeadSpaceBtpsMl: dsMl,
      patientArterialGasInitialization: {
        po2MmHg: row.targets.po2,
        pco2MmHg: row.targets.pco2,
        pH: row.targets.ph,
      },
      dt: fidelity === 'confirm' ? 0.004 : 0.01,
      mechanicalWarmupSec: 5,
      coupledEquilibrationSec: 0,
    });
    session.initialize();
    const s = session.runFor(fidelity === 'confirm' ? 16 : 6);
    const g = s.systemic.gasExchange;
    const b = s.pulmonary.measurements.lastValidDeliveredBreath ||
              s.pulmonary.measurements.lastCompletedBreath;
    if (!b) return { error: 'no-completed-breath' };
    return {
      pao2: g.pao2MmHg,
      paco2: g.paco2MmHg,
      ph: g.pH,
      sao2: g.sao2Fraction * 100,
      vtMl: b.VtInspired * 1000,
      minuteVolume: b.MV,
      peakPressure: b.Ppeak,
      deadSpaceMl: dsMl,
    };
  } catch (e) {
    return { error: e.message };
  }
}

function term(model, target, scale) {
  if (!finite(model) || !finite(target)) return 0;
  const z = (model - target) / scale;
  return z * z;
}

function scoreGas(out, t) {
  if (out.error) return 1e12;
  return (
    term(out.pao2, t.po2, 20) +
    term(out.paco2, t.pco2, 8)
  );
}

function scoreMechanics(out, t) {
  if (out.error) return 1e12;
  return (
    term(out.vtMl, t.vt_observed_ml, 75) +
    term(out.minuteVolume, t.minute_volume, 2) +
    term(out.peakPressure, t.peak_pressure, 5)
  );
}

function fitOne(row) {
  const prior = {
    stiffnessScale: 1,
    centralResistance: 3.5,
    baselineRecruitment: 0.35,
    consolidatedPerfusionFraction: 0.15,
    deadSpaceFraction: 0.35,
  };

  const grids = {
    consolidatedPerfusionFraction: [0.02, 0.08, 0.15, 0.25, 0.40, 0.55],
    deadSpaceFraction: [0.10, 0.25, 0.40, 0.55, 0.70, 0.82],
    stiffnessScale: [0.30, 0.50, 0.75, 1.00, 1.40, 2.00, 3.00],
    centralResistance: finite(row.targets.peak_pressure)
      ? [0.30, 0.80, 1.50, 3.50, 6.00, 10.00, 15.00]
      : [3.50],
  };

  function oxygenScore(out) {
    if (out.error) return 1e12;
    return term(out.pao2, row.targets.po2, 20);
  }
  function co2Score(out) {
    if (out.error) return 1e12;
    return term(out.paco2, row.targets.pco2, 8);
  }
  function volumeScore(out) {
    if (out.error) return 1e12;
    return (
      term(out.vtMl, row.targets.vt_observed_ml, 75) +
      term(out.minuteVolume, row.targets.minute_volume, 2)
    );
  }
  function pressureScore(out) {
    if (out.error) return 1e12;
    return term(out.peakPressure, row.targets.peak_pressure, 5);
  }
  function combinedScore(out) {
    if (out.error) return 1e12;
    return scoreMechanics(out, row.targets) + 0.35 * scoreGas(out, row.targets);
  }

  function optimizeOne(current, key, candidates, scorer, fidelity = 'search') {
    let best = null;
    for (const value of candidates) {
      const pars = { ...current, [key]: value };
      const out = runCandidate(row, pars, fidelity);
      const score = scorer(out);
      if (!best || score < best.score) best = { pars, out, score };
    }
    return best;
  }

  let current = { ...prior };
  current = optimizeOne(
    current, 'consolidatedPerfusionFraction', grids.consolidatedPerfusionFraction, oxygenScore
  ).pars;
  current = optimizeOne(
    current, 'deadSpaceFraction', grids.deadSpaceFraction, co2Score
  ).pars;
  current = optimizeOne(
    current, 'stiffnessScale', grids.stiffnessScale, volumeScore
  ).pars;
  current = optimizeOne(
    current, 'centralResistance', grids.centralResistance, pressureScore
  ).pars;

  // Mechanics changes alter delivered ventilation. Re-fit gas parameters once
  // after the mechanical state is selected.
  current = optimizeOne(
    current, 'consolidatedPerfusionFraction', grids.consolidatedPerfusionFraction, oxygenScore
  ).pars;
  current = optimizeOne(
    current, 'deadSpaceFraction', grids.deadSpaceFraction, co2Score
  ).pars;

  function neighbors(grid, value) {
    const i = grid.indexOf(value);
    const out = [];
    if (i > 0) out.push(grid[i - 1]);
    out.push(value);
    if (i >= 0 && i < grid.length - 1) out.push(grid[i + 1]);
    return [...new Set(out)];
  }

  if (DEEP_REFINE) {
    for (const key of [
      'stiffnessScale',
      'centralResistance',
      'consolidatedPerfusionFraction',
      'deadSpaceFraction',
    ]) {
      const refined = optimizeOne(
        current, key, neighbors(grids[key], current[key]), combinedScore, 'confirm'
      );
      current = refined.pars;
    }
  }

  const confirmedOut = runCandidate(row, current, 'confirm');
  const gasScore = scoreGas(confirmedOut, row.targets);
  const mechScore = scoreMechanics(confirmedOut, row.targets);
  const confirmedCombined = mechScore + 0.35 * gasScore;

  return {
    event_id: row.event_id,
    mode: row.hummod_mode,
    status: confirmedOut && !confirmedOut.error ? 'fit-complete' : 'fit-failed',
    fitted: {
      stiffness_scale: current.stiffnessScale,
      central_airway_resistance: current.centralResistance,
      baseline_recruitment_prior: current.baselineRecruitment,
      fixed_nonventilated_perfusion_fraction: current.consolidatedPerfusionFraction,
      dead_space_fraction_of_vt: current.deadSpaceFraction,
      dead_space_ml: confirmedOut && confirmedOut.deadSpaceMl,
    },
    residuals: confirmedOut && !confirmedOut.error ? {
      po2: confirmedOut.pao2 - row.targets.po2,
      pco2: confirmedOut.paco2 - row.targets.pco2,
      ph: confirmedOut.ph - row.targets.ph,
      spo2: finite(row.targets.spo2) ? confirmedOut.sao2 - row.targets.spo2 : null,
      vt_ml: finite(row.targets.vt_observed_ml) ? confirmedOut.vtMl - row.targets.vt_observed_ml : null,
      minute_volume: finite(row.targets.minute_volume) ? confirmedOut.minuteVolume - row.targets.minute_volume : null,
      peak_pressure: finite(row.targets.peak_pressure) ? confirmedOut.peakPressure - row.targets.peak_pressure : null,
    } : null,
    scores: {
      gas: gasScore,
      mechanics: mechScore,
      combined: confirmedCombined,
    },
    provenance: {
      fit_uses_post_index_data: false,
      gas_initialization: 'patient-pretransition-PaO2-PaCO2-fixed-SID',
      pH_used_in_fit_objective: false,
      search_method: DEEP_REFINE
        ? 'coordinate-grid-plus-high-fidelity-neighbor-refinement'
        : 'coordinate-grid-plus-single-high-fidelity-confirmation',
      search_runtime_dt_sec: 0.01,
      search_runtime_window_sec: 6,
      confirmation_runtime_dt_sec: 0.004,
      confirmation_runtime_window_sec: 16,
      shunt_direct_override: false,
    },
  };
}


function main() {
  const rows = fs.readFileSync(INPUT, 'utf8').trim().split('\n')
    .filter(Boolean).map(JSON.parse)
    .filter(r => ventilationFrom(r) != null)
    .slice(START_INDEX, START_INDEX + MAX_EVENTS);

  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const fitted = fitOne(rows[i]);
    out.push(fitted);
    process.stdout.write(
      `fit ${i + 1}/${rows.length} ${fitted.mode} ${fitted.status} gas=${fitted.scores.gas.toFixed(3)} mech=${fitted.scores.mechanics.toFixed(3)}\n`
    );
  }
  fs.writeFileSync(OUTPUT, out.map(x => JSON.stringify(x)).join('\n') + '\n');
  console.log('wrote', OUTPUT, 'events', out.length);
}

if (require.main === module) main();
module.exports = { ventilationFrom, runCandidate, fitOne, scoreGas, scoreMechanics };
