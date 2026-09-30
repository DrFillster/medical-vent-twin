'use strict';

const { MODEL_PROVENANCE } = require('./model_provenance.js');

const V11_RC_PROVENANCE_MANIFEST_SCHEMA = 'vent-v1.1-provenance-manifest/rc1';

const V11_RC_SUBSYSTEMS = Object.freeze({
  ventilatorMechanics: Object.freeze([
    'vent.mechanics.elastic_pressure_law',
    'vent.recruitment.open_close_kinetics',
    'vent.recruitment.condition.open',
    'vent.recruitment.condition.close',
    'vent.recruitment.defaults',
    'vent.recruitment.feasibility_projection',
  ]),
  ardsPhenotypes: Object.freeze([
    'ards.phenotype.baseline',
    'ards.phenotype.low_recruitability',
    'ards.phenotype.moderate_recruitability',
    'ards.phenotype.high_recruitability',
  ]),
  thorax: Object.freeze([
    'live.thorax.reference_pleural_pressure',
    'live.thorax.chest_wall_elastance_fraction',
    'thorax.static_elastance_partition',
  ]),
  circulation: Object.freeze([
    'hummod.hemodynamics.vascular_primitives',
    'hummod.hemodynamics.ventricular_pump',
    'live.circulation.reference_boundaries',
    'circulation.reduced_topology',
    'circulation.integration_substep',
    'circulation.mass_balance_derivatives',
    'circulation.negative_forward_flow_failure',
    'circulation.svr_derived',
    'circulation.pvr_derived',
  ]),
  autonomics: Object.freeze([
    'autonomic.target_map',
    'autonomic.baroreflex_gain',
    'autonomic.autonomic_tau',
    'autonomic.vascular_tau',
    'autonomic.cardiac_tau',
    'autonomic.hypoxic_drive_curve',
    'autonomic.hypercapnic_drive_curve',
    'autonomic.reflex_target_equation',
    'autonomic.parasympathetic_target_equation',
    'autonomic.reflex_hr_equation',
    'autonomic.contractility_equation',
    'autonomic.systemic_conductance_equation',
    'autonomic.venous_v0_equation',
    'autonomic.pulmonary_load_equation',
    'autonomic.respiratory_acidosis_inotropy',
    'autonomic.hypercapnic_acidosis_anchor',
  ]),
  gasExchange: Object.freeze([
    'live.metabolism.tissue_o2_use',
    'live.gas.reference_boundaries',
    'hummod.breathing.dead_space_equation',
    'hummod.bronchi.water_vapor_pressure',
    'hummod.hemoglobin.p50_model',
    'hummod.acid_base.ph_sid_pco2',
    'hummod.pulmonary_membrane.interpolation',
    'hummod.gas_exchange.oxygen_runtime',
    'hummod.gas_exchange.co2_runtime',
  ]),
  oxygenSupply: Object.freeze([
    'oxygen_supply.critical_extraction_curve',
    'oxygen_supply.delivery_equation',
    'oxygen_supply.critical_delivery_equation',
    'oxygen_supply.condition.supply_dependent',
  ]),
  decompensation: Object.freeze([
    'decompensation.low_svo2_marker',
    'decompensation.organ_flow_map_marker',
    'decompensation.oxygen_debt_integral',
    'decompensation.debt_calibration_minutes',
    'decompensation.myocardial_floor',
    'decompensation.condition.map30_duration',
    'decompensation.condition.profound_map_arrest',
    'decompensation.asphyxial_anchor',
    'decompensation.stage_classifier',
    'decompensation.transition.pea',
  ]),
});

