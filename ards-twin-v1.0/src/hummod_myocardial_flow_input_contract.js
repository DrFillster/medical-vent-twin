'use strict';

// Prerequisite audit for source-aligned HumMod myocardial-flow solving.
// This module does not supply defaults. It records which upstream states must
// exist before solveMyocardialFlow() can be used in the live runtime.

const REQUIRED_FIELDS=Object.freeze([
  'arterialPo2MmHg',
  'pressureGradientMmHg',
  'alphaReceptorActivity',
  'adhPoolLog10Conc',
  'o2NeedMlPerMin',
  'viscosityConductanceEffect',
  'anesthesiaVascularConductance',
  'vasculatureEffect',
  'infarctionEffect',
  'arterialO2ContentMlPerMl',
  'o2MaxMlPerMl',
  'hgbP50',
  'hgbScaleForSat',
  'plasmaVolumeFraction',
]);

const CURRENT_AVAILABILITY=Object.freeze({
  arterialPo2MmHg:
    'available from reduced HumMod gas runtime arterial gas state',
  pressureGradientMmHg:
    'derivable from reduced circulation systemic arterial and left atrial pressures',
  alphaReceptorActivity:
    'available from source-aligned autonomic/cardiac alpha pathway only if explicitly exported',
  adhPoolLog10Conc:
    'ADH storage/secretion/clearance primitives transcribed; live osmolality/CNS/ECFV/regional-flow state not coupled',
  o2NeedMlPerMin:
    'myocardial metabolism primitive transcribed; live myocardial mass/metabolic inputs incomplete',
  viscosityConductanceEffect:
    'missing live HumMod blood-viscosity conductance state',
  anesthesiaVascularConductance:
    'missing explicit live anesthesia vascular state',
  vasculatureEffect:
    'missing explicit live myocardial vasculature state',
  infarctionEffect:
    'missing explicit live myocardial infarction state',
  arterialO2ContentMlPerMl:
    'available from reduced HumMod gas runtime arterial state',
  o2MaxMlPerMl:
    'available from reduced HumMod gas/blood boundary when Hgb state is active',
  hgbP50:
    'available from reduced HumMod arterial hemoglobin calculation',
  hgbScaleForSat:
    'not currently exported from reduced gas snapshot',
  plasmaVolumeFraction:
    'plasma-volume primitive transcribed; live RBC-water/blood-volume state not source-complete in reduced core',
});

function auditMyocardialFlowInputs(inputs){
  if(inputs==null||typeof inputs!=='object'||Array.isArray(inputs)) inputs={};
  const missing=[], invalid=[];
  for(const field of REQUIRED_FIELDS){
    const v=inputs[field];
    if(v==null) missing.push(field);
    else if(typeof v!=='number'||!Number.isFinite(v)) invalid.push(field);
  }
  const complete=missing.length===0&&invalid.length===0;
  return Object.freeze({
    complete,
    missing:Object.freeze(missing),
    invalid:Object.freeze(invalid),
    requiredFields:REQUIRED_FIELDS,
    currentAvailability:CURRENT_AVAILABILITY,
    status:complete
      ? 'HumMod-myocardial-flow-inputs-complete'
      : 'blocked-missing-HumMod-myocardial-flow-upstream-state',
    fixedCoronaryFractionSubstitutionAllowed:false,
    nominalHormoneBackfillAllowed:false,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  REQUIRED_FIELDS,
  CURRENT_AVAILABILITY,
  auditMyocardialFlowInputs,
});
