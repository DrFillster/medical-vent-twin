'use strict';

const REQUIRED = Object.freeze([
  Object.freeze({
    key: 'arterialGasState',
    label: 'Arterial PaCO2 / PaO2 / pH',
    source: 'live reduced-HumMod gas state',
  }),
  Object.freeze({
    key: 'cerebralFlow',
    label: 'Cerebral blood flow',
    source: 'HumMod Brain-Flow bloodFlowMlPerMin',
  }),
  Object.freeze({
    key: 'brainCo2LocalState',
    label: 'Brain CO2 local acid-base/O2 state for BL3 inversion',
    source: 'Hennigs GE7/BL3',
  }),
  Object.freeze({
    key: 'medullaryAcidBase',
    label: 'Medullary bicarbonate / acid-base boundary',
    source: 'Hennigs BL2/GE8/GE9',
  }),
  Object.freeze({
    key: 'peripheralCo2PhGain',
    label: 'Peripheral CO2-pH gain G_CO2,pH',
    source: 'Hennigs RC1',
  }),
  Object.freeze({
    key: 'effortMechanics',
    label: 'Pmus-to-Vent mechanics bridge',
    source: 'Hennigs Eq.16-17 + Vent mechanics',
  }),
  Object.freeze({
    key: 'mechanicalReflexes',
    label: 'Hering-Breuer and inspiratory-flow feedback',
    source: 'Hennigs RC4-RC5',
  }),
  Object.freeze({
    key: 'psController',
    label: 'Flow-triggered pressure support / CPAP controller',
    source: 'Hennigs ventilator Eqs.23-27',
  }),
  Object.freeze({
    key: 'simvController',
    label: 'Mandatory + spontaneous SIMV controller',
    source: 'candidate IMV-PC/PS bridge',
  }),
]);

function finite(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function assessSpontaneousModeReadiness({
  systemic,
  brainLocalState = null,
  medullaryBicarbonateMmolPerL = null,
  gPco2Ph = null,
  components = {},
  boundaryAuthority = 'source-exact',
  gainAuthority = 'source-exact',
} = {}) {
  const gas = systemic && systemic.gasExchange ? systemic.gasExchange : {};
  const hemo = systemic && systemic.hemodynamics ? systemic.hemodynamics : {};

  const status = {
    arterialGasState:
      finite(gas.paco2MmHg) &&
      finite(gas.pao2MmHg) &&
      finite(gas.pH),
    cerebralFlow:
      finite(hemo.brainBloodFlowMlPerMin) &&
      hemo.brainBloodFlowMlPerMin > 0,
    brainCo2LocalState:
      Boolean(
        brainLocalState &&
        finite(brainLocalState.pH) &&
        finite(brainLocalState.virtualO2SaturationFraction)
      ),
    medullaryAcidBase:
      finite(medullaryBicarbonateMmolPerL) &&
      medullaryBicarbonateMmolPerL > 0,
    peripheralCo2PhGain:
      finite(gPco2Ph) && gPco2Ph >= 0,
    effortMechanics:
      components.effortMechanics === true,
    mechanicalReflexes:
      components.mechanicalReflexes === true,
    psController:
      components.psController === true,
    simvController:
      components.simvController === true,
  };

  const shadowRunnable = [
    'arterialGasState',
    'cerebralFlow',
    'brainCo2LocalState',
    'medullaryAcidBase',
    'peripheralCo2PhGain',
    'effortMechanics',
    'mechanicalReflexes',
    'psController',
  ].every(key => status[key]);

  const sourceAuthorityReady =
    boundaryAuthority === 'source-exact' && gainAuthority === 'source-exact';
  const hennigsAuthorityReady =
    ['source-exact', 'hennigs-supported'].includes(boundaryAuthority) &&
    ['source-exact', 'hennigs-supported'].includes(gainAuthority);

  const checks = REQUIRED.map(item => Object.freeze({
    ...item,
    ready: status[item.key],
  }));

  const blockers = checks
    .filter(check => !check.ready)
    .map(check => Object.freeze({
      key: check.key,
      label: check.label,
      source: check.source,
    }));

  const psReady = shadowRunnable && hennigsAuthorityReady;

  const simvReady =
    psReady && status.simvController;

  const availableBoundaries = Object.freeze({
    arterialPaco2MmHg: finite(gas.paco2MmHg) ? gas.paco2MmHg : null,
    arterialPao2MmHg: finite(gas.pao2MmHg) ? gas.pao2MmHg : null,
    arterialPh: finite(gas.pH) ? gas.pH : null,
    arterialHco3MmolPerL:
      finite(gas.arterialHco3MmolPerL) ? gas.arterialHco3MmolPerL : null,
    brainBloodFlowMlPerMin:
      finite(hemo.brainBloodFlowMlPerMin) ? hemo.brainBloodFlowMlPerMin : null,
  });

  return Object.freeze({
    schema: 'vent-spontaneous-mode-readiness/v1',
    shadowRunnable,
    sourceAuthorityReady,
    hennigsAuthorityReady,
    boundaryAuthority,
    gainAuthority,
    psCpapReady: psReady,
    simvReady,
    publicActivationAllowed: psReady && simvReady,
    availableBoundaries,
    checks: Object.freeze(checks),
    blockers: Object.freeze(blockers),
  });
}

module.exports = Object.freeze({
  REQUIRED,
  assessSpontaneousModeReadiness,
});