const V11_RC_OUTPUT_PROVENANCE = Object.freeze({
  'systemic.gasExchange.pao2MmHg': Object.freeze(['hummod.gas_exchange.oxygen_runtime']),
  'systemic.gasExchange.paco2MmHg': Object.freeze(['hummod.gas_exchange.co2_runtime']),
  'systemic.gasExchange.pH': Object.freeze(['hummod.acid_base.ph_sid_pco2']),
  'systemic.gasExchange.sao2Fraction': Object.freeze(['hummod.hemoglobin.p50_model','hummod.gas_exchange.oxygen_runtime']),
  'systemic.gasExchange.pvo2MmHg': Object.freeze(['hummod.gas_exchange.oxygen_runtime','oxygen_supply.critical_delivery_equation']),
  'systemic.gasExchange.svo2Fraction': Object.freeze(['hummod.hemoglobin.p50_model','hummod.gas_exchange.oxygen_runtime']),
  'systemic.gasExchange.oxygenDeliveryMlPerMin': Object.freeze(['oxygen_supply.delivery_equation']),
  'systemic.gasExchange.criticalOxygenDeliveryMlPerMin': Object.freeze(['oxygen_supply.critical_delivery_equation']),
  'systemic.gasExchange.supplyDependent': Object.freeze(['oxygen_supply.condition.supply_dependent']),
  'systemic.hemodynamics.heartRatePerMin': Object.freeze(['autonomic.reflex_hr_equation','decompensation.stage_classifier']),
  'systemic.hemodynamics.meanArterialPressureMmHg': Object.freeze(['circulation.reduced_topology','hummod.hemodynamics.vascular_primitives']),
  'systemic.hemodynamics.cardiacOutputMlPerMin': Object.freeze(['hummod.hemodynamics.ventricular_pump','circulation.reduced_topology','circulation.negative_forward_flow_failure']),
  'systemic.hemodynamics.strokeVolumeMl': Object.freeze(['hummod.hemodynamics.ventricular_pump','circulation.negative_forward_flow_failure']),
  'systemic.hemodynamics.systemicVascularResistanceMmHgMinPerL': Object.freeze(['circulation.svr_derived']),
  'systemic.hemodynamics.pulmonaryVascularResistanceMmHgMinPerL': Object.freeze(['circulation.pvr_derived']),
  'systemic.hemodynamics.contractilityMultiplier': Object.freeze(['autonomic.contractility_equation','autonomic.respiratory_acidosis_inotropy','decompensation.stage_classifier']),
  'systemic.hemodynamics.sympatheticTone': Object.freeze(['autonomic.reflex_target_equation']),
  'systemic.hemodynamics.parasympatheticTone': Object.freeze(['autonomic.parasympathetic_target_equation']),
  'systemic.hemodynamics.catecholamineDrive': Object.freeze(['autonomic.reflex_target_equation','autonomic.cardiac_tau']),
  'systemic.thorax.pleuralPressureCmH2O': Object.freeze(['thorax.static_elastance_partition']),
  'systemic.thorax.transpulmonaryPressureCmH2O': Object.freeze(['thorax.static_elastance_partition']),
  'systemic.decompensation.stage': Object.freeze(['decompensation.stage_classifier']),
  'systemic.decompensation.cardiacArrest': Object.freeze(['decompensation.condition.map30_duration','decompensation.condition.profound_map_arrest','decompensation.asphyxial_anchor']),
  'systemic.decompensation.arrestRhythm': Object.freeze(['decompensation.transition.pea']),
  'systemic.decompensation.oxygenDebtMl': Object.freeze(['decompensation.oxygen_debt_integral']),
});

function allRequiredIds() {
  return Object.freeze(Array.from(new Set(Object.values(V11_RC_SUBSYSTEMS).flat())));
}

function validateV11RcProvenanceManifest() {
  const required = allRequiredIds();
  const missing = required.filter(id => !MODEL_PROVENANCE[id]);
  const unknown = required.filter(id => MODEL_PROVENANCE[id] && MODEL_PROVENANCE[id].class === 'UNKNOWN');
  const outputMissing = [];
  for (const [path, ids] of Object.entries(V11_RC_OUTPUT_PROVENANCE)) {
    for (const id of ids) if (!MODEL_PROVENANCE[id]) outputMissing.push(path + ' -> ' + id);
  }
  if (missing.length) throw new Error('v1.1 provenance manifest missing ids: ' + missing.join(', '));
  if (unknown.length) throw new Error('v1.1 provenance manifest contains UNKNOWN ids: ' + unknown.join(', '));
  if (outputMissing.length) throw new Error('v1.1 output provenance references missing ids: ' + outputMissing.join(', '));
  return Object.freeze({
    schema: V11_RC_PROVENANCE_MANIFEST_SCHEMA,
    releaseCandidate: '1.1.0-rc.1',
    requiredCount: required.length,
    unknownCount: 0,
    outputPathCount: Object.keys(V11_RC_OUTPUT_PROVENANCE).length,
    subsystems: Object.freeze(Object.keys(V11_RC_SUBSYSTEMS)),
    scope: 'live-clinical-physiology-model-elements-and-exported-monitor-outputs',
    note: 'Local temporary algebra variables inherit provenance from their tagged governing equation and dependencies.',
  });
}

module.exports = {
  V11_RC_PROVENANCE_MANIFEST_SCHEMA,
  V11_RC_SUBSYSTEMS,
  V11_RC_OUTPUT_PROVENANCE,
  allRequiredIds,
  validateV11RcProvenanceManifest,
};
