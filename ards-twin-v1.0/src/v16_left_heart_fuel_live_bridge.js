'use strict';

/**
 * v1.6 live LeftHeart-Fuel bridge.
 *
 * This module removes myocardial lactate use as a free scalar whenever the
 * source metabolic inputs are available.
 *
 * Stateful ordering:
 *   previous myocardial lactate concentration
 *     + current systemic substrate state
 *     + current coronary flow/O2 use
 *   -> HumMod-2013 LeftHeart-Fuel
 *   -> myocardial lactate use for the next acid-base/lactate step
 *
 * Candidate only. No canonical bedside authority.
 */

const {
  leftHeartFuelInstant2013,
}=require('./hummod_2013_left_heart_fuel.js');
const {
  leftHeartO2Demand2013,
  O2_TO_CAL_PER_ML,
}=require('./hummod_2013_left_heart_metabolism_provider.js');

const SOURCE=Object.freeze({
  authority:'candidate-not-canonical',
  fuel:'HumMod 2012/2013 LeftHeart-Fuel.DES',
  metabolism:'HumMod 2012/2013 LeftHeart-Metabolism.DES',
  ordering:'previous myocardial lactate state -> current fuel use -> next lactate/acid-base step',
});

const REQUIRED_LIVE_METABOLIC=Object.freeze([
  'plasmaVolumeFraction',
  'insulinReceptorBoundFractionPercent',
  'glucosePoolMgPerMl',
  'fattyAcidPoolMgPerMl',
  'myocardialMassG',
  'initialMyocardialMassG',
  'thyroidEffect',
  'heatMetabolismCore',
  'structureEffect',
]);

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}

function resolvePriorMyocardialLactate(previousMyocardialAcidBaseSnapshot){
  const v=previousMyocardialAcidBaseSnapshot?.myocardialLactateMeqPerMl;
  nonNegative(v,'previousMyocardialAcidBaseSnapshot.myocardialLactateMeqPerMl');
  return v;
}

function resolveCurrentMyocardialFlowO2(cardiopulmonarySnapshot){
  const m=cardiopulmonarySnapshot?.cardiovascular?.myocardialSourceState;
  if(!m) throw new Error('cardiopulmonary myocardialSourceState is required');
  positive(m.coronaryBloodFlowMlPerMin,'coronaryBloodFlowMlPerMin');
  nonNegative(m.myocardialO2UseMlPerMin,'myocardialO2UseMlPerMin');
  return Object.freeze({
    coronaryBloodFlowMlPerMin:m.coronaryBloodFlowMlPerMin,
    myocardialO2UseMlPerMin:m.myocardialO2UseMlPerMin,
  });
}

function resolveLeftHeartFuel2013Live({
  cardiopulmonarySnapshot,
  previousMyocardialAcidBaseSnapshot,
  metabolic,
  systemicLactatePoolMeqPerMl,
}={}){
  if(!metabolic||typeof metabolic!=='object'){
    throw new Error('metabolic object is required');
  }
  const missing=REQUIRED_LIVE_METABOLIC.filter(k=>metabolic[k]==null);
  if(missing.length){
    throw new Error('missing live LeftHeart-Fuel states: '+missing.join(', '));
  }

  for(const k of REQUIRED_LIVE_METABOLIC) finite(metabolic[k],k);
  if(metabolic.plasmaVolumeFraction<0||metabolic.plasmaVolumeFraction>1){
    throw new Error('plasmaVolumeFraction must be between 0 and 1');
  }
  nonNegative(systemicLactatePoolMeqPerMl,'systemicLactatePoolMeqPerMl');

  const current=resolveCurrentMyocardialFlowO2(cardiopulmonarySnapshot);
  const myocardialLactateMeqPerMl=
    resolvePriorMyocardialLactate(previousMyocardialAcidBaseSnapshot);

  const demand=leftHeartO2Demand2013({
    myocardialMassG:metabolic.myocardialMassG,
    initialMyocardialMassG:metabolic.initialMyocardialMassG,
    thyroidEffect:metabolic.thyroidEffect,
    heatMetabolismCore:metabolic.heatMetabolismCore,
    structureEffect:metabolic.structureEffect,
  });

  const plasmaFlowMlPerMin=
    current.coronaryBloodFlowMlPerMin*metabolic.plasmaVolumeFraction;

  const aerobicCalsPerMin=
    O2_TO_CAL_PER_ML*current.myocardialO2UseMlPerMin;

  const fuel=leftHeartFuelInstant2013({
    insulinReceptorBoundFractionPercent:
      metabolic.insulinReceptorBoundFractionPercent,
    glucosePoolMgPerMl:metabolic.glucosePoolMgPerMl,
    fattyAcidPoolMgPerMl:metabolic.fattyAcidPoolMgPerMl,
    lactatePoolMeqPerMl:systemicLactatePoolMeqPerMl,
    plasmaFlowMlPerMin,
    myocardialLactateMeqPerMl,
    aerobicCalsPerMin,
    totalCalsUsedPerMin:demand.totalCalsUsed,
    o2UseMlPerMin:current.myocardialO2UseMlPerMin,
  });

  return Object.freeze({
    schema:'v16-left-heart-fuel-live-bridge/v1',
    authority:SOURCE.authority,
    canonicalControlAuthority:false,
    myocardialLactateUseMgPerMin:fuel.lacUsedMgPerMin,
    priorMyocardialLactateMeqPerMl:myocardialLactateMeqPerMl,
    systemicLactatePoolMeqPerMl,
    coronaryBloodFlowMlPerMin:current.coronaryBloodFlowMlPerMin,
    plasmaFlowMlPerMin,
    myocardialO2UseMlPerMin:current.myocardialO2UseMlPerMin,
    aerobicCalsPerMin,
    totalCalsUsedPerMin:demand.totalCalsUsed,
    demand,
    fuel,
    requiredLiveMetabolicStates:REQUIRED_LIVE_METABOLIC,
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  REQUIRED_LIVE_METABOLIC,
  resolvePriorMyocardialLactate,
  resolveCurrentMyocardialFlowO2,
  resolveLeftHeartFuel2013Live,
});
