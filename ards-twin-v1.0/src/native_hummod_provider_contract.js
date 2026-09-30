'use strict';

// Contract for v2 deployed native-HumMod co-simulation.
// This file defines the interface only. It does not activate a remote provider
// in the v1.x browser runtime.

const NATIVE_HUMMOD_PROVIDER_SCHEMA = 'vent-native-hummod-provider/v2';
const NATIVE_HUMMOD_STEP_SCHEMA = 'vent-native-hummod-step/v2';

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){
  finite(v,label); if(v<0) throw new Error(label+' must be >= 0'); return v;
}
function requiredString(v,label){
  if(typeof v!=='string'||!v.length) throw new Error(label+' is required');
  return v;
}

function validateNativeHumModProvider(provider){
  if(!provider||typeof provider!=='object') throw new Error('native HumMod provider must be an object');
  ['createSession','stepSession','getSession','saveSession','restoreSession'].forEach(method=>{
    if(typeof provider[method]!=='function') throw new Error('native HumMod provider must implement '+method+'()');
  });
  return true;
}

function makeNativeHumModStepRequest({
  sessionId,
  expectedModelTimeSec,
  dtSec,
  coupling,
  interventions=[],
}={}){
  requiredString(sessionId,'sessionId');
  nonNegative(expectedModelTimeSec,'expectedModelTimeSec');
  if(!(dtSec>0)) throw new Error('dtSec must be > 0');
  if(!coupling||typeof coupling!=='object') throw new Error('coupling is required');
  if(!Array.isArray(interventions)) throw new Error('interventions must be an array');

  return Object.freeze({
    schema:NATIVE_HUMMOD_STEP_SCHEMA,
    sessionId,
    expectedModelTimeSec,
    dtSec,
    coupling:Object.freeze({
      meanAirwayPressureCmH2O: finite(coupling.meanAirwayPressureCmH2O,'coupling.meanAirwayPressureCmH2O'),
      pleuralPressureCmH2O: finite(coupling.pleuralPressureCmH2O,'coupling.pleuralPressureCmH2O'),
      pericardialPressureMmHg: finite(coupling.pericardialPressureMmHg,'coupling.pericardialPressureMmHg'),
      fio2: finite(coupling.fio2,'coupling.fio2'),
      minuteVentilationLPerMin: nonNegative(coupling.minuteVentilationLPerMin,'coupling.minuteVentilationLPerMin'),
      alveolarVentilationLPerMin: nonNegative(coupling.alveolarVentilationLPerMin,'coupling.alveolarVentilationLPerMin'),
      recruitmentIndex: nonNegative(coupling.recruitmentIndex,'coupling.recruitmentIndex'),
      shuntFraction: nonNegative(coupling.shuntFraction,'coupling.shuntFraction'),
      deadSpaceFraction: nonNegative(coupling.deadSpaceFraction,'coupling.deadSpaceFraction'),
    }),
    interventions:Object.freeze(interventions.slice()),
  });
}

function validateNativeHumModStepResponse(value){
  if(!value||typeof value!=='object') throw new Error('native HumMod step response must be an object');
  if(value.schema!==NATIVE_HUMMOD_STEP_SCHEMA) throw new Error('unsupported native HumMod step response schema');
  requiredString(value.sessionId,'sessionId');
  nonNegative(value.modelTimeSec,'modelTimeSec');
  requiredString(value.hummodSourceRevision,'hummodSourceRevision');
  requiredString(value.serviceVersion,'serviceVersion');
  if(!value.systemic||typeof value.systemic!=='object') throw new Error('systemic output is required');
  return true;
}

function makeNativeHumModSessionDescriptor({
  sessionId,
  hummodSourceRevision,
  serviceVersion,
  modelTimeSec=0,
  capabilities={},
}={}){
  return Object.freeze({
    schema:NATIVE_HUMMOD_PROVIDER_SCHEMA,
    sessionId:requiredString(sessionId,'sessionId'),
    hummodSourceRevision:requiredString(hummodSourceRevision,'hummodSourceRevision'),
    serviceVersion:requiredString(serviceVersion,'serviceVersion'),
    modelTimeSec:nonNegative(modelTimeSec,'modelTimeSec'),
    capabilities:Object.freeze({
      deterministicStep:Boolean(capabilities.deterministicStep),
      saveRestore:Boolean(capabilities.saveRestore),
      externalBoundaries:Boolean(capabilities.externalBoundaries),
      unitMetadata:Boolean(capabilities.unitMetadata),
      provenanceMetadata:Boolean(capabilities.provenanceMetadata),
    }),
  });
}

module.exports={
  NATIVE_HUMMOD_PROVIDER_SCHEMA,
  NATIVE_HUMMOD_STEP_SCHEMA,
  validateNativeHumModProvider,
  makeNativeHumModStepRequest,
  validateNativeHumModStepResponse,
  makeNativeHumModSessionDescriptor,
};
