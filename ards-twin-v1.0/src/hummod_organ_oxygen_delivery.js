'use strict';

// Explicit audit layer for the oxygen mass balance already present inside the
// source-aligned HumMod organ-flow solvers.
//
// For each organ:
//   DO2 = blood flow * arterial O2 content
//   VO2 = organ O2 use
//   venous O2 outflow = blood flow * tissue/venous O2 content
// and therefore DO2 - venous O2 outflow - VO2 should close to zero.
//
// This module does not add an autonomic response or alter any HumMod equation.

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function organOxygenDelivery({
  bloodFlowMlPerMin,
  arterialO2ContentMlPerMl,
  o2UseMlPerMin,
  tissueO2ContentMlPerMl,
  tissuePo2MmHg=null,
}={}){
  nonNegative(bloodFlowMlPerMin,'bloodFlowMlPerMin');
  nonNegative(arterialO2ContentMlPerMl,'arterialO2ContentMlPerMl');
  nonNegative(o2UseMlPerMin,'o2UseMlPerMin');
  nonNegative(tissueO2ContentMlPerMl,'tissueO2ContentMlPerMl');
  if(tissuePo2MmHg!=null) nonNegative(tissuePo2MmHg,'tissuePo2MmHg');

  const oxygenDeliveryMlPerMin=
    bloodFlowMlPerMin*arterialO2ContentMlPerMl;
  const venousO2OutflowMlPerMin=
    bloodFlowMlPerMin*tissueO2ContentMlPerMl;
  const oxygenExtractionMlPerMin=
    Math.max(oxygenDeliveryMlPerMin-venousO2OutflowMlPerMin,0);
  const extractionRatio=oxygenDeliveryMlPerMin>0
    ? oxygenExtractionMlPerMin/oxygenDeliveryMlPerMin
    : 0;
  const deliveryToUseRatio=o2UseMlPerMin>0
    ? oxygenDeliveryMlPerMin/o2UseMlPerMin
    : Infinity;
  const massBalanceResidualMlPerMin=
    oxygenDeliveryMlPerMin-venousO2OutflowMlPerMin-o2UseMlPerMin;

  return Object.freeze({
    bloodFlowMlPerMin,
    arterialO2ContentMlPerMl,
    oxygenDeliveryMlPerMin,
    o2UseMlPerMin,
    tissueO2ContentMlPerMl,
    tissuePo2MmHg,
    venousO2OutflowMlPerMin,
    oxygenExtractionMlPerMin,
    extractionRatio,
    deliveryToUseRatio,
    massBalanceResidualMlPerMin,
    provenance:Object.freeze({
      relation:'DO2 = flow * CaO2; venous O2 outflow = flow * tissue O2 content',
      autonomicGainAdded:false,
      clinicalValidation:false,
    }),
  });
}

function auditOrganFlowState(flowState,{arterialO2ContentMlPerMl}={}){
  if(!flowState||typeof flowState!=='object') throw new Error('flowState object required');
  return organOxygenDelivery({
    bloodFlowMlPerMin:flowState.bloodFlowMlPerMin,
    arterialO2ContentMlPerMl,
    o2UseMlPerMin:flowState.o2UseMlPerMin,
    tissueO2ContentMlPerMl:flowState.tissueO2ContentMlPerMl,
    tissuePo2MmHg:flowState.po2MmHg ?? flowState.po2EndMmHg ?? null,
  });
}

function aggregateOrganOxygenDelivery(organAudits={}){
  const entries=Object.entries(organAudits);
  if(entries.length===0) throw new Error('at least one organ audit required');
  let totalFlow=0,totalDelivery=0,totalUse=0,totalVenousOutflow=0;
  const organs={};
  for(const [name,audit] of entries){
    if(!audit||typeof audit!=='object') throw new Error(name+' audit object required');
    const checked=organOxygenDelivery(audit);
    organs[name]=checked;
    totalFlow+=checked.bloodFlowMlPerMin;
    totalDelivery+=checked.oxygenDeliveryMlPerMin;
    totalUse+=checked.o2UseMlPerMin;
    totalVenousOutflow+=checked.venousO2OutflowMlPerMin;
  }
  return Object.freeze({
    organs:Object.freeze(organs),
    totalBloodFlowMlPerMin:totalFlow,
    totalOxygenDeliveryMlPerMin:totalDelivery,
    totalO2UseMlPerMin:totalUse,
    totalVenousO2OutflowMlPerMin:totalVenousOutflow,
    totalMassBalanceResidualMlPerMin:
      totalDelivery-totalVenousOutflow-totalUse,
  });
}

module.exports={organOxygenDelivery,auditOrganFlowState,aggregateOrganOxygenDelivery};
