'use strict';

/**
 * Sepsis-specific oxygen extraction/distribution contract.
 *
 * This is intentionally separate from whole-body DO2 and from the Yamanaka
 * hemodynamic disease layer. It cannot modify extraction until a quantitative
 * source model is selected and validated.
 */

const SOURCE=Object.freeze({
  concept:
    'Sepsis can produce heterogeneous microvascular perfusion and impaired oxygen extraction despite apparently adequate macrocirculatory delivery.',
  status:'disease-architecture-supported-quantitative-equation-pending',
});

function makeSepsisExtractionShadow({
  timeSec,
  inflammationState=null,
  globalOxygenDeliveryMlPerMin,
  globalExtractionRatio,
}={}){
  if(typeof timeSec!=='number'||!Number.isFinite(timeSec)){
    throw new Error('timeSec must be finite');
  }
  if(typeof globalOxygenDeliveryMlPerMin!=='number'||
     !Number.isFinite(globalOxygenDeliveryMlPerMin)){
    throw new Error('globalOxygenDeliveryMlPerMin must be finite');
  }
  if(typeof globalExtractionRatio!=='number'||!Number.isFinite(globalExtractionRatio)){
    throw new Error('globalExtractionRatio must be finite');
  }
  return Object.freeze({
    schema:'sepsis-extraction-shadow/v1',
    input:Object.freeze({
      timeSec,
      inflammationState,
      globalOxygenDeliveryMlPerMin,
      globalExtractionRatio,
    }),
    regionalExtractionImpairment:null,
    microvascularShuntFraction:null,
    mitochondrialUtilizationModifier:null,
    controlAuthority:false,
    status:'blocked-pending-quantitative-sepsis-oxygen-extraction-model',
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({SOURCE,makeSepsisExtractionShadow});
