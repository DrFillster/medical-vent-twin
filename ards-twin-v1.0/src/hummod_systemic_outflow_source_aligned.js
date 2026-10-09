'use strict';

const {
  PERIPHERAL_FLOW_SYMBOLS,
  SPLANCHNIC_FLOW_SYMBOLS,
  SOURCE,
}=require('./hummod_native_organ_flow_manifest.js');

function finiteNonNegative(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)||v<0) throw new Error(label+' must be finite and >= 0');
  return v;
}

function requireFlowMap(flows,symbols,label){
  if(!flows||typeof flows!=='object'||Array.isArray(flows)) throw new Error(label+' must be an object');
  const out={};
  for(const [key,symbol] of Object.entries(symbols)){
    if(!Object.prototype.hasOwnProperty.call(flows,key)) throw new Error('missing '+label+'.'+key+' ('+symbol+')');
    out[key]=finiteNonNegative(flows[key],label+'.'+key);
  }
  return out;
}

function sourceAlignedSystemicOutflow({
  peripheralFlowsMlPerMin,
  splanchnicFlowsMlPerMin,
}={}){
  const peripheral=requireFlowMap(peripheralFlowsMlPerMin,PERIPHERAL_FLOW_SYMBOLS,'peripheralFlowsMlPerMin');
  const splanchnic=requireFlowMap(splanchnicFlowsMlPerMin,SPLANCHNIC_FLOW_SYMBOLS,'splanchnicFlowsMlPerMin');

  const peripheralFlowMlPerMin=Object.values(peripheral).reduce((a,b)=>a+b,0);
  const hepaticVeinFlowMlPerMin=splanchnic.giTract+splanchnic.hepaticArtery;
  const systemicArterialOutflowMlPerMin=peripheralFlowMlPerMin+hepaticVeinFlowMlPerMin;

  return Object.freeze({
    peripheralFlowMlPerMin,
    hepaticVeinFlowMlPerMin,
    systemicArterialOutflowMlPerMin,
    peripheralFlowsMlPerMin:Object.freeze(peripheral),
    splanchnicFlowsMlPerMin:Object.freeze(splanchnic),
    derivedPeripheralResistance:null,
    provenance:Object.freeze({
      status:'source-aligned-exact-flow-sum',
      organFlowSource:SOURCE.organFlow,
      systemicArteriesSource:SOURCE.systemicArteries,
      peripheralResistanceSource:SOURCE.peripheralResistance,
      tprUsedAsFlowDriver:false,
      clinicalValidation:false,
    }),
  });
}

module.exports={sourceAlignedSystemicOutflow};
