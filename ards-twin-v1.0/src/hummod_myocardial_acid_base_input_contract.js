'use strict';

// Contract for the upstream states required to compute live HumMod myocardial
// acid-base chemistry without arterial-gas substitution or nominal backfill.

const REQUIRED_FIELDS=Object.freeze([
  'intracellularPotassium',
  'liquidVolumeMl',
  'bloodFlowMlPerMin',
  'o2UseMlPerMin',
  'bloodSid',
  'arterialHco3',
  'anaerobicGlucoseUsedMgPerMin',
  'lactateUsedMgPerMin',
  'lactatePoolConcentration',
]);

const UPSTREAM_DEPENDENCIES=Object.freeze({
  intracellularPotassium:
    'KCell.[K+] from global KCell mass / CellH2O.Vol',
  liquidVolumeMl:
    'LeftHeart-Size.LiquidVol from global InterstitialWater.Vol + CellH2O.Vol scaling',
  bloodFlowMlPerMin:
    'LeftHeart-Flow.BloodFlow',
  o2UseMlPerMin:
    'LeftHeart-Flow.O2Use',
  bloodSid:
    'BloodIons.[SID]',
  arterialHco3:
    'CO2Artys.[HCO3]',
  anaerobicGlucoseUsedMgPerMin:
    'LeftHeart-Fuel.AnaerobicGlucoseUsed(mG/Min)',
  lactateUsedMgPerMin:
    'LeftHeart-Fuel.LacUsed(mG/Min)',
  lactatePoolConcentration:
    'LacPool.[Lac-] = LacPool.Mass / ECFV.Vol',
});

function auditMyocardialAcidBaseInputs(inputs){
  if(inputs==null||typeof inputs!=='object'||Array.isArray(inputs)){
    inputs={};
  }
  const missing=[];
  const invalid=[];
  for(const field of REQUIRED_FIELDS){
    const v=inputs[field];
    if(v==null){
      missing.push(field);
    }else if(typeof v!=='number'||!Number.isFinite(v)){
      invalid.push(field);
    }
  }
  const complete=missing.length===0&&invalid.length===0;
  return Object.freeze({
    complete,
    missing:Object.freeze(missing),
    invalid:Object.freeze(invalid),
    requiredFields:REQUIRED_FIELDS,
    upstreamDependencies:UPSTREAM_DEPENDENCIES,
    status:complete
      ? 'HumMod-myocardial-acid-base-inputs-complete'
      : 'blocked-missing-HumMod-myocardial-upstream-state',
    arterialPco2SubstitutionAllowed:false,
    nominalBackfillAllowed:false,
    controlAuthority:false,
  });
}

function requireMyocardialAcidBaseInputs(inputs){
  const audit=auditMyocardialAcidBaseInputs(inputs);
  if(!audit.complete){
    const parts=[];
    if(audit.missing.length) parts.push('missing: '+audit.missing.join(', '));
    if(audit.invalid.length) parts.push('invalid: '+audit.invalid.join(', '));
    throw new Error(
      'HumMod myocardial acid-base inputs incomplete ('+parts.join('; ')+')'
    );
  }
  return Object.freeze({...inputs});
}

module.exports=Object.freeze({
  REQUIRED_FIELDS,
  UPSTREAM_DEPENDENCIES,
  auditMyocardialAcidBaseInputs,
  requireMyocardialAcidBaseInputs,
});
