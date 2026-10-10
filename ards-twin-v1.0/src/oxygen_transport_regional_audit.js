'use strict';

/**
 * Regional oxygen-transport audit layer.
 *
 * This module adds no physiologic threshold or control response.
 * It exposes global versus regional convective delivery and extraction so
 * future disease layers can modify regional/microcirculatory behavior without
 * replacing the existing HumMod/Vent mass balance.
 */

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function regionalOxygenTransport({
  bloodFlowMlPerMin,
  arterialO2ContentMlPerMl,
  venousO2ContentMlPerMl,
  oxygenUseMlPerMin,
}={}){
  nonNegative(bloodFlowMlPerMin,'bloodFlowMlPerMin');
  nonNegative(arterialO2ContentMlPerMl,'arterialO2ContentMlPerMl');
  nonNegative(venousO2ContentMlPerMl,'venousO2ContentMlPerMl');
  nonNegative(oxygenUseMlPerMin,'oxygenUseMlPerMin');

  const delivery=bloodFlowMlPerMin*arterialO2ContentMlPerMl;
  const venousReturn=bloodFlowMlPerMin*venousO2ContentMlPerMl;
  const extracted=Math.max(0,delivery-venousReturn);
  const extractionRatio=delivery>0?extracted/delivery:0;
  const deliveryToUseRatio=oxygenUseMlPerMin>0?delivery/oxygenUseMlPerMin:Infinity;

  return Object.freeze({
    bloodFlowMlPerMin,
    arterialO2ContentMlPerMl,
    venousO2ContentMlPerMl,
    oxygenUseMlPerMin,
    oxygenDeliveryMlPerMin:delivery,
    venousO2ReturnMlPerMin:venousReturn,
    oxygenExtractedMlPerMin:extracted,
    extractionRatio,
    deliveryToUseRatio,
    supplyDependent:null,
    criticalDeliveryMlPerMin:null,
    provenance:Object.freeze({
      relation:'convective DO2 = regional blood flow * arterial O2 content',
      universalCriticalThresholdApplied:false,
      controlAuthority:false,
    }),
  });
}

function compareRegionalToGlobal({global,regions}={}){
  if(!global||typeof global!=='object') throw new Error('global state required');
  if(!regions||typeof regions!=='object'||Array.isArray(regions)){
    throw new Error('regions object required');
  }
  const out={};
  for(const [name,r] of Object.entries(regions)){
    const x=regionalOxygenTransport(r);
    out[name]=Object.freeze({
      ...x,
      fractionOfGlobalFlow:
        global.bloodFlowMlPerMin>0?x.bloodFlowMlPerMin/global.bloodFlowMlPerMin:null,
      fractionOfGlobalDelivery:
        global.oxygenDeliveryMlPerMin>0?x.oxygenDeliveryMlPerMin/global.oxygenDeliveryMlPerMin:null,
    });
  }
  return Object.freeze({
    global:Object.freeze({...global}),
    regions:Object.freeze(out),
    controlAuthority:false,
  });
}

module.exports=Object.freeze({regionalOxygenTransport,compareRegionalToGlobal});
