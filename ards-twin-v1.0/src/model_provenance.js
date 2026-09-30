'use strict';

const PROVENANCE_SCHEMA = 'vent-model-provenance/v1';

const PROVENANCE_CLASSES = Object.freeze([
  'HUMMOD_EXACT',
  'HUMMOD_ADAPTED',
  'LITERATURE_DIRECT',
  'LITERATURE_CALIBRATED',
  'ENGINEERING_ASSUMPTION',
  'SCENARIO_AUTHORED',
  'MEASURED_OR_USER_SUPPLIED',
  'DERIVED',
  'UNKNOWN',
]);

const PROVENANCE_KINDS = Object.freeze([
  'variable','constant','equation','condition','transition',
  'boundary','topology','interpolation','scenario',
]);

function record(value) {
  return Object.freeze({ clinicalValidation: false, dependsOn: Object.freeze([]), ...value });
}

const MODEL_PROVENANCE = Object.freeze({
  'live.thorax.reference_pleural_pressure': record({
    id:'live.thorax.reference_pleural_pressure', kind:'boundary',
    class:'ENGINEERING_ASSUMPTION',
    module:'clinical_twin_live_hummod_session.js',
    symbol:'LIVE_HUMMOD_ENGINEERING_BOUNDARIES.thorax.referencePleuralPressureCmH2O',
    description:'Reference pleural pressure for the live synthetic aspiration case.',
    source:Object.freeze([{type:'project',statement:'Explicit synthetic phase-1 thorax boundary; not inferred from Berlin severity or recruitability.'}]),
  }),
  'live.thorax.chest_wall_elastance_fraction': record({
    id:'live.thorax.chest_wall_elastance_fraction', kind:'boundary',
    class:'ENGINEERING_ASSUMPTION',
    module:'clinical_twin_live_hummod_session.js',
    symbol:'LIVE_HUMMOD_ENGINEERING_BOUNDARIES.thorax.chestWallElastanceFraction',
    description:'Fraction of passive respiratory-system elastance assigned to the chest wall.',
    source:Object.freeze([{type:'project',statement:'Explicit synthetic phase-1 thorax boundary.'}]),
  }),
  'live.metabolism.tissue_o2_use': record({
    id:'live.metabolism.tissue_o2_use', kind:'boundary',
    class:'ENGINEERING_ASSUMPTION',
    module:'clinical_twin_live_hummod_session.js',
    symbol:'LIVE_HUMMOD_ENGINEERING_BOUNDARIES.gas.systemic.tissueO2UseMlPerMin',
    description:'Whole-body oxygen-use boundary for the reduced acute gas core.',
    source:Object.freeze([{type:'project',statement:'Fixed phase-1 metabolic boundary; full HumMod tissue metabolism is not running.'}]),
  }),
  'hummod.breathing.dead_space_equation': record({
    id:'hummod.breathing.dead_space_equation', kind:'equation',
    class:'HUMMOD_EXACT', module:'hummod_ards_core_breathing.js',
    symbol:'humModLegacyDeadSpaceMl',
    description:'DeadSpace = 0.20 * TidalVolume + 60 mL.',
    source:Object.freeze([{type:'HumMod',repository:'riliescu/hummod-standalone',revision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',path:'Structure/Lungs/Breathing.DES',symbol:'Breathing.DeadSpace'}]),
  }),
  'hummod.bronchi.water_vapor_pressure': record({
    id:'hummod.bronchi.water_vapor_pressure', kind:'constant',
    class:'HUMMOD_EXACT', module:'hummod_ards_core_breathing.js',
    symbol:'BRONCHI_VAPOR_PRESSURE_MMHG',
    description:'Bronchial saturated water-vapor pressure boundary.',
    source:Object.freeze([{type:'HumMod',repository:'riliescu/hummod-standalone',revision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',path:'Structure/Lungs/Bronchi.DES',symbol:'Bronchi.VaporPressure'}]),
  }),
  'hummod.hemoglobin.p50_model': record({
    id:'hummod.hemoglobin.p50_model', kind:'equation',
    class:'HUMMOD_EXACT', module:'hummod_ards_core_chemistry.js',
    symbol:'hemoglobinProperties',
    description:'HumMod hemoglobin P50 response to temperature, pH, PCO2, and carboxyhemoglobin.',
    source:Object.freeze([{type:'HumMod',repository:'riliescu/hummod-standalone',revision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',path:'Structure/Hemoglobin/HgbProps.DES',symbol:'HgbProps.Setup'}]),
  }),
  'hummod.acid_base.ph_sid_pco2': record({
    id:'hummod.acid_base.ph_sid_pco2', kind:'equation',
    class:'HUMMOD_EXACT', module:'hummod_ards_core_chemistry.js',
    symbol:'phFromPco2Sid',
    description:'HumMod pH relation using pK + log10(SID/PCO2) with source boundary cases.',
    source:Object.freeze([{type:'HumMod',repository:'riliescu/hummod-standalone',revision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',path:'Structure/AcidBase/PhGeneral.DES',symbol:'PhGeneral.Calc'}]),
  }),
  'hummod.pulmonary_membrane.interpolation': record({
    id:'hummod.pulmonary_membrane.interpolation', kind:'interpolation',
    class:'HUMMOD_ADAPTED', module:'hummod_ards_core_pulmonary_membrane.js',
    symbol:'hermiteSegment',
    description:'Piecewise cubic Hermite interpolation across HumMod pulmonary-membrane recruitment points/slopes.',
    source:Object.freeze([
      {type:'HumMod',repository:'riliescu/hummod-standalone',revision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',path:'Structure/Lungs/PulmonaryMembrane.DES',symbol:'PulmonaryMembrane.Recruitment'},
      {type:'project',statement:'Interpolation algorithm is a browser implementation choice because the DES runtime interpolation was not independently reproduced.'},
    ]),
  }),
  'vent.mechanics.elastic_pressure_law': record({
    id:'vent.mechanics.elastic_pressure_law', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'compartments.js',
    symbol:'elasticPressureAboveAOP',
    description:'Finite-capacity exponential compartment elastic recoil law.',
    source:Object.freeze([{type:'project',statement:'Purpose-built Vent mechanical constitutive law; not derived from HumMod.'}]),
  }),
  'vent.recruitment.open_close_kinetics': record({
    id:'vent.recruitment.open_close_kinetics', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'recruitment.js',
    symbol:'recruitmentRate',
    description:'Bounded opening/closing recruitment kinetics with dead band.',
    source:Object.freeze([{type:'project',statement:'Purpose-built stateful recruitment kinetics; not a direct Chen R/I or HumMod equation.'}]),
  }),
  'vent.recruitment.condition.open': record({
    id:'vent.recruitment.condition.open', kind:'condition',
    class:'ENGINEERING_ASSUMPTION', module:'recruitment.js',
    symbol:'pDist > P_open',
    description:'Recruitment opening branch.',
    source:Object.freeze([{type:'project',statement:'Engineering branch condition; phenotype P_open is separately provenance-tagged.'}]),
  }),
  'vent.recruitment.condition.close': record({
    id:'vent.recruitment.condition.close', kind:'condition',
    class:'ENGINEERING_ASSUMPTION', module:'recruitment.js',
    symbol:'pDist < P_close',
    description:'Derecruitment closing branch.',
    source:Object.freeze([{type:'project',statement:'Engineering branch condition; phenotype P_close is separately provenance-tagged.'}]),
  }),
  'autonomic.target_map': record({
    id:'autonomic.target_map', kind:'boundary',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'targetMapMmHg',
    description:'Default MAP target driving the reduced baroreflex controller.',
    source:Object.freeze([{type:'project',statement:'Locally selected control target for the reduced browser controller; not a HumMod-preserved set point.'}]),
  }),
  'autonomic.autonomic_tau': record({
    id:'autonomic.autonomic_tau', kind:'constant',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'autonomicTauSec',
    description:'First-order lag time constant for sympathetic and parasympathetic tone.',
    source:Object.freeze([{type:'project',statement:'Locally authored controller time constant.'}]),
  }),
  'autonomic.vascular_tau': record({
    id:'autonomic.vascular_tau', kind:'constant',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'vascularTauSec',
    description:'First-order lag time constant for vascular responses.',
    source:Object.freeze([{type:'project',statement:'Locally authored controller time constant.'}]),
  }),
  'autonomic.cardiac_tau': record({
    id:'autonomic.cardiac_tau', kind:'constant',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'cardiacTauSec',
    description:'First-order lag time constant for chronotropic/inotropic responses.',
    source:Object.freeze([{type:'project',statement:'Locally authored controller time constant.'}]),
  }),
  'autonomic.hypoxic_drive_curve': record({
    id:'autonomic.hypoxic_drive_curve', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'hypoxicDrive = clamp((70 - PaO2) / 45, 0, 1)',
    description:'Reduced chemoreflex hypoxemia drive.',
    source:Object.freeze([{type:'project',statement:'Locally authored transfer function; not a source-preserved HumMod chemoreflex.'}]),
  }),
  'autonomic.hypercapnic_drive_curve': record({
    id:'autonomic.hypercapnic_drive_curve', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'hypercapnicDrive = clamp((PaCO2 - 45) / 35, 0, 1)',
    description:'Reduced chemoreflex hypercapnia drive before HCA calibration terms.',
    source:Object.freeze([{type:'project',statement:'Locally authored transfer function; separate from the literature-calibrated HCA anchor.'}]),
  }),
  'autonomic.reflex_target_equation': record({
    id:'autonomic.reflex_target_equation', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'reflexTarget',
    description:'Weighted MAP, hypoxemia, and hypercapnia drive used as sympathetic target.',
    source:Object.freeze([{type:'project',statement:'Locally authored control equation and weights.'}]),
    dependsOn:Object.freeze(['autonomic.baroreflex_gain','autonomic.hypoxic_drive_curve','autonomic.hypercapnic_drive_curve']),
  }),
  'autonomic.parasympathetic_target_equation': record({
    id:'autonomic.parasympathetic_target_equation', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'parasympathetic target',
    description:'Inverse reduced relation between sympathetic and parasympathetic tone.',
    source:Object.freeze([{type:'project',statement:'Locally authored relation and bounds.'}]),
  }),
  'autonomic.reflex_hr_equation': record({
    id:'autonomic.reflex_hr_equation', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'reflexHrTarget',
    description:'Chronotropic response to sympathetic and parasympathetic tone.',
    source:Object.freeze([{type:'project',statement:'Locally authored chronotropic coefficients and HR bounds.'}]),
  }),
  'autonomic.contractility_equation': record({
    id:'autonomic.contractility_equation', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'contractilityTarget',
    description:'Catecholamine-driven contractility multiplier and bounds.',
    source:Object.freeze([{type:'project',statement:'Locally authored inotropic transfer function; direct acidotic depression is separately literature-calibrated.'}]),
  }),
  'autonomic.systemic_conductance_equation': record({
    id:'autonomic.systemic_conductance_equation', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'reflexArterialConductanceTarget',
    description:'Sympathetic systemic arterial conductance response.',
    source:Object.freeze([{type:'project',statement:'Locally authored vascular transfer function.'}]),
  }),
  'autonomic.venous_v0_equation': record({
    id:'autonomic.venous_v0_equation', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'venousV0Target',
    description:'Sympathetic reduction in effective systemic venous unstressed volume.',
    source:Object.freeze([{type:'project',statement:'Locally authored venoconstriction rule and 14% coefficient.'}]),
  }),
  'autonomic.pulmonary_load_equation': record({
    id:'autonomic.pulmonary_load_equation', kind:'equation',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'pulmonaryLoad',
    description:'Pulmonary vascular load from positive thoracic pressure and hypoxemia.',
    source:Object.freeze([{type:'project',statement:'Locally authored pressure/hypoxemia transfer function; HCA multiplier is separately literature-calibrated.'}]),
  }),
  'autonomic.respiratory_acidosis_inotropy': record({
    id:'autonomic.respiratory_acidosis_inotropy', kind:'interpolation',
    class:'LITERATURE_CALIBRATED', module:'hummod_ards_autonomic_controller.js',
    symbol:'respiratoryAcidosisContractilityMultiplier',
    description:'Bounded interpolation of direct myocardial depression from respiratory acidosis.',
    source:Object.freeze([{type:'literature',citation:'Biais et al. Anesthesiology. 2012;117:1212-1222.',role:'isolated myocardial-force challenge anchor; interpolation and bounds are project-authored'}]),
  }),
  'autonomic.baroreflex_gain': record({
    id:'autonomic.baroreflex_gain', kind:'constant',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_autonomic_controller.js',
    symbol:'baroreflexGain',
    description:'Gain converting MAP error into reduced sympathetic-drive target.',
    source:Object.freeze([{type:'project',statement:'Locally authored control gain; controller is inspired by HumMod architecture but not a HumMod subsystem.'}]),
  }),
  'autonomic.hypercapnic_acidosis_anchor': record({
    id:'autonomic.hypercapnic_acidosis_anchor', kind:'boundary',
    class:'LITERATURE_CALIBRATED', module:'hummod_ards_autonomic_controller.js',
    symbol:'HYPERCAPNIC_ACIDOSIS_ANCHOR',
    description:'Experimental HCA anchor used to calibrate HR/SVR/PVR response.',
    source:Object.freeze([{type:'literature',citation:'Stengl et al. Critical Care. 2013;17:R303.',role:'experimental challenge anchor; project interpolation is not asserted as a universal human response'}]),
  }),
  'oxygen_supply.critical_extraction_curve': record({
    id:'oxygen_supply.critical_extraction_curve', kind:'interpolation',
    class:'LITERATURE_CALIBRATED', module:'hummod_ards_oxygen_supply_cliff.js',
    symbol:'criticalExtractionRatioForPaco2',
    description:'Bounded interpolation of critical oxygen-extraction ratio across published hypercapnia anchors.',
    source:Object.freeze([{type:'literature',citation:'Ward ME. Anesthesiology. 1996;85:817-822.',role:'experimental oxygen-transport anchors; interpolation is project-authored'}]),
  }),
  'decompensation.condition.profound_map_arrest': record({
    id:'decompensation.condition.profound_map_arrest', kind:'condition',
    class:'LITERATURE_CALIBRATED', module:'hummod_ards_decompensation_controller.js',
    symbol:'meanArterialPressureMmHg < PROFOUND_COLLAPSE_MAP_MMHG for PROFOUND_COLLAPSE_MAP_SEC',
    description:'Experimental profound-hypotension terminal condition used by the educational decompensation controller.',
    source:Object.freeze([{type:'literature',citation:'Gomez et al. collapse criterion as documented in module comments.',role:'experimental collapse anchor; not a patient-specific mortality rule'}]),
  }),
  'decompensation.transition.pea': record({
    id:'decompensation.transition.pea', kind:'transition',
    class:'ENGINEERING_ASSUMPTION', module:'hummod_ards_decompensation_controller.js',
    symbol:'cardiacArrest -> PEA',
    description:'Terminal transition used by reduced browser decompensation model.',
    source:Object.freeze([{type:'project',statement:'Educational/research terminal-state mapping; not a full HumMod rhythm model or validated human mortality prediction.'}]),
  }),
});

function validateProvenanceRecord(x) {
  if (!x || typeof x !== 'object') throw new Error('provenance record must be an object');
  for (const k of ['id','kind','class','module','symbol','description','source']) {
    if (x[k] == null || x[k] === '') throw new Error('provenance record missing ' + k);
  }
  if (!PROVENANCE_CLASSES.includes(x.class)) throw new Error('invalid provenance class: ' + x.class);
  if (!PROVENANCE_KINDS.includes(x.kind)) throw new Error('invalid provenance kind: ' + x.kind);
  if (!Array.isArray(x.source) || x.source.length === 0) throw new Error('provenance source must be non-empty');
  if (!Array.isArray(x.dependsOn)) throw new Error('dependsOn must be an array');
  return true;
}

function validateProvenanceRegistry(registry = MODEL_PROVENANCE) {
  for (const [id, x] of Object.entries(registry)) {
    validateProvenanceRecord(x);
    if (x.id !== id) throw new Error('provenance key/id mismatch: ' + id);
    for (const dep of x.dependsOn) {
      if (!registry[dep]) throw new Error(id + ' depends on unknown provenance id ' + dep);
    }
  }
  return true;
}

const LIVE_CLINICAL_PROVENANCE_IDS = Object.freeze([
  'live.thorax.reference_pleural_pressure',
  'live.thorax.chest_wall_elastance_fraction',
  'live.metabolism.tissue_o2_use',
  'hummod.breathing.dead_space_equation',
  'hummod.bronchi.water_vapor_pressure',
  'hummod.hemoglobin.p50_model',
  'hummod.acid_base.ph_sid_pco2',
  'hummod.pulmonary_membrane.interpolation',
  'vent.mechanics.elastic_pressure_law',
  'vent.recruitment.open_close_kinetics',
  'vent.recruitment.condition.open',
  'vent.recruitment.condition.close',
  'autonomic.target_map',
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
  'autonomic.baroreflex_gain',
  'autonomic.hypercapnic_acidosis_anchor',
  'oxygen_supply.critical_extraction_curve',
  'decompensation.condition.profound_map_arrest',
  'decompensation.transition.pea',
]);

function provenanceSummary(ids = LIVE_CLINICAL_PROVENANCE_IDS) {
  const records = ids.map(id => {
    if (!MODEL_PROVENANCE[id]) throw new Error('unknown provenance id: ' + id);
    return MODEL_PROVENANCE[id];
  });
  const byClass = {};
  for (const x of records) byClass[x.class] = (byClass[x.class] || 0) + 1;
  return Object.freeze({
    schema: PROVENANCE_SCHEMA,
    ids: Object.freeze(ids.slice()),
    countsByClass: Object.freeze(byClass),
    hasUnknown: records.some(x => x.class === 'UNKNOWN'),
    migrationCoverage: 'initial-live-path-registry-not-yet-complete',
  });
}

validateProvenanceRegistry();

module.exports = {
  PROVENANCE_SCHEMA,
  PROVENANCE_CLASSES,
  PROVENANCE_KINDS,
  MODEL_PROVENANCE,
  LIVE_CLINICAL_PROVENANCE_IDS,
  validateProvenanceRecord,
  validateProvenanceRegistry,
  provenanceSummary,
};