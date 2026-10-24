'use strict';

/**
 * v2.3 oxygen-deficit / metabolic-stress state.
 *
 * This module intentionally separates measured/modelled oxygen supply
 * limitation from later organ-failure and arrest decisions.
 *
 * Source-backed concepts:
 * - DO2 = blood flow * arterial O2 content.
 * - Below an individual critical delivery, VO2 becomes supply dependent.
 * - The amount of unmet aerobic demand can be integrated over time as an
 *   oxygen-deficit bookkeeping state.
 *
 * Evidence anchors:
 * - Cain 1977: biphasic DO2-VO2 behavior in experimental hypoxia/anemia.
 * - Ronco et al. 1993: biphasic relationship in individual critically ill
 *   humans with substantial interindividual variability.
 * - Ward 1996: severe hypercapnic acidosis reduced extraction reserve in dogs.
 *
 * Critical rule:
 * This module has NO mortality, arrest, organ-failure, lactate, or
 * contractility authority. It does not convert a fixed amount of debt into
 * a universal "metabolic failure fraction."
 */

const SOURCE=Object.freeze({
  cain:
    'Cain SM. J Appl Physiol. 1977;42:228-234. doi:10.1152/jappl.1977.42.2.228',
  ronco:
    'Ronco JJ et al. JAMA. 1993;270:1724-1730. PMID 8411504',
  ward:
    'Ward ME. Anesthesiology. 1996;85:817-822. PMID 8873552',
  authority:'v2.3-oxygen-deficit-bookkeeping-not-failure-authority',
  clinicalValidation:false,
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}
function clamp(v,lo,hi){
  return Math.max(lo,Math.min(hi,v));
}

function createV23OxygenDeficitState(){
  let cumulativeOxygenDeficitMl=0;
  let cumulativeFractionalDeficitMin=0;
  let cumulativeBelowCriticalExposureMin=0;
  let timeBelowCriticalSec=0;
  let timeSupplyDependentSec=0;
  let last=null;

  function step({
    dtSec,
    requestedTissueO2UseMlPerMin,
    actualTissueO2UseMlPerMin,
    oxygenDeliveryMlPerMin,
    criticalOxygenDeliveryMlPerMin,
    deliveryToCriticalRatio,
  }={}){
    positive(dtSec,'dtSec');
    nonNegative(requestedTissueO2UseMlPerMin,
      'requestedTissueO2UseMlPerMin');
    nonNegative(actualTissueO2UseMlPerMin,
      'actualTissueO2UseMlPerMin');
    nonNegative(oxygenDeliveryMlPerMin,'oxygenDeliveryMlPerMin');
    nonNegative(criticalOxygenDeliveryMlPerMin,
      'criticalOxygenDeliveryMlPerMin');

    if(!(deliveryToCriticalRatio===Infinity ||
      (typeof deliveryToCriticalRatio==='number' &&
       Number.isFinite(deliveryToCriticalRatio) &&
       deliveryToCriticalRatio>=0))){
      throw new Error('deliveryToCriticalRatio must be >= 0 or Infinity');
    }

    const deficitMlPerMin=Math.max(
      0,
      requestedTissueO2UseMlPerMin-actualTissueO2UseMlPerMin
    );
    const deficitFraction=requestedTissueO2UseMlPerMin>0
      ?clamp(deficitMlPerMin/requestedTissueO2UseMlPerMin,0,1)
      :0;
    const belowCriticalFraction=deliveryToCriticalRatio===Infinity
      ?0
      :clamp(1-deliveryToCriticalRatio,0,1);
    const supplyDependent=deficitMlPerMin>
      Math.max(1e-9,requestedTissueO2UseMlPerMin*1e-9);

    cumulativeOxygenDeficitMl+=deficitMlPerMin*(dtSec/60);
    cumulativeFractionalDeficitMin+=deficitFraction*(dtSec/60);
    cumulativeBelowCriticalExposureMin+=
      belowCriticalFraction*(dtSec/60);
    if(deliveryToCriticalRatio<1) timeBelowCriticalSec+=dtSec;
    if(supplyDependent) timeSupplyDependentSec+=dtSec;

    last=Object.freeze({
      requestedTissueO2UseMlPerMin,
      actualTissueO2UseMlPerMin,
      oxygenDeliveryMlPerMin,
      criticalOxygenDeliveryMlPerMin,
      deliveryToCriticalRatio,
      oxygenSupplyDeficitMlPerMin:deficitMlPerMin,
      deficitFraction,
      belowCriticalFraction,
      supplyDependent,
      cumulativeOxygenDeficitMl,
      cumulativeFractionalDeficitMin,
      cumulativeBelowCriticalExposureMin,
      timeBelowCriticalSec,
      timeSupplyDependentSec,
      failureAuthority:false,
      arrestAuthority:false,
      contractilityAuthority:false,
      lactateAuthority:false,
      provenance:SOURCE,
    });
    return last;
  }

  function snapshot(){
    return last||Object.freeze({
      cumulativeOxygenDeficitMl,
      cumulativeFractionalDeficitMin,
      cumulativeBelowCriticalExposureMin,
      timeBelowCriticalSec,
      timeSupplyDependentSec,
      failureAuthority:false,
      arrestAuthority:false,
      contractilityAuthority:false,
      lactateAuthority:false,
      provenance:SOURCE,
      status:'initialized-not-stepped',
    });
  }

  return Object.freeze({
    kind:'v2.3-oxygen-deficit-state',
    step,
    snapshot,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  createV23OxygenDeficitState,
});
