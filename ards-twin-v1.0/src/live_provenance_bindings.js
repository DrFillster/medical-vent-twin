'use strict';

// Parallel provenance bindings for live clinical runtime values.
// Values remain plain numbers/booleans for solver performance; this map
// provides stable provenance IDs without wrapping numeric state.

const LIVE_VALUE_PROVENANCE = Object.freeze({
  engineeringBoundaries: Object.freeze({
    thorax: Object.freeze({
      referencePleuralPressureCmH2O: 'live.thorax.reference_pleural_pressure',
      chestWallElastanceFraction: 'live.thorax.chest_wall_elastance_fraction',
    }),
    gas: Object.freeze({
      systemic: Object.freeze({
        tissueO2UseMlPerMin: 'live.metabolism.tissue_o2_use',
      }),
    }),
  }),
  autonomic: Object.freeze({
    targetMapMmHg: 'autonomic.target_map',
    baroreflexGain: 'autonomic.baroreflex_gain',
    autonomicTauSec: 'autonomic.autonomic_tau',
    vascularTauSec: 'autonomic.vascular_tau',
    cardiacTauSec: 'autonomic.cardiac_tau',
    hypoxicDrive: 'autonomic.hypoxic_drive_curve',
    hypercapnicDrive: 'autonomic.hypercapnic_drive_curve',
    reflexTarget: 'autonomic.reflex_target_equation',
    parasympatheticTarget: 'autonomic.parasympathetic_target_equation',
    reflexHrTarget: 'autonomic.reflex_hr_equation',
    contractilityTarget: 'autonomic.contractility_equation',
    systemicArterialConductanceTarget: 'autonomic.systemic_conductance_equation',
    systemicVenousV0Target: 'autonomic.venous_v0_equation',
    pulmonaryLoad: 'autonomic.pulmonary_load_equation',
    respiratoryAcidosisContractility: 'autonomic.respiratory_acidosis_inotropy',
    hypercapnicAcidosisAnchor: 'autonomic.hypercapnic_acidosis_anchor',
  }),
  runtime: Object.freeze({
    deadSpaceBtpsMl: 'hummod.breathing.dead_space_equation',
    bronchialWaterVaporPressureMmHg: 'hummod.bronchi.water_vapor_pressure',
    arterialPh: 'hummod.acid_base.ph_sid_pco2',
    hemoglobinP50MmHg: 'hummod.hemoglobin.p50_model',
  }),
});

const LIVE_CONDITION_PROVENANCE = Object.freeze({
  recruitmentOpening: 'vent.recruitment.condition.open',
  recruitmentClosing: 'vent.recruitment.condition.close',
  profoundMapArrest: 'decompensation.condition.profound_map_arrest',
  peaTransition: 'decompensation.transition.pea',
});

function flattenBindings(value, prefix = '', out = []) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? prefix + '.' + key : key;
    if (typeof child === 'string') out.push(Object.freeze({ path, provenanceId: child }));
    else flattenBindings(child, path, out);
  }
  return out;
}

function liveProvenanceBindings() {
  return Object.freeze({
    values: Object.freeze(flattenBindings(LIVE_VALUE_PROVENANCE)),
    conditions: Object.freeze(flattenBindings(LIVE_CONDITION_PROVENANCE)),
  });
}

module.exports = {
  LIVE_VALUE_PROVENANCE,
  LIVE_CONDITION_PROVENANCE,
  liveProvenanceBindings,
};
