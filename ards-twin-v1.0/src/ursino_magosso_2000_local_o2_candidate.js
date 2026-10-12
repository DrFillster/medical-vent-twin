'use strict';

/**
 * Ursino & Magosso 2000 local O2 vascular regulation candidate.
 *
 * Primary source:
 * Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia.
 * I. A mathematical model. Am J Physiol Heart Circ Physiol.
 * 2000;279:H149-H165. doi:10.1152/ajpheart.2000.279.1.H149.
 *
 * Eqs. 41-48. Candidate only; no canonical patient-state authority.
 */

const {
  P:O2_P,
  arterialO2ConcentrationMlO2PerMlBlood,
  venousO2ConcentrationSameUnits,
  heartO2ConsumptionMlPerSec,
}=require('./ursino_magosso_2000_oxygen_metabolic_candidate.js');

const {
  VASCULAR,
}=require('./ursino_magosso_2000_expanded_vascular_candidate.js');

const SOURCE=Object.freeze({
  citation:
    'Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia. I. A mathematical model. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165.',
  doi:'10.1152/ajpheart.2000.279.1.H149',
  equations:Object.freeze([41,42,43,44,45,46,47,48]),
  authority:'candidate-not-canonical',
});

const LOCAL=Object.freeze({
  brain:Object.freeze({
    gain:10,tauSec:10,
    normalVenousO2MlPerMl:0.14,
    normalResistanceMmHgSecPerMl:VASCULAR.bp.R,
  }),
  heart:Object.freeze({
    gain:35,tauSec:10,
    normalVenousO2MlPerMl:0.11,
    normalResistanceMmHgSecPerMl:VASCULAR.hp.R,
  }),
  muscle:Object.freeze({
    gain:30,tauSec:10,
    normalVenousO2MlPerMl:0.155,
  }),
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
function firstOrderExact(current,target,dtSec,tauSec){
  finite(current,'current');
  finite(target,'target');
  nonNegative(dtSec,'dtSec');
  positive(tauSec,'tauSec');
  if(dtSec===0) return current;
  const decay=Math.exp(-dtSec/tauSec);
  return target+(current-target)*decay;
}

function localO2Target({
  venousO2MlPerMl,
  normalVenousO2MlPerMl,
  gain,
}={}){
  nonNegative(venousO2MlPerMl,'venousO2MlPerMl');
  nonNegative(normalVenousO2MlPerMl,'normalVenousO2MlPerMl');
  nonNegative(gain,'gain');
  // Source Eq. 41 steady target:
  // 0 = -x - G*(CvO2-CvO2n)
  return -gain*(venousO2MlPerMl-normalVenousO2MlPerMl);
}

function resistanceFromLocalO2({
  normalResistanceMmHgSecPerMl,
  localState,
}={}){
  positive(normalResistanceMmHgSecPerMl,'normalResistanceMmHgSecPerMl');
  finite(localState,'localState');
  if(!(1+localState>0)){
    throw new Error('1 + localState must remain > 0');
  }
  // Source Eq. 42.
  return normalResistanceMmHgSecPerMl/(1+localState);
}

function createUrsinoMagosso2000LocalO2Candidate(){
  let x={brain:0,heart:0,muscle:0};
  let state=Object.freeze({
    authority:SOURCE.authority,
    active:false,
    localState:Object.freeze({...x}),
    provenance:SOURCE,
  });

  function step({
    dtSec,
    pao2MmHg,
    paco2MmHg=40,
    brainFlowMlPerSec,
    coronaryFlowMlPerSec,
    muscleFlowMlPerSec,
    muscleNormalResistanceMmHgSecPerMl,
    averageCardiacPumpPowerMmHgMlPerSec=O2_P.metabolism.heartBasalPowerMmHgMlPerSec,
  }={}){
    nonNegative(dtSec,'dtSec');
    nonNegative(pao2MmHg,'pao2MmHg');
    positive(paco2MmHg,'paco2MmHg');
    positive(brainFlowMlPerSec,'brainFlowMlPerSec');
    positive(coronaryFlowMlPerSec,'coronaryFlowMlPerSec');
    positive(muscleFlowMlPerSec,'muscleFlowMlPerSec');
    positive(
      muscleNormalResistanceMmHgSecPerMl,
      'muscleNormalResistanceMmHgSecPerMl'
    );
    nonNegative(
      averageCardiacPumpPowerMmHgMlPerSec,
      'averageCardiacPumpPowerMmHgMlPerSec'
    );

    const ca=arterialO2ConcentrationMlO2PerMlBlood({
      pao2MmHg,paco2MmHg,
    });

    const consumption={
      brain:O2_P.metabolism.brainO2ConsumptionMlPerSec,
      muscle:O2_P.metabolism.muscleO2ConsumptionMlPerSec,
      heart:heartO2ConsumptionMlPerSec({
        averagePumpPowerMmHgMlPerSec:averageCardiacPumpPowerMmHgMlPerSec,
      }),
    };

    const cv={
      brain:venousO2ConcentrationSameUnits({
        arterialO2Concentration:ca,
        oxygenConsumptionPerSec:consumption.brain,
        bloodFlowPerSec:brainFlowMlPerSec,
      }),
      heart:venousO2ConcentrationSameUnits({
        arterialO2Concentration:ca,
        oxygenConsumptionPerSec:consumption.heart,
        bloodFlowPerSec:coronaryFlowMlPerSec,
      }),
      muscle:venousO2ConcentrationSameUnits({
        arterialO2Concentration:ca,
        oxygenConsumptionPerSec:consumption.muscle,
        bloodFlowPerSec:muscleFlowMlPerSec,
      }),
    };

    const target={};
    for(const bed of ['brain','heart','muscle']){
      target[bed]=localO2Target({
        venousO2MlPerMl:cv[bed],
        normalVenousO2MlPerMl:LOCAL[bed].normalVenousO2MlPerMl,
        gain:LOCAL[bed].gain,
      });
      x[bed]=firstOrderExact(x[bed],target[bed],dtSec,LOCAL[bed].tauSec);
    }

    const resistance={
      brain:resistanceFromLocalO2({
        normalResistanceMmHgSecPerMl:LOCAL.brain.normalResistanceMmHgSecPerMl,
        localState:x.brain,
      }),
      heart:resistanceFromLocalO2({
        normalResistanceMmHgSecPerMl:LOCAL.heart.normalResistanceMmHgSecPerMl,
        localState:x.heart,
      }),
      muscle:resistanceFromLocalO2({
        normalResistanceMmHgSecPerMl:muscleNormalResistanceMmHgSecPerMl,
        localState:x.muscle,
      }),
    };

    state=Object.freeze({
      inputs:Object.freeze({
        pao2MmHg,paco2MmHg,
        brainFlowMlPerSec,coronaryFlowMlPerSec,muscleFlowMlPerSec,
        muscleNormalResistanceMmHgSecPerMl,
        averageCardiacPumpPowerMmHgMlPerSec,
      }),
      arterialO2MlPerMl:ca,
      venousO2MlPerMl:Object.freeze(cv),
      oxygenConsumptionMlPerSec:Object.freeze(consumption),
      target:Object.freeze(target),
      localState:Object.freeze({...x}),
      resistanceMmHgSecPerMl:Object.freeze(resistance),
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      active:true,
      provenance:SOURCE,
    });
    return state;
  }

  return Object.freeze({
    step,
    snapshot:()=>state,
    source:SOURCE,
    parameters:LOCAL,
  });
}

module.exports=Object.freeze({
  SOURCE,LOCAL,
  firstOrderExact,localO2Target,resistanceFromLocalO2,
  createUrsinoMagosso2000LocalO2Candidate,
});
