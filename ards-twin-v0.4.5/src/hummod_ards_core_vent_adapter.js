'use strict';

const { humModLegacyDeadSpaceMl } = require('./hummod_ards_core_breathing.js');
const { createVentToArdsCoreSnapshot } = require('./hummod_ards_core_coupling.js');

function finite(v, label) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(label + ' must be a finite number');
  }
  return v;
}

function positive(v, label) {
  finite(v, label);
  if (!(v > 0)) throw new Error(label + ' must be > 0');
  return v;
}

function deriveVentilatedPulmonaryFlowMlPerMin({
  simulation,
  cardiacOutputMlPerMin,
} = {}) {
  positive(cardiacOutputMlPerMin, 'cardiacOutputMlPerMin');

  const perfusionById = Object.fromEntries(
    simulation.params.compartments.map(cp => [cp.id, cp.perfusionFraction])
  );

  let totalPerfusion = 0;
  let ventilatedPerfusion = 0;
  for (const compartment of simulation.state.compartments) {
    const perfusion = perfusionById[compartment.id];
    finite(perfusion, 'perfusion fraction ' + compartment.id);
    totalPerfusion += perfusion;
    ventilatedPerfusion += perfusion * compartment.recruitment;
  }

  if (!(totalPerfusion > 0)) throw new Error('total perfusion fraction must be > 0');

  const fraction = Math.max(0, Math.min(1, ventilatedPerfusion / totalPerfusion));
  return Object.freeze({
    ventilatedPerfusionFraction: fraction,
    ventilatedPulmonaryBloodFlowMlPerMin: cardiacOutputMlPerMin * fraction,
  });
}

function createLiveCoreBoundaryFromVent({
  simulation,
  systemic,
  pulmonary,
  blood,
  environment,
} = {}) {
  if (!simulation) throw new Error('simulation is required');
  if (!systemic || !pulmonary || !blood || !environment) {
    throw new Error('systemic, pulmonary, blood, and environment boundaries are required');
  }

  const snap = createVentToArdsCoreSnapshot(simulation);
  if (snap.ventilator.mode !== 'VC_AC') {
    throw new Error('phase-1 live core adapter currently supports VC_AC only');
  }

  const vtL = snap.ventilator.settings.vt;
  positive(vtL, 'VC tidal volume');

  const flow = deriveVentilatedPulmonaryFlowMlPerMin({
    simulation,
    cardiacOutputMlPerMin: systemic.cardiacOutputMlPerMin,
  });

  return Object.freeze({
    boundary: Object.freeze({
      ventilation: Object.freeze({
        respiratoryRatePerMin: snap.ventilator.rrPerMin,
        tidalVolumeBtpsMl: vtL * 1000,
        deadSpaceBtpsMl: pulmonary.deadSpaceBtpsMl == null
          ? humModLegacyDeadSpaceMl(vtL * 1000)
          : pulmonary.deadSpaceBtpsMl,
        fio2: snap.ventilator.fio2,
      }),
      pulmonary: Object.freeze({
        membranePermeabilityMlPerMinPerMmHg:
          pulmonary.membranePermeabilityMlPerMinPerMmHg,
        ventilatedPulmonaryBloodFlowMlPerMin:
          flow.ventilatedPulmonaryBloodFlowMlPerMin,
      }),
      circulation: Object.freeze({
        cardiacOutputMlPerMin: systemic.cardiacOutputMlPerMin,
      }),
      metabolism: Object.freeze({
        tissueO2UseMlPerMin: systemic.tissueO2UseMlPerMin,
        tissueCo2ProductionMmolPerMin: systemic.tissueCo2ProductionMmolPerMin,
      }),
      blood: Object.freeze({
        sidMolPerL: blood.sidMolPerL,
        o2MaxMlPerMl: blood.o2MaxMlPerMl,
        tempC: blood.tempC,
        carboxyPercent: blood.carboxyPercent || 0,
      }),
      environment: Object.freeze({
        barometricPressureMmHg: environment.barometricPressureMmHg,
        inspiredCo2Fraction: environment.inspiredCo2Fraction || 0,
      }),
    }),
    diagnostics: Object.freeze({
      ventilatedPerfusionFraction: flow.ventilatedPerfusionFraction,
      source: 'Vent compartment perfusionFraction x current recruitment',
      deadSpaceSource: pulmonary.deadSpaceBtpsMl == null
        ? 'HumMod Breathing.DES legacy equation'
        : 'explicit-boundary',
      hemodynamicCoupling: 'not-yet-enabled-without-pleural-pressure-model',
    }),
  });
}

module.exports = {
  deriveVentilatedPulmonaryFlowMlPerMin,
  createLiveCoreBoundaryFromVent,
};
