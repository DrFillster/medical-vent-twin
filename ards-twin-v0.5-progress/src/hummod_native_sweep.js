'use strict';

const { validateNativeHumModScenario }=require('./hummod_native_scenario.js');

const HUMMOD_NATIVE_SWEEP_SCHEMA='vent-hummod-native-sweep/v1';

function validateNativeHumModSweep(sweep){
  if(!sweep||typeof sweep!=='object'||Array.isArray(sweep)) throw new Error('native HumMod sweep must be an object');
  if(sweep.schema!==HUMMOD_NATIVE_SWEEP_SCHEMA) throw new Error('unsupported native HumMod sweep schema');
  if(typeof sweep.id!=='string'||!sweep.id) throw new Error('sweep id is required');
  if(sweep.clinicalValidation!==false) throw new Error('engineering sweep must declare clinicalValidation=false');
  if(!sweep.provenance||sweep.provenance.berlinArdsCalibration!==false) throw new Error('sweep must declare berlinArdsCalibration=false');
  if(!sweep.baseline||typeof sweep.baseline!=='object') throw new Error('baseline is required');
  if(!Array.isArray(sweep.cases)||sweep.cases.length===0) throw new Error('sweep cases are required');

  const baselineScenario={
    schema:'vent-hummod-native-scenario/v1',
    id:sweep.id+'--baseline',
    scenarioClass:'engineering-native-baseline',
    assignments:sweep.baseline.assignments,
    provenance:{clinicalValidation:false},
  };
  validateNativeHumModScenario(baselineScenario);
  const requiredVent=['Ventilator.Switch','Ventilator.Rate','Ventilator.TidalVolume','AirSupply-GasTanks.Switch','AirSupply-GasTanks.O2Valve(%)','AirSupply-GasTanks.N2Valve(%)'];
  for(const key of requiredVent){
    if(!Object.prototype.hasOwnProperty.call(sweep.baseline.assignments,key)) throw new Error('baseline missing '+key);
  }

  const ids=new Set();
  for(const item of sweep.cases){
    if(!item||typeof item!=='object') throw new Error('sweep case must be an object');
    if(typeof item.id!=='string'||!item.id) throw new Error('sweep case id is required');
    if(ids.has(item.id)) throw new Error('duplicate sweep case id: '+item.id);
    ids.add(item.id);
    if(typeof item.mechanism!=='string'||!item.mechanism) throw new Error('case '+item.id+' mechanism is required');
    const scenario={
      schema:'vent-hummod-native-scenario/v1',
      id:sweep.id+'--'+item.id,
      scenarioClass:'engineering-pulmonary-injury-sensitivity',
      assignments:item.assignments,
      provenance:{clinicalValidation:false},
    };
    validateNativeHumModScenario(scenario);
    for(const key of requiredVent){
      if(item.assignments[key]!==sweep.baseline.assignments[key]) {
        throw new Error('case '+item.id+' must preserve baseline ventilation/inspired-gas setting '+key);
      }
    }
    const injuryKeys=Object.keys(item.assignments).filter(k=>!requiredVent.includes(k));
    if(injuryKeys.length===0) throw new Error('case '+item.id+' has no pulmonary/thoracic perturbation');
  }
  return sweep;
}

module.exports={HUMMOD_NATIVE_SWEEP_SCHEMA,validateNativeHumModSweep};
