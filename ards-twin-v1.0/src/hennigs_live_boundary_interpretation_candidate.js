'use strict';

const SOURCE = Object.freeze({
  role: 'candidate live-boundary interpretation for Hennigs respiratory drive',
  authority: 'hennigs-supported',
  controlAuthority: true,
  assumptions: Object.freeze([
    'Use live arterial pH as the shared blood acid-base value for Hennigs BL3 brain CO2 conversion because the validation model publishes no separate brain pH state.',
    'Use live arterial O2 saturation as the BL3 virtual O2 saturation boundary because the validation model does not publish a separate brain virtual-saturation state.',
    'Use live arterial bicarbonate as the shared bicarbonate buffer for medullary Henderson-Hasselbalch conversion because the validation model publishes no separate medullary bicarbonate state.',
  ]),
  limitation:
    'These are explicit Hennigs-model interpretation assumptions. They are not source-exact; they are accepted as Hennigs-supported boundaries when the alternative is an invented physiologic state.',
});

function finite(v, label) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(label + ' must be finite');
  }
  return v;
}
function positive(v, label) {
  finite(v, label);
  if (!(v > 0)) throw new Error(label + ' must be > 0');
  return v;
}
function unitInterval(v, label) {
  finite(v, label);
  if (v < 0 || v > 1) throw new Error(label + ' must be in [0,1]');
  return v;
}

function interpretLiveHennigsBoundaries(systemic) {
  if (!systemic || typeof systemic !== 'object') {
    throw new Error('live systemic snapshot is required');
  }
  const gas = systemic.gasExchange || {};
  const hemo = systemic.hemodynamics || {};

  positive(gas.paco2MmHg, 'gasExchange.paco2MmHg');
  positive(gas.pao2MmHg, 'gasExchange.pao2MmHg');
  finite(gas.pH, 'gasExchange.pH');
  positive(
    gas.arterialHco3MmolPerL,
    'gasExchange.arterialHco3MmolPerL'
  );
  unitInterval(gas.sao2Fraction, 'gasExchange.sao2Fraction');
  positive(
    hemo.brainBloodFlowMlPerMin,
    'hemodynamics.brainBloodFlowMlPerMin'
  );

  return Object.freeze({
    arterialPco2MmHg: gas.paco2MmHg,
    arterialPo2MmHg: gas.pao2MmHg,
    arterialPh: gas.pH,
    arterialHco3MmolPerL: gas.arterialHco3MmolPerL,
    arterialO2SaturationFraction: gas.sao2Fraction,
    cerebralFlowLPerMin: hemo.brainBloodFlowMlPerMin / 1000,
    brainLocalState: Object.freeze({
      pH: gas.pH,
      virtualO2SaturationFraction: gas.sao2Fraction,
      interpretation:
        'shared circulating acid-base/O2 boundary; not a measured brain-local state',
    }),
    medullaryBicarbonateMmolPerL: gas.arterialHco3MmolPerL,
    sourceExact: false,
    authority: SOURCE.authority,
    controlAuthority: true,
    provenance: SOURCE,
  });
}

module.exports = Object.freeze({
  SOURCE,
  interpretLiveHennigsBoundaries,
});
