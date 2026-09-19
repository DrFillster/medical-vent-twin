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

const HUMMOD_BASIC_RIGHT_LEFT_SHUNT_ML_PER_MIN = 220;

function deriveVentilatedPulmonaryFlowMlPerMin({
  simulation,
  cardiacOutputMlPerMin,
  basicRightLeftShuntMlPerMin =
    HUMMOD_BASIC_RIGHT_LEFT_SHUNT_ML_PER_MIN,
} = {}) {
  positive(cardiacOutputMlPerMin, 'cardiacOutputMlPerMin');
  finite(basicRightLeftShuntMlPerMin, 'basicRightLeftShuntMlPerMin');
  if (basicRightLeftShuntMlPerMin < 0) {
    throw new Error('basicRightLeftShuntMlPerMin must be >= 0');
  }

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

  // HumMod LungBloodFlow.DES:
  //   Right-LeftShunt = BasicR-LShunt MIN Total
  //   Alveolar = Total - Right-LeftShunt
  //   AlveolarVentilated = alveolar flow * lung-inflation fraction
  //
  // Vent supplies the regional inflation/perfusion fraction because the
  // reduced core does not run HumMod's bilateral hemithorax model.
  const rightLeftShuntMlPerMin = Math.min(
    basicRightLeftShuntMlPerMin,
    cardiacOutputMlPerMin);
  const alveolarPulmonaryBloodFlowMlPerMin =
    cardiacOutputMlPerMin - rightLeftShuntMlPerMin;
  const ventilatedPulmonaryBloodFlowMlPerMin =
    alveolarPulmonaryBloodFlowMlPerMin * fraction;
  const alveolarShuntMlPerMin =
    alveolarPulmonaryBloodFlowMlPerMin -
    ventilatedPulmonaryBloodFlowMlPerMin;
  const totalShuntMlPerMin =
    rightLeftShuntMlPerMin + alveolarShuntMlPerMin;

  return Object.freeze({
    ventilatedPerfusionFraction: fraction,
    totalPulmonaryBloodFlowMlPerMin: cardiacOutputMlPerMin,
    rightLeftShuntMlPerMin,
    alveolarPulmonaryBloodFlowMlPerMin,
    ventilatedPulmonaryBloodFlowMlPerMin,
    alveolarShuntMlPerMin,
    totalShuntMlPerMin,
    humModSource:
      'Structure/Lungs/LungBloodFlow.DES@8dab57e05631f779bf5020fe0dd51874d8ae98c1',
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
      rightLeftShuntMlPerMin: flow.rightLeftShuntMlPerMin,
      alveolarPulmonaryBloodFlowMlPerMin:
        flow.alveolarPulmonaryBloodFlowMlPerMin,
      alveolarShuntMlPerMin: flow.alveolarShuntMlPerMin,
      totalShuntMlPerMin: flow.totalShuntMlPerMin,
      source:
        'HumMod LungBloodFlow basic R-L shunt + Vent compartment perfusionFraction x current recruitment',
      deadSpaceSource: pulmonary.deadSpaceBtpsMl == null
        ? 'HumMod Breathing.DES legacy equation'
        : 'explicit-boundary',
      hemodynamicCoupling: 'not-yet-enabled-without-pleural-pressure-model',
    }),
  });
}

module.exports = {
  HUMMOD_BASIC_RIGHT_LEFT_SHUNT_ML_PER_MIN,
  deriveVentilatedPulmonaryFlowMlPerMin,
  createLiveCoreBoundaryFromVent,
};
