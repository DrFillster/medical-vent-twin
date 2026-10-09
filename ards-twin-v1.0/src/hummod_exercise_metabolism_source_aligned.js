'use strict';

const {HUMMOD_SOURCE_IDENTITY}=require('./hummod_source_identity.js');

const SOURCE_CONSTANTS=Object.freeze({
  wattsToCals:14.34,
  tauMin:0.2,
  bikeEfficiencyFraction:0.30,
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){finite(v,label);if(v<0)throw new Error(label+' must be >= 0');return v;}
function positive(v,label){finite(v,label);if(!(v>0))throw new Error(label+' must be > 0');return v;}

function bicycleTargets({
  powerW,
  rpm=50,
  efficiencyFraction=SOURCE_CONSTANTS.bikeEfficiencyFraction,
}={}){
  nonNegative(powerW,'powerW');
  nonNegative(rpm,'rpm');
  positive(efficiencyFraction,'efficiencyFraction');
  return Object.freeze({
    targetTotalWatts:powerW/efficiencyFraction,
    targetMotionWatts:powerW,
    targetContractionRate:rpm,
  });
}

function createHumModExerciseMetabolism({
  initialTotalWatts=0,
  initialMotionWatts=0,
  initialContractionRate=0,
  tauMin=SOURCE_CONSTANTS.tauMin,
}={}){
  nonNegative(initialTotalWatts,'initialTotalWatts');
  nonNegative(initialMotionWatts,'initialMotionWatts');
  nonNegative(initialContractionRate,'initialContractionRate');
  positive(tauMin,'tauMin');

  let totalWatts=initialTotalWatts;
  let motionWatts=initialMotionWatts;
  let contractionRate=initialContractionRate;
  let last=null;

  function advanceDelay(current,target,dtSec){
    // HumMod source relation is dY/dt = K*(Target-Y), K=1/Tau on the
    // minute timebase. Exact exponential integration preserves that source
    // differential equation; DES internal delay-step identity is not claimed.
    const tauSec=tauMin*60;
    return target+(current-target)*Math.exp(-dtSec/tauSec);
  }

  function step({
    dtSec,
    exertionMode=0,
    bikePowerW=0,
    bikeRpm=50,
    bikeEfficiencyFraction=SOURCE_CONSTANTS.bikeEfficiencyFraction,
    targetTotalWatts=null,
    targetMotionWatts=null,
    targetContractionRate=null,
  }={}){
    positive(dtSec,'dtSec');
    finite(exertionMode,'exertionMode');

    let targets;
    if(targetTotalWatts!=null||targetMotionWatts!=null||targetContractionRate!=null){
      if(targetTotalWatts==null||targetMotionWatts==null||targetContractionRate==null){
        throw new Error('all explicit exercise targets are required together');
      }
      targets={
        targetTotalWatts:nonNegative(targetTotalWatts,'targetTotalWatts'),
        targetMotionWatts:nonNegative(targetMotionWatts,'targetMotionWatts'),
        targetContractionRate:nonNegative(targetContractionRate,'targetContractionRate'),
      };
    } else if(exertionMode===3){
      targets=bicycleTargets({
        powerW:bikePowerW,
        rpm:bikeRpm,
        efficiencyFraction:bikeEfficiencyFraction,
      });
    } else if(exertionMode===0){
      targets={targetTotalWatts:0,targetMotionWatts:0,targetContractionRate:0};
    } else {
      throw new Error('only native rest mode 0 and bicycle mode 3 are implemented');
    }

    totalWatts=advanceDelay(totalWatts,targets.targetTotalWatts,dtSec);
    motionWatts=advanceDelay(motionWatts,targets.targetMotionWatts,dtSec);
    contractionRate=advanceDelay(contractionRate,targets.targetContractionRate,dtSec);

    const heatWatts=totalWatts-motionWatts;
    last=Object.freeze({
      exertionMode,
      ...targets,
      totalWatts,
      motionWatts,
      contractionRate,
      heatWatts,
      totalCals:SOURCE_CONSTANTS.wattsToCals*totalWatts,
      motionCals:SOURCE_CONSTANTS.wattsToCals*motionWatts,
      heatCals:SOURCE_CONSTANTS.wattsToCals*heatWatts,
    });
    return snapshot();
  }

  function snapshot(){
    return Object.freeze({
      schema:'hummod-source-aligned-exercise-metabolism/v1',
      ...(last||{
        exertionMode:0,
        targetTotalWatts:0,
        targetMotionWatts:0,
        targetContractionRate:0,
        totalWatts,
        motionWatts,
        contractionRate,
        heatWatts:totalWatts-motionWatts,
        totalCals:SOURCE_CONSTANTS.wattsToCals*totalWatts,
        motionCals:SOURCE_CONSTANTS.wattsToCals*motionWatts,
        heatCals:SOURCE_CONSTANTS.wattsToCals*(totalWatts-motionWatts),
      }),
      provenance:Object.freeze({
        status:'source-aligned-differential-equation-with-explicit-integration-adaptation',
        sourceRepository:HUMMOD_SOURCE_IDENTITY.canonicalRepository,
        sourceRevision:HUMMOD_SOURCE_IDENTITY.canonicalRevision,
        sourceStructures:Object.freeze([
          'Exercise-Bike',
          'Exercise-Metabolism',
        ]),
        sourceTauMin:tauMin,
        integrationAdaptation:'exact exponential integration of source first-order delay; DES delay solver identity not claimed',
        supportedNativeModes:Object.freeze([0,3]),
        clinicalValidation:false,
      }),
    });
  }

  return Object.freeze({kind:'hummod-source-aligned-exercise-metabolism',step,snapshot});
}

module.exports={
  SOURCE_CONSTANTS,
  bicycleTargets,
  createHumModExerciseMetabolism,
};
