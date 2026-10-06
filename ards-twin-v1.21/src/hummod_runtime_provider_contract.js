'use strict';

const HUMMOD_RUNTIME_PROVIDER_SCHEMA='vent-hummod-runtime-provider/v2';
const HUMMOD_RUNTIME_STEP_SCHEMA='vent-hummod-runtime-step/v2';

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){finite(v,label);if(v<0)throw new Error(label+' must be >= 0');return v;}
function requiredString(v,label){if(typeof v!=='string'||!v.length)throw new Error(label+' is required');return v;}

function validateHumModRuntimeProvider(provider){
  if(!provider||typeof provider!=='object') throw new Error('HumMod runtime provider must be an object');
  ['createSession','stepSession','getSession','saveSession','restoreSession'].forEach(method=>{
    if(typeof provider[method]!=='function') throw new Error('HumMod runtime provider must implement '+method+'()');
  });
  return true;
}

function makeHumModRuntimeStepRequest({sessionId,expectedModelTimeSec,dtSec,coupling,interventions=[]}={}){
  requiredString(sessionId,'sessionId');
  nonNegative(expectedModelTimeSec,'expectedModelTimeSec');
  if(!(dtSec>0)) throw new Error('dtSec must be > 0');
  if(!coupling||typeof coupling!=='object') throw new Error('coupling is required');
  if(!Array.isArray(interventions)) throw new Error('interventions must be an array');
  return Object.freeze({
    schema:HUMMOD_RUNTIME_STEP_SCHEMA,
    sessionId,
    expectedModelTimeSec,
    dtSec,
    coupling:Object.freeze({...coupling}),
    interventions:Object.freeze(interventions.slice()),
  });
}

function makeHumModRuntimeDescriptor({
  sessionId,sourceRepository,sourceRevision,runtimeVersion,modelTimeSec=0,implementation,capabilities={}
}={}){
  return Object.freeze({
    schema:HUMMOD_RUNTIME_PROVIDER_SCHEMA,
    sessionId:requiredString(sessionId,'sessionId'),
    sourceRepository:requiredString(sourceRepository,'sourceRepository'),
    sourceRevision:requiredString(sourceRevision,'sourceRevision'),
    runtimeVersion:requiredString(runtimeVersion,'runtimeVersion'),
    implementation:requiredString(implementation,'implementation'),
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
  HUMMOD_RUNTIME_PROVIDER_SCHEMA,
  HUMMOD_RUNTIME_STEP_SCHEMA,
  validateHumModRuntimeProvider,
  makeHumModRuntimeStepRequest,
  makeHumModRuntimeDescriptor,
};
