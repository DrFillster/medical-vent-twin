'use strict';

/**
 * HumMod 2013 compensation -> LV decompensation candidate.
 *
 * Source-consistent ownership:
 * - arterial PO2 + arterial pH -> 2013 chemoreflex / sympathoadrenal / SA-node
 * - cardiac Ganglia + Beta1Pool -> LeftHeart-BetaReceptors
 * - myocardial intracellular pH -> LeftHeartPumping-Contractility.pH
 * - contractility -> 2013 LV systolic K -> implicit ESV/SBP -> SV/CO
 *
 * Myocardial intracellular pH remains an explicit upstream state in this
 * candidate. It is NOT replaced by arterial pH.
 *
 * Pump sizing remains explicit because HumMod derives it from body-composition
 * context. No synthetic sizing fixture is treated as a source default.
 */

const {
  createHumMod2013ChemoreflexSaNodeCandidate,
}=require('./hummod_2013_chemoreflex_sa_node_candidate.js');
const {
  leftHeartContractility,
}=require('./hummod_2013_left_heart_contractility_candidate.js');
const {
  solveLeftHeartPump2013,
}=require('./hummod_2013_left_heart_pump_candidate.js');

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'51d369eb75669e150ef7c61e3ba8bcb1e068aecf',
  generation:'HumMod-2012/2013',
  authority:'candidate-not-canonical',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}

function createHumMod2013CompensationDecompensationCandidate({
  ecfvMl,
  sourceSizing,
  initialArterialPh=7.44,
}={}){
  positive(ecfvMl,'ecfvMl');
  if(!sourceSizing||typeof sourceSizing!=='object'){
    throw new Error('sourceSizing is required');
  }

  const autonomic=createHumMod2013ChemoreflexSaNodeCandidate({
    ecfvMl,
    initialArterialPh,
  });
  let timeSec=0;
  let last=null;

  function step({
    dtSec,
    arterialPo2MmHg,
    arterialPh,
    myocardialIntracellularPh,
    meanArterialPressureMmHg,
    leftAtrialPressureMmHg,
    pericardialPressureMmHg,
    contractileProteinFunctionalRatio=1,
    digoxinPoolConcentration=0,
    anesthesiaHeartContractility=1,
    basicContractility=1,
    stiffness=1,
    systolicX=1,
    mitralStenosisEffect=1,
    aorticStenosisEffect=1,
    mitralRegurgitationEffect=1,
    aorticRegurgitationEffect=1,
  }={}){
    positive(dtSec,'dtSec');
    [
      ['arterialPo2MmHg',arterialPo2MmHg],
      ['arterialPh',arterialPh],
      ['myocardialIntracellularPh',myocardialIntracellularPh],
      ['meanArterialPressureMmHg',meanArterialPressureMmHg],
      ['leftAtrialPressureMmHg',leftAtrialPressureMmHg],
      ['pericardialPressureMmHg',pericardialPressureMmHg],
    ].forEach(([k,v])=>finite(v,k));

    const a=autonomic.step({
      dtSec,
      arterialPo2MmHg,
      arterialPh,
    });

    const c=leftHeartContractility({
      cardiacGangliaHz:a.ganglia.cardiacHz,
      beta1PoolEffect:a.catecholamines.beta1Effect,
      myocardialIntracellularPh,
      contractileProteinFunctionalRatio,
      digoxinPoolConcentration,
      anesthesiaHeartContractility,
      basic:basicContractility,
    });

    const p=solveLeftHeartPump2013({
      meanArterialPressureMmHg,
      leftAtrialPressureMmHg,
      pericardialPressureMmHg,
      heartRatePerMin:a.heartRatePerMin,
      contractility:c.contractility,
      sourceSizing,
      stiffness,
      systolicX,
      mitralStenosisEffect,
      aorticStenosisEffect,
      mitralRegurgitationEffect,
      aorticRegurgitationEffect,
    });

    timeSec+=dtSec;
    last=Object.freeze({
      schema:'hummod-2013-compensation-decompensation-candidate/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      inputs:Object.freeze({
        arterialPo2MmHg,
        arterialPh,
        myocardialIntracellularPh,
        meanArterialPressureMmHg,
        leftAtrialPressureMmHg,
        pericardialPressureMmHg,
      }),
      autonomic:a,
      leftHeartContractility:c,
      leftHeartPump:p,
      heartRatePerMin:a.heartRatePerMin,
      strokeVolumeMl:p.strokeVolumeMl,
      cardiacOutputMlPerMin:p.bloodFlowMlPerMin,
      provenance:SOURCE,
      ownership:Object.freeze({
        acuteCompensation:
          'HumMod 2012/2013 chemoreflex -> sympathoadrenal/cardiac sympathetic -> SA-node',
        myocardialDepression:
          'HumMod LeftHeart-Ph -> LeftHeartPumping-Contractility -> 2013 LV pump',
        myocardialIntracellularPh:
          'explicit upstream input; arterial pH is not substituted',
        pumpSizing:
          'explicit HumMod source-sizing state supplied by caller',
      }),
      controlAuthority:false,
    });
    return last;
  }

  function runFor(seconds,inputs){
    finite(seconds,'seconds');
    if(seconds<0) throw new Error('seconds must be >= 0');
    const dtSec=positive(inputs.dtSec,'inputs.dtSec');
    const n=Math.floor(seconds/dtSec+1e-9);
    for(let i=0;i<n;i++) step(inputs);
    const rem=seconds-n*dtSec;
    if(rem>1e-9) throw new Error('seconds must be integer multiple of dtSec');
    return snapshot();
  }

  function snapshot(){
    return last||Object.freeze({
      schema:'hummod-2013-compensation-decompensation-candidate/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      heartRatePerMin:null,
      strokeVolumeMl:null,
      cardiacOutputMlPerMin:null,
      provenance:SOURCE,
      controlAuthority:false,
    });
  }

  return Object.freeze({step,runFor,snapshot,source:SOURCE});
}

module.exports=Object.freeze({
  SOURCE,
  createHumMod2013CompensationDecompensationCandidate,
});
