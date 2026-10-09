'use strict';

const {HUMMOD_SOURCE_IDENTITY}=require('./hummod_source_identity.js');

function finiteNonNegative(value,label){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0){
    throw new Error(label+' must be a finite non-negative number');
  }
  return value;
}
function freezeObject(obj){return Object.freeze({...obj});}

function accountSystemicOrganFlows({
  cardiacOutputMlPerMin,
  organFlowsMlPerMin={},
  toleranceMlPerMin=1e-6,
}={}){
  finiteNonNegative(cardiacOutputMlPerMin,'cardiacOutputMlPerMin');
  finiteNonNegative(toleranceMlPerMin,'toleranceMlPerMin');
  if(!organFlowsMlPerMin||typeof organFlowsMlPerMin!=='object'||Array.isArray(organFlowsMlPerMin)){
    throw new Error('organFlowsMlPerMin must be an object');
  }
  const accounted={};
  let accountedFlowMlPerMin=0;
  for(const [name,value] of Object.entries(organFlowsMlPerMin)){
    if(!name) throw new Error('organ flow name must be non-empty');
    finiteNonNegative(value,'organFlowsMlPerMin.'+name);
    accounted[name]=value;
    accountedFlowMlPerMin+=value;
  }
  const rawResidual=cardiacOutputMlPerMin-accountedFlowMlPerMin;
  if(rawResidual < -toleranceMlPerMin){
    throw new Error('accounted organ flow exceeds native cardiac output by '+Math.abs(rawResidual)+' mL/min');
  }
  const unresolvedFlowMlPerMin=Math.max(rawResidual,0);
  const coverageFraction=cardiacOutputMlPerMin>0
    ? accountedFlowMlPerMin/cardiacOutputMlPerMin
    : (accountedFlowMlPerMin===0?1:0);
  return Object.freeze({
    cardiacOutputMlPerMin,
    organFlowsMlPerMin:freezeObject(accounted),
    accountedFlowMlPerMin,
    unresolvedFlowMlPerMin,
    coverageFraction,
    complete:unresolvedFlowMlPerMin<=toleranceMlPerMin,
    derivedPeripheralResistance:null,
    residualOrganAllocation:null,
    provenance:Object.freeze({
      status:'native-flow-accounting-only',
      sourceRepository:HUMMOD_SOURCE_IDENTITY.canonicalRepository,
      sourceRevision:HUMMOD_SOURCE_IDENTITY.canonicalRevision,
      nativeVariableManifestRequired:true,
      residualAllocationInvented:false,
      tprInvented:false,
      clinicalValidation:false,
    }),
  });
}

function accountSystemicOrganFlowSeries({
  cardiacOutputMlPerMin,
  organFlowSeriesMlPerMin={},
  toleranceMlPerMin=1e-6,
}={}){
  if(!Array.isArray(cardiacOutputMlPerMin)||cardiacOutputMlPerMin.length===0){
    throw new Error('cardiacOutputMlPerMin must be a non-empty array');
  }
  if(!organFlowSeriesMlPerMin||typeof organFlowSeriesMlPerMin!=='object'||Array.isArray(organFlowSeriesMlPerMin)){
    throw new Error('organFlowSeriesMlPerMin must be an object');
  }
  const names=Object.keys(organFlowSeriesMlPerMin);
  for(const name of names){
    const values=organFlowSeriesMlPerMin[name];
    if(!Array.isArray(values)||values.length!==cardiacOutputMlPerMin.length){
      throw new Error('organ flow series length mismatch for '+name);
    }
  }
  const samples=cardiacOutputMlPerMin.map((co,index)=>{
    const flows={};
    for(const name of names) flows[name]=organFlowSeriesMlPerMin[name][index];
    return accountSystemicOrganFlows({
      cardiacOutputMlPerMin:co,
      organFlowsMlPerMin:flows,
      toleranceMlPerMin,
    });
  });
  return Object.freeze({
    sampleCount:samples.length,
    organFlowNames:Object.freeze([...names]),
    samples:Object.freeze(samples),
    provenance:Object.freeze({
      status:'native-flow-series-accounting-only',
      residualAllocationInvented:false,
      tprInvented:false,
    }),
  });
}

module.exports={accountSystemicOrganFlows,accountSystemicOrganFlowSeries};
