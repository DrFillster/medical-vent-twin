'use strict';

/**
 * Microcirculatory oxygen-availability contract.
 *
 * Evidence basis:
 * - Roy & Secomb 2021: impaired microvascular flow regulation can produce
 *   tissue hypoxia despite near-normal systemic delivery.
 * - Munoz et al. 2020: microvascular hemodynamics govern tissue O2 release.
 *
 * No disease gain is encoded here. Quantitative microvascular modifiers remain
 * null until a primary/source-valid equation and parameter set is selected.
 */

const SOURCE=Object.freeze({
  roySecomb:Object.freeze({
    citation:'Roy TK, Secomb TW. Microcirculation. 2021;28(3):e12673.',
    doi:'10.1111/micc.12673',
    pmid:'33236393',
  }),
  munoz:Object.freeze({
    citation:'Munoz CJ et al. Crit Care Clin. 2020;36(2):293-305.',
    doi:'10.1016/j.ccc.2019.12.011',
    pmid:'32172814',
  }),
  status:'architecture-supported-quantitative-mapping-pending',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}

function makeMicrocirculationShadowInput({
  timeSec,
  globalOxygenDeliveryMlPerMin,
  regionalOxygenDeliveryMlPerMin,
  regionalOxygenUseMlPerMin,
}={}){
  finite(timeSec,'timeSec');
  finite(globalOxygenDeliveryMlPerMin,'globalOxygenDeliveryMlPerMin');
  finite(regionalOxygenDeliveryMlPerMin,'regionalOxygenDeliveryMlPerMin');
  finite(regionalOxygenUseMlPerMin,'regionalOxygenUseMlPerMin');
  return Object.freeze({
    schema:'microcirculatory-oxygen-shadow/v1',
    input:Object.freeze({
      timeSec,
      globalOxygenDeliveryMlPerMin,
      regionalOxygenDeliveryMlPerMin,
      regionalOxygenUseMlPerMin,
    }),
    functionalCapillaryDensityModifier:null,
    perfusionHeterogeneityModifier:null,
    extractionEfficiencyModifier:null,
    cellularUtilizationModifier:null,
    effectiveRegionalOxygenAvailabilityMlPerMin:null,
    controlAuthority:false,
    status:'blocked-pending-quantitative-primary-source-model',
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({SOURCE,makeMicrocirculationShadowInput});
