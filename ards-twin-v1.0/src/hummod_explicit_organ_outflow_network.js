'use strict';

const {sourceAlignedSystemicOutflow}=require('./hummod_systemic_outflow_source_aligned.js');
const {PERIPHERAL_FLOW_SYMBOLS,SPLANCHNIC_FLOW_SYMBOLS}=require('./hummod_native_organ_flow_manifest.js');

const REQUIRED_PERIPHERAL_BEDS=Object.freeze(Object.keys(PERIPHERAL_FLOW_SYMBOLS));
const REQUIRED_SPLANCHNIC_BEDS=Object.freeze(Object.keys(SPLANCHNIC_FLOW_SYMBOLS));

function finiteNonNegative(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)||v<0)throw new Error(label+' must be finite and >= 0');
  return v;
}
function bedFlow(v,label){
  if(v&&typeof v==='object'&&typeof v.bloodFlowMlPerMin==='number')return finiteNonNegative(v.bloodFlowMlPerMin,label+'.bloodFlowMlPerMin');
  return finiteNonNegative(v,label);
}

function buildExplicitSystemicOutflow({peripheralBeds={},splanchnicBeds={}}={}){
  const missing=[];
  const peripheralFlowsMlPerMin={};
  for(const key of REQUIRED_PERIPHERAL_BEDS){
    if(!Object.prototype.hasOwnProperty.call(peripheralBeds,key)){missing.push('peripheral:'+key);continue;}
    peripheralFlowsMlPerMin[key]=bedFlow(peripheralBeds[key],'peripheralBeds.'+key);
  }
  const splanchnicFlowsMlPerMin={};
  for(const key of REQUIRED_SPLANCHNIC_BEDS){
    if(!Object.prototype.hasOwnProperty.call(splanchnicBeds,key)){missing.push('splanchnic:'+key);continue;}
    splanchnicFlowsMlPerMin[key]=bedFlow(splanchnicBeds[key],'splanchnicBeds.'+key);
  }
  if(missing.length){
    return Object.freeze({
      complete:false,missingBeds:Object.freeze(missing),systemicArterialOutflowMlPerMin:null,
      provenance:Object.freeze({status:'incomplete-explicit-organ-network',fallbackInvented:false}),
    });
  }
  const closure=sourceAlignedSystemicOutflow({peripheralFlowsMlPerMin,splanchnicFlowsMlPerMin});
  return Object.freeze({
    complete:true,missingBeds:Object.freeze([]),...closure,
    provenance:Object.freeze({...closure.provenance,status:'complete-explicit-organ-network',fallbackInvented:false}),
  });
}

module.exports={REQUIRED_PERIPHERAL_BEDS,REQUIRED_SPLANCHNIC_BEDS,buildExplicitSystemicOutflow};
