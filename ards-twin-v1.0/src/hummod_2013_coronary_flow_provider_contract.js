'use strict';

const REQUIRED_FIELDS=Object.freeze([
  'arterialPo2MmHg',
  'initialLeftHeartMassG',
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

const STATUS=Object.freeze({
  SOURCE_COMPLETE_LIVE:'source-complete-live',
  RUNTIME_BOUNDARY_DEPENDENT:'runtime-available-upstream-boundary-dependent',
  DERIVABLE_PARALLEL:'derivable-in-qualified-parallel-candidate',
  SOURCE_PRIMITIVE_NOT_LIVE:'source-primitive-present-not-live-coupled',
  BLOCKED:'blocked-source-provider-incomplete',
  SCENARIO_BOUNDARY:'explicit-scenario-boundary-required',
});

const PROVIDERS=Object.freeze({
  arterialPo2MmHg:Object.freeze({
    status:STATUS.RUNTIME_BOUNDARY_DEPENDENT,
    provider:'hummod-ards-core gas snapshot gases.arterial.po2MmHg',
    note:'source-aligned gas equation; upstream blood O2 capacity/temp/CO remain current live boundaries',
  }),
  initialLeftHeartMassG:Object.freeze({
    status:STATUS.DERIVABLE_PARALLEL,
    provider:'hummod_2013_left_heart_mass_provider.initialLeftHeartMass2013',
    note:'source-generation-consistent Context-OtherMass -> Sizing-OrganMass provider exists; requires explicit sex/index/age/plus-minus/stochasm context and is not canonical live state',
  }),
  pressureGradientMmHg:Object.freeze({
    status:STATUS.SOURCE_COMPLETE_LIVE,
    provider:'live systemic arterial pressure - live systemic venous pressure',
    note:'matches LeftHeart-Pressure PressureGradient with pump switch off',
  }),
  alphaReceptorActivity:Object.freeze({
    status:STATUS.DERIVABLE_PARALLEL,
    provider:'2013 cardiac Ganglia Hz + Alpha1Pool effect',
    note:'qualified 2013 autonomic/catecholamine candidate can derive both inputs; not canonical live authority',
  }),
  adhPoolLog10Conc:Object.freeze({
    status:STATUS.SOURCE_PRIMITIVE_NOT_LIVE,
    provider:'hummod_adh_source_aligned',
    note:'ADH storage/secretion/pool primitives exist; osmolality, pituitary neural drive and clearance providers are not live-coupled',
  }),
  o2NeedMlPerMin:Object.freeze({
    status:STATUS.SOURCE_PRIMITIVE_NOT_LIVE,
    provider:'hummod_myocardial_metabolism_source_aligned',
    note:'requires live myocardial mass plus thyroid, heat-metabolism and structure/function effects',
  }),
  viscosityConductanceEffect:Object.freeze({
    status:STATUS.DERIVABLE_PARALLEL,
    provider:'hummod_blood_oxygen_provider_candidate -> 2013 Viscosity HctOnVisc',
    note:'parallel source-owned blood-volume/Hct provider now derives viscosity; explicit blood initialization required and not canonical live state',
  }),
  anesthesiaVascularConductance:Object.freeze({
    status:STATUS.SCENARIO_BOUNDARY,
    provider:'Anesthesia.VascularConductance',
    note:'must come from explicit anesthesia/intervention state; do not silently force neutral 1 for general live use',
  }),
  vasculatureEffect:Object.freeze({
    status:STATUS.SOURCE_PRIMITIVE_NOT_LIVE,
    provider:'LeftHeart-Vasculature.Effect',
    note:'slow PO2-dependent vascular remodeling state not yet implemented in 2013 branch',
  }),
  infarctionEffect:Object.freeze({
    status:STATUS.SCENARIO_BOUNDARY,
    provider:'LeftHeart-Infarction.Effect = 1 - Area%/100',
    note:'Area% is an explicit scenario/pathology state; source default 0 must not be generalized to every case',
  }),
  arterialO2ContentMlPerMl:Object.freeze({
    status:STATUS.RUNTIME_BOUNDARY_DEPENDENT,
    provider:'hummod-ards-core gas snapshot state.arterialO2ContentMlPerMl',
    note:'dynamic source-aligned gas state; upstream O2-capacity boundary is still synthetic in current reference case',
  }),
  o2MaxMlPerMl:Object.freeze({
    status:STATUS.DERIVABLE_PARALLEL,
    provider:'hummod_blood_oxygen_provider_candidate -> HgbConc.O2Max',
    note:'parallel source-owned Hct/Hgb provider now derives O2Max; current live gas boundary remains synthetic until provider ownership is promoted',
  }),
  hgbP50:Object.freeze({
    status:STATUS.RUNTIME_BOUNDARY_DEPENDENT,
    provider:'source-aligned Hgb properties from live arterial pH/pCO2/temp/CO',
    note:'pH/pCO2 dynamic; temperature and carboxyhemoglobin remain explicit live boundaries',
  }),
  hgbScaleForSat:Object.freeze({
    status:STATUS.RUNTIME_BOUNDARY_DEPENDENT,
    provider:'source-aligned Hgb properties from live arterial pH/pCO2/temp/CO',
    note:'same upstream boundary caveat as hgbP50',
  }),
  plasmaVolumeFraction:Object.freeze({
    status:STATUS.DERIVABLE_PARALLEL,
    provider:'hummod_blood_oxygen_provider_candidate -> BloodVol.PVCrit',
    note:'parallel source-owned blood-volume provider derives plasma fraction; explicit initialization required and not canonical live state',
  }),
});

function readiness(){
  const fields=REQUIRED_FIELDS.map(field=>Object.freeze({
    field,
    ...PROVIDERS[field],
  }));
  const sourceCompleteLive=fields.filter(x=>x.status===STATUS.SOURCE_COMPLETE_LIVE);
  const blocked=fields.filter(x=>[
    STATUS.SOURCE_PRIMITIVE_NOT_LIVE,
    STATUS.BLOCKED,
    STATUS.SCENARIO_BOUNDARY,
  ].includes(x.status));
  return Object.freeze({
    schema:'hummod-2013-coronary-flow-provider-readiness/v1',
    authority:'diagnostic-only',
    physiologyChanged:false,
    fields:Object.freeze(fields),
    summary:Object.freeze({
      requiredCount:fields.length,
      sourceCompleteLiveCount:sourceCompleteLive.length,
      sourceCompleteLiveFields:Object.freeze(sourceCompleteLive.map(x=>x.field)),
      blockedCount:blocked.length,
      blockedFields:Object.freeze(blocked.map(x=>x.field)),
      readyForLiveSourceCompleteCoronaryFlow:blocked.length===0 &&
        fields.every(x=>x.status===STATUS.SOURCE_COMPLETE_LIVE),
      neutralBackfillAllowed:false,
    }),
  });
}

module.exports=Object.freeze({
  REQUIRED_FIELDS,
  STATUS,
  PROVIDERS,
  readiness,
});
