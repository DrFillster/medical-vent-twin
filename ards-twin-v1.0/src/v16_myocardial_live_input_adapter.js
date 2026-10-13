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

const {
  sourceAnaerobicGlucoseUse2013,
}=require('./hummod_2013_left_heart_fuel.js');

const REQUIRED_EXTERNAL=Object.freeze([
  'intracellularPotassiumMeqPerMl',
  'leftVentricleLiquidVolumeMl',
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

function resolveIntegratedMyocardialSourceState(cardiopulmonarySnapshot){
  const m=cardiopulmonarySnapshot?.cardiovascular?.myocardialSourceState;
  if(!m||typeof m!=='object'){
    throw new Error('cardiopulmonarySnapshot.cardiovascular.myocardialSourceState is required');
  }
  finite(m.coronaryBloodFlowMlPerMin,'coronaryBloodFlowMlPerMin');
  finite(m.myocardialO2UseMlPerMin,'myocardialO2UseMlPerMin');
  return Object.freeze({
    myocardialBloodFlowMlPerMin:m.coronaryBloodFlowMlPerMin,
    myocardialO2UseMlPerMin:m.myocardialO2UseMlPerMin,
  });
}

function composeLiveMyocardialAcidBaseInputs({
  gasSnapshot,
  cardiopulmonarySnapshot,
  upstream,
}={}){
  if(!upstream||typeof upstream!=='object'||Array.isArray(upstream)){
    throw new Error('upstream object is required');
  }

  const chemistry=resolveLiveChemistryFromGasSnapshot(gasSnapshot);
  const myocardialSource=
    resolveIntegratedMyocardialSourceState(cardiopulmonarySnapshot);
  const sourceAnaerobic=sourceAnaerobicGlucoseUse2013();
  const missing=REQUIRED_EXTERNAL.filter(k=>upstream[k]==null);
  if(missing.length){
    throw new Error(
      'missing live myocardial upstream states: '+missing.join(', ')
    );
  }

  const external={};
  for(const key of REQUIRED_EXTERNAL){
    finite(upstream[key],key);
    external[key]=upstream[key];
  }

  return Object.freeze({
    ...chemistry,
    ...myocardialSource,
    anaerobicGlucoseUseMgPerMin:
      sourceAnaerobic.anaerobicGlucoseUsedMgPerMin,
    ...external,
  });
}

module.exports=Object.freeze({
  REQUIRED_EXTERNAL,
  resolveLiveChemistryFromGasSnapshot,
  resolveIntegratedMyocardialSourceState,
  composeLiveMyocardialAcidBaseInputs,
});
