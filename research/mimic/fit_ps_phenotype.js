'use strict';

const fs = require('fs');
const {
  LIVE_HUMMOD_REFERENCE_CASE_ID,
  createBerlinLiveHumModSession,
} = require('../../ards-twin-v1.0/src/clinical_twin_live_hummod_session.js');
const { getBerlinCase } = require('../../ards-twin-v1.0/src/berlin_case_catalog.js');

const INPUT = '/Users/philipbernard/mimic-data/derived/ps_fit_inputs.jsonl';
const OUTPUT = process.env.OUTPUT ||
  '/Users/philipbernard/mimic-data/derived/ps_fit_results.jsonl';
const START_INDEX = Number(process.env.START_INDEX || 0);
const MAX_EVENTS = Number(process.env.MAX_EVENTS || 5);

const PROFILES = [
  'passive_paralyzed',
  'sedated_breathing',
  'awake_cooperative',
  'agitated_high_drive',
];

function finite(x) { return typeof x === 'number' && Number.isFinite(x); }
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

function mechanicsParams({
  stiffnessScale,
  centralResistance,
  consolidatedPerfusionFraction,
}) {
  const c = getBerlinCase(LIVE_HUMMOD_REFERENCE_CASE_ID);
  const p = JSON.parse(JSON.stringify(c.phenotype.mechanicsParams));
  for (const comp of p.compartments) comp.elasticScale *= stiffnessScale;
  p.centralAirwayResistance = centralResistance;

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
  const v = row.vent;
  const vtForDeadSpace = finite(row.targets.vt_observed_ml)
    ? row.targets.vt_observed_ml
    : 500;
  const dsMl = clamp(
    pars.deadSpaceFraction * vtForDeadSpace,
    20,
    Math.max(25, vtForDeadSpace - 20)
  );

  try {
    const session = createBerlinLiveHumModSession({
      caseId: LIVE_HUMMOD_REFERENCE_CASE_ID,
      ventilation: {
        mode: 'PS',
        fio2: v.fio2_percent / 100,
        peep: v.peep,
        rr: v.backup_rate_prior,
        pressureSupportCmH2O: v.pressure_support,
      },
      initialRecruitmentState: {
        normal: 1,
        recruitable: 0.35,
        consolidated: 0,
      },
      patientStateProfile: pars.effortProfile,
      patientDriveRelativeOverride: pars.driveRelative,
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
      mechanicalWarmupSec: 8,
      coupledEquilibrationSec: 0,
    });
    session.initialize();
    const s = session.runFor(fidelity === 'confirm' ? 24 : 12);
    const b = s.pulmonary.measurements.lastValidDeliveredBreath ||
              s.pulmonary.measurements.lastCompletedBreath;
    if (!b) return { error: 'no-completed-breath' };
    return {
      rr: finite(s.ventilator.rrPerMin) ? s.ventilator.rrPerMin : b.RR,
      breathRr: b.RR,
      vtMl: b.VtInspired * 1000,
      minuteVolume: b.MV,
      peakPressure: b.Ppeak,
      pao2: s.systemic.gasExchange.pao2MmHg,
      paco2: s.systemic.gasExchange.paco2MmHg,
      ph: s.systemic.gasExchange.pH,
      sao2: s.systemic.gasExchange.sao2Fraction * 100,
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

function targetRr(t) {
  if (finite(t.rr_total)) return t.rr_total;
  if (finite(t.rr_spontaneous)) return t.rr_spontaneous;
  return null;
}

function effortScore(out, t) {
  if (out.error) return 1e12;
  return (
    term(out.rr, targetRr(t), 4) +
    term(out.vtMl, t.vt_observed_ml, 100) +
    term(out.minuteVolume, t.minute_volume, 2.5)
  );
}

function gasScore(out, t) {
  if (out.error) return 1e12;
  return (
    term(out.pao2, t.po2, 20) +
    term(out.paco2, t.pco2, 8)
  );
}

function fitOne(row) {
  let current = {
    effortProfile: 'awake_cooperative',
    driveRelative: 0.09686299285820986,
    stiffnessScale: 1,
    centralResistance:
      finite(row.targets.resistance) && row.targets.resistance > 0
        ? clamp(row.targets.resistance, 0.3, 15)
        : 3.5,
    consolidatedPerfusionFraction: 0.15,
    deadSpaceFraction: 0.35,
  };

  function chooseProfile(pars, fidelity='search') {
    let best = null;
    for (const effortProfile of PROFILES) {
      const candidate = { ...pars, effortProfile };
      const out = runCandidate(row, candidate, fidelity);
      const score = effortScore(out, row.targets);
      if (!best || score < best.score) best = { pars: candidate, out, score };
    }
    return best;
  }

  function chooseNumeric(pars, key, values, scorer) {
    let best = null;
    for (const value of values) {
      const candidate = { ...pars, [key]: value };
      const out = runCandidate(row, candidate, 'search');
      const score = scorer(out);
      if (!best || score < best.score) best = { pars: candidate, out, score };
    }
    return best;
  }

  current = chooseNumeric(
    current,
    'driveRelative',
    [0.09686299285820986,0.18,0.30,0.45,0.60,0.78,0.95,1.10],
    out => out.error ? 1e12 : term(out.rr,targetRr(row.targets),4)
  ).pars;

  current = chooseProfile(current).pars;

  current = chooseNumeric(
    current,
    'stiffnessScale',
    [0.30, 0.50, 0.75, 1.0, 1.4, 2.0, 3.0],
    out => effortScore(out, row.targets)
  ).pars;

  // Re-select transmission profile and drive after mechanics changes because
  // mechanical feedback can alter the realized breathing pattern.
  current = chooseProfile(current).pars;
  current = chooseNumeric(
    current,
    'driveRelative',
    [0.09686299285820986,0.18,0.30,0.45,0.60,0.78,0.95,1.10],
    out => effortScore(out,row.targets)
  ).pars;

  current = chooseNumeric(
    current,
    'consolidatedPerfusionFraction',
    [0.02, 0.08, 0.15, 0.25, 0.40, 0.55],
    out => out.error ? 1e12 : term(out.pao2, row.targets.po2, 20)
  ).pars;

  current = chooseNumeric(
    current,
    'deadSpaceFraction',
    [0.10, 0.25, 0.40, 0.55, 0.70, 0.82],
    out => out.error ? 1e12 : term(out.paco2, row.targets.pco2, 8)
  ).pars;

  const confirmed = runCandidate(row, current, 'confirm');
  const eScore = effortScore(confirmed, row.targets);
  const gScore = gasScore(confirmed, row.targets);

  return {
    event_id: row.event_id,
    status: confirmed && !confirmed.error ? 'fit-complete' : 'fit-failed',
    runtime_error: confirmed && confirmed.error ? confirmed.error : null,
    fitted: {
      effort_profile: current.effortProfile,
      hennigs_drive_relative: current.driveRelative,
      stiffness_scale: current.stiffnessScale,
      central_airway_resistance: current.centralResistance,
      fixed_nonventilated_perfusion_fraction:
        current.consolidatedPerfusionFraction,
      dead_space_fraction_of_vt: current.deadSpaceFraction,
      dead_space_ml: confirmed && confirmed.deadSpaceMl,
    },
    residuals: confirmed && !confirmed.error ? {
      rr: finite(targetRr(row.targets))
        ? confirmed.rr - targetRr(row.targets)
        : null,
      vt_ml: finite(row.targets.vt_observed_ml)
        ? confirmed.vtMl - row.targets.vt_observed_ml
        : null,
      minute_volume: finite(row.targets.minute_volume)
        ? confirmed.minuteVolume - row.targets.minute_volume
        : null,
      po2: confirmed.pao2 - row.targets.po2,
      pco2: confirmed.paco2 - row.targets.pco2,
      ph: confirmed.ph - row.targets.ph,
      spo2: finite(row.targets.spo2)
        ? confirmed.sao2 - row.targets.spo2
        : null,
    } : null,
    scores: {
      effort: eScore,
      gas: gScore,
      combined: eScore + 0.35 * gScore,
    },
    provenance: {
      fit_uses_post_index_data: false,
      effort_profiles: PROFILES,
      backup_rate_per_min_prior: row.vent.backup_rate_prior,
      flow_trigger_l_min_prior: 1.5,
      cycle_off_fraction_prior: 0.25,
      rise_time_sec_prior: 0.1,
      pH_used_in_fit_objective: false,
      gas_initialization: 'patient-pretransition-PaO2-PaCO2-fixed-SID',
      search_runtime_dt_sec: 0.01,
      confirmation_runtime_dt_sec: 0.004,
    },
  };
}

function main() {
  const rows = fs.readFileSync(INPUT, 'utf8').trim().split('\n')
    .filter(Boolean).map(JSON.parse)
    .slice(START_INDEX, START_INDEX + MAX_EVENTS);

  const out = [];
  for (let i=0; i<rows.length; i++) {
    const fitted = fitOne(rows[i]);
    out.push(fitted);
    process.stdout.write(
      `fit ${i+1}/${rows.length} ${fitted.fitted.effort_profile} ` +
      `effort=${fitted.scores.effort.toFixed(3)} gas=${fitted.scores.gas.toFixed(3)}\n`
    );
  }
  fs.writeFileSync(OUTPUT, out.map(x => JSON.stringify(x)).join('\n')+'\n');
  console.log('wrote', OUTPUT, 'events', out.length);
}

if (require.main === module) main();
module.exports = { runCandidate, fitOne, effortScore, gasScore };
