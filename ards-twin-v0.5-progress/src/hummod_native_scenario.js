'use strict';

// Whitelist and validation for native HumMod solution perturbations.
// These are source-verified HumMod variables/parameters that are directly
// relevant to ventilation/pulmonary gas exchange. Presence here does not
// imply clinical calibration or ARDS validity.

const HUMMOD_NATIVE_SCENARIO_SCHEMA='vent-hummod-native-scenario/v1';

const HUMMOD_NATIVE_MUTABLE_PARAMETERS=Object.freeze({
  'Ventilator.Switch':Object.freeze({kind:'ventilator',source:'Structure/Lungs/Ventilator.DES',unit:'boolean-numeric'}),
  'Ventilator.Rate':Object.freeze({kind:'ventilator',source:'Structure/Lungs/Ventilator.DES',unit:'1/min'}),
  'Ventilator.TidalVolume':Object.freeze({kind:'ventilator',source:'Structure/Lungs/Ventilator.DES',unit:'mL'}),
  'ExcessLungWater.Volume':Object.freeze({kind:'pulmonary-injury',source:'Structure/Lungs/ExcessLungWater.DES',unit:'mL'}),
  'PulmonaryMembrane.TotalArea':Object.freeze({kind:'pulmonary-injury',source:'Structure/Lungs/PulmonaryMembrane.DES',unit:'model-area'}),
  'PulmonaryMembrane.Thickness-Structure':Object.freeze({kind:'pulmonary-injury',source:'Structure/Lungs/PulmonaryMembrane.DES',unit:'model-thickness'}),
  'LungBloodFlow.BasicR-LShunt':Object.freeze({kind:'pulmonary-injury',source:'Structure/Lungs/LungBloodFlow.DES',unit:'mL/min'}),
  'RightHemithorax.NormalPressure':Object.freeze({kind:'thorax',source:'Structure/Lungs/RightHemithorax.DES',unit:'model-pressure'}),
  'LeftHemithorax.NormalPressure':Object.freeze({kind:'thorax',source:'Structure/Lungs/LeftHemithorax.DES',unit:'model-pressure'}),
});

function validateNativeHumModScenario(spec){
  if(!spec||typeof spec!=='object'||Array.isArray(spec)) throw new Error('native HumMod scenario must be an object');
  if(spec.schema!==HUMMOD_NATIVE_SCENARIO_SCHEMA) throw new Error('unsupported native HumMod scenario schema');
  if(typeof spec.id!=='string'||!spec.id) throw new Error('scenario id is required');
  if(typeof spec.scenarioClass!=='string'||!spec.scenarioClass) throw new Error('scenarioClass is required');
  if(!spec.provenance||typeof spec.provenance!=='object') throw new Error('scenario provenance is required');
  if(typeof spec.provenance.clinicalValidation!=='boolean') throw new Error('provenance.clinicalValidation must be boolean');
  if(!spec.assignments||typeof spec.assignments!=='object'||Array.isArray(spec.assignments)) throw new Error('scenario assignments object required');
  const keys=Object.keys(spec.assignments);
  if(keys.length===0) throw new Error('scenario requires at least one assignment');
  for(const key of keys){
    if(!Object.prototype.hasOwnProperty.call(HUMMOD_NATIVE_MUTABLE_PARAMETERS,key)) throw new Error('unapproved native HumMod assignment: '+key);
    const value=spec.assignments[key];
    if(typeof value!=='number'||!Number.isFinite(value)) throw new Error('assignment '+key+' must be finite');
  }
  if(Object.prototype.hasOwnProperty.call(spec.assignments,'Ventilator.Switch')){
    const v=spec.assignments['Ventilator.Switch'];
    if(v!==0&&v!==1) throw new Error('Ventilator.Switch must be 0 or 1');
  }
  for(const key of ['Ventilator.Rate','Ventilator.TidalVolume','ExcessLungWater.Volume','PulmonaryMembrane.TotalArea','PulmonaryMembrane.Thickness-Structure','LungBloodFlow.BasicR-LShunt']){
    if(Object.prototype.hasOwnProperty.call(spec.assignments,key)&&spec.assignments[key]<0) throw new Error(key+' must be non-negative');
  }
  return spec;
}

module.exports={
  HUMMOD_NATIVE_SCENARIO_SCHEMA,
  HUMMOD_NATIVE_MUTABLE_PARAMETERS,
  validateNativeHumModScenario,
};
