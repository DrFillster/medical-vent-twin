'use strict';

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function oxygenDeliveryFidelityPoint({
  cardiacOutputMlPerMin,
  arterialO2ContentMlPerMl,
  mixedVenousO2ContentMlPerMl=null,
  requestedTissueO2UseMlPerMin=null,
  sympatheticFiringHz=null,
  saBetaReceptorActivity=null,
  heartRatePerMin=null,
  organOxygen=null,
}={}){
  nonNegative(cardiacOutputMlPerMin,'cardiacOutputMlPerMin');
  nonNegative(arterialO2ContentMlPerMl,'arterialO2ContentMlPerMl');
  if(mixedVenousO2ContentMlPerMl!=null) nonNegative(mixedVenousO2ContentMlPerMl,'mixedVenousO2ContentMlPerMl');
  if(requestedTissueO2UseMlPerMin!=null) nonNegative(requestedTissueO2UseMlPerMin,'requestedTissueO2UseMlPerMin');
  for(const [k,v] of [['sympatheticFiringHz',sympatheticFiringHz],['saBetaReceptorActivity',saBetaReceptorActivity],['heartRatePerMin',heartRatePerMin]]){
    if(v!=null) finite(v,k);
  }

  const globalOxygenDeliveryMlPerMin=
    cardiacOutputMlPerMin*arterialO2ContentMlPerMl;
  const globalVenousO2ReturnMlPerMin=
    mixedVenousO2ContentMlPerMl==null
      ? null
      : cardiacOutputMlPerMin*mixedVenousO2ContentMlPerMl;
  const globalExtractionMlPerMin=
    globalVenousO2ReturnMlPerMin==null
      ? null
      : globalOxygenDeliveryMlPerMin-globalVenousO2ReturnMlPerMin;
  const globalExtractionRatio=
    globalExtractionMlPerMin==null||globalOxygenDeliveryMlPerMin<=0
      ? null
      : globalExtractionMlPerMin/globalOxygenDeliveryMlPerMin;

  return Object.freeze({
    cardiacOutputMlPerMin,
    arterialO2ContentMlPerMl,
    globalOxygenDeliveryMlPerMin,
    mixedVenousO2ContentMlPerMl,
    globalVenousO2ReturnMlPerMin,
    globalExtractionMlPerMin,
    globalExtractionRatio,
    requestedTissueO2UseMlPerMin,
    sympatheticFiringHz,
    saBetaReceptorActivity,
    heartRatePerMin,
    organOxygen,
  });
}

function compareFidelitySeries(nativeSeries,candidateSeries){
  if(!Array.isArray(nativeSeries)||!Array.isArray(candidateSeries)) throw new Error('series arrays required');
  if(nativeSeries.length!==candidateSeries.length) throw new Error('series length mismatch');
  const fields=[
    'cardiacOutputMlPerMin',
    'arterialO2ContentMlPerMl',
    'globalOxygenDeliveryMlPerMin',
    'mixedVenousO2ContentMlPerMl',
    'globalExtractionRatio',
    'sympatheticFiringHz',
    'saBetaReceptorActivity',
    'heartRatePerMin',
  ];
  const maxAbsoluteError={};
  for(const field of fields){
    let max=null;
    for(let i=0;i<nativeSeries.length;i++){
      const a=nativeSeries[i]?.[field],b=candidateSeries[i]?.[field];
      if(typeof a!=='number'||!Number.isFinite(a)||typeof b!=='number'||!Number.isFinite(b)) continue;
      const e=Math.abs(a-b);
      if(max==null||e>max) max=e;
    }
    maxAbsoluteError[field]=max;
  }
  return Object.freeze({sampleCount:nativeSeries.length,maxAbsoluteError:Object.freeze(maxAbsoluteError)});
}

module.exports={oxygenDeliveryFidelityPoint,compareFidelitySeries};
