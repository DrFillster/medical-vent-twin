'use strict';

/**
 * v1.6 live myocardial acid-base input adapter.
 *
 * Resolves the two already-live chemistry inputs from the gas runtime:
 * - blood SID
 * - arterial HCO3-
 *
 * The remaining seven myocardial upstream states stay explicit and fail closed
 * until their source-transcribed providers are wired into the persistent
 * cardiopulmonary candidate.
 */

const REQUIRED_SEVEN=Object.freeze([
  'intracellularPotassiumMeqPerMl',
  'leftVentricleLiquidVolumeMl',
  'myocardialBloodFlowMlPerMin',
  'myocardialO2UseMlPerMin',
  'anaerobicGlucoseUseMgPerMin',
  'myocardialLactateUseMgPerMin',
  'systemicLactatePoolMeqPerMl',
]);

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}

function resolveLiveChemistryFromGasSnapshot(gasSnapshot){
  if(!gasSnapshot||typeof gasSnapshot!=='object'){
    throw new Error('gasSnapshot is required');
  }
  const bloodSidMolPerL=
    gasSnapshot?.boundary?.blood?.sidMolPerL;
  const arterialHco3MolPerL=
    gasSnapshot?.gases?.arterial?.hco3MolPerL;

  finite(bloodSidMolPerL,'gasSnapshot.boundary.blood.sidMolPerL');
  finite(
    arterialHco3MolPerL,
    'gasSnapshot.gases.arterial.hco3MolPerL'
  );

  return Object.freeze({
    bloodSidMolPerL,
    arterialHco3MolPerL,
  });
}

function composeLiveMyocardialAcidBaseInputs({
  gasSnapshot,
  upstream,
}={}){
  if(!upstream||typeof upstream!=='object'||Array.isArray(upstream)){
    throw new Error('upstream object is required');
  }

  const chemistry=resolveLiveChemistryFromGasSnapshot(gasSnapshot);
  const missing=REQUIRED_SEVEN.filter(k=>upstream[k]==null);
  if(missing.length){
    throw new Error(
      'missing live myocardial upstream states: '+missing.join(', ')
    );
  }

  const seven={};
  for(const key of REQUIRED_SEVEN){
    finite(upstream[key],key);
    seven[key]=upstream[key];
  }

  return Object.freeze({
    ...chemistry,
    ...seven,
  });
}

module.exports=Object.freeze({
  REQUIRED_SEVEN,
  resolveLiveChemistryFromGasSnapshot,
  composeLiveMyocardialAcidBaseInputs,
});
