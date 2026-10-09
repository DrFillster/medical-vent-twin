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
  referenceSystemicOutflowMlPerMin=null,
  organFlowsMlPerMin={},
  toleranceMlPerMin=1e-6,
}={}){
  finiteNonNegative(toleranceMlPerMin,'toleranceMlPerMin');
  if(referenceSystemicOutflowMlPerMin!==null){
    finiteNonNegative(referenceSystemicOutflowMlPerMin,'referenceSystemicOutflowMlPerMin');
  }
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

  let unresolvedFlowMlPerMin=null;
  let coverageFraction=null;
  let complete=false;
  if(referenceSystemicOutflowMlPerMin!==null){
    const rawResidual=referenceSystemicOutflowMlPerMin-accountedFlowMlPerMin;
    if(rawResidual < -toleranceMlPerMin){
      throw new Error(
        'accounted organ flow exceeds native systemic arterial outflow by '+
        Math.abs(rawResidual)+' mL/min'
      );
    }
    unresolvedFlowMlPerMin=Math.max(rawResidual,0);
    coverageFraction=referenceSystemicOutflowMlPerMin>0
      ? accountedFlowMlPerMin/referenceSystemicOutflowMlPerMin
      : (accountedFlowMlPerMin===0?1:0);
    complete=unresolvedFlowMlPerMin<=toleranceMlPerMin;
  }

  return Object.freeze({
    referenceSystemicOutflowMlPerMin,
    organFlowsMlPerMin:freezeObject(accounted),
    accountedFlowMlPerMin,
    unresolvedFlowMlPerMin,
    coverageFraction,
    complete,
    derivedPeripheralResistance:null,
    residualOrganAllocation:null,
    provenance:Object.freeze({
      status:'native-flow-accounting-only',
      closureReference:'SystemicArtys.Outflow',
      cardiacOutputIsNotClosureReference:true,
      sourceRepository:HUMMOD_SOURCE_IDENTITY.canonicalRepository,
      sourceRevision:HUMMOD_SOURCE_IDENTITY.canonicalRevision,
      residualAllocationInvented:false,
      tprInvented:false,
      clinicalValidation:false,
    }),
  });
}

function accountSystemicOrganFlowSeries({
  referenceSystemicOutflowMlPerMin=null,
  organFlowSeriesMlPerMin={},
  toleranceMlPerMin=1e-6,
}={}){
  if(referenceSystemicOutflowMlPerMin!==null &&
     (!Array.isArray(referenceSystemicOutflowMlPerMin)||referenceSystemicOutflowMlPerMin.length===0)){
    throw new Error('referenceSystemicOutflowMlPerMin must be null or a non-empty array');
  }
  if(!organFlowSeriesMlPerMin||typeof organFlowSeriesMlPerMin!=='object'||Array.isArray(organFlowSeriesMlPerMin)){
    throw new Error('organFlowSeriesMlPerMin must be an object');
  }
  const names=Object.keys(organFlowSeriesMlPerMin);
  const lengths=names.map(name=>{
    const values=organFlowSeriesMlPerMin[name];
    if(!Array.isArray(values)||values.length===0) throw new Error('organ flow series must be non-empty for '+name);
    return values.length;
  });
  const sampleCount=referenceSystemicOutflowMlPerMin!==null
    ? referenceSystemicOutflowMlPerMin.length
    : (lengths[0]||0);
  if(sampleCount===0) throw new Error('at least one organ flow series is required');
  for(let i=0;i<lengths.length;i++){
    if(lengths[i]!==sampleCount) throw new Error('organ flow series length mismatch for '+names[i]);
  }

  const samples=[];
  for(let index=0;index<sampleCount;index++){
    const flows={};
    for(const name of names) flows[name]=organFlowSeriesMlPerMin[name][index];
    samples.push(accountSystemicOrganFlows({
      referenceSystemicOutflowMlPerMin:referenceSystemicOutflowMlPerMin===null
        ? null
        : referenceSystemicOutflowMlPerMin[index],
      organFlowsMlPerMin:flows,
      toleranceMlPerMin,
    }));
  }
  return Object.freeze({
    sampleCount,
    organFlowNames:Object.freeze([...names]),
    samples:Object.freeze(samples),
    provenance:Object.freeze({
      status:'native-flow-series-accounting-only',
      closureReference:'SystemicArtys.Outflow',
      cardiacOutputIsNotClosureReference:true,
      residualAllocationInvented:false,
      tprInvented:false,
    }),
  });
}

module.exports={accountSystemicOrganFlows,accountSystemicOrganFlowSeries};
