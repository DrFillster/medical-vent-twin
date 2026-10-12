'use strict';

/**
 * Parallel cardiopulmonary compensation candidate.
 *
 * Source-backed chain:
 * arterial O2 / cerebral perfusion
 *   -> HumMod Brain-Flow O2 use
 *   -> HumMod Brain-Metabolism aerobic/anaerobic split
 *   -> HumMod Brain-Fuel fractional substrate delivery + StableDelay
 *   -> HumMod SympsCNS FuelEffect
 *   -> AdrenalNerve / GangliaGeneral / Vagus
 *   -> NE/Epi pools / BetaPool
 *   -> SA-node beta receptors
 *   -> SA-node rate
 *
 * All non-derived boundaries are explicit inputs. No PaO2->HR, pH->HR,
 * or tissue-PO2->Brain-Fuel substitution is used.
 */

const {
  solveBrainFlow,
}=require('./hummod_brain_hypoxia_source_aligned.js');
const {
  createHumModBrainFuelCandidate,
}=require('./hummod_brain_fuel_candidate.js');
const {
  createHumModSympathoadrenalSaNodeCandidate,
}=require('./hummod_sympathoadrenal_sa_node_candidate.js');

const SOURCE=Object.freeze({
  brainFlow:'HumMod Structure/Brain/Brain-Flow.DES',
  brainMetabolism:'HumMod Structure/Brain/Brain-Metabolism.DES',
  brainFuel:'HumMod Structure/Brain/Brain-Fuel.DES',
  autonomic:'HumMod Structure/Nerves/SympsCNS.DES',
  sympathoadrenal:[
    'HumMod Structure/Nerves/AdrenalNerve.DES',
    'HumMod Structure/Nerves/GangliaGeneral.DES',
    'HumMod Structure/Catechols/NESecretion.DES',
    'HumMod Structure/Catechols/EpiSecretion.DES',
    'HumMod Structure/Catechols/BetaPool.DES',
  ],
  saNode:[
    'HumMod Structure/Heart/SANode-BetaReceptors.DES',
    'HumMod Structure/Heart/SANode-Rate.DES',
  ],
  reproducibilityRevision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',
  authority:'candidate-not-canonical',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){
  finite(v,label); if(!(v>0)) throw new Error(label+' must be > 0'); return v;
}
function nonNegative(v,label){
  finite(v,label); if(v<0) throw new Error(label+' must be >= 0'); return v;
}

function createHumModCardiopulmonaryCompensationCandidate({
  dtSec,
  ecfvMl,
  initialCarotidPressureMmHg=97,
  initialAverageAtrialTmpMmHg=6,
  initialBrainFuelFractUseDelay=1,
}={}){
  positive(dtSec,'dtSec');
  positive(ecfvMl,'ecfvMl');

  const brainFuel=createHumModBrainFuelCandidate({
    initialFractUseDelay:initialBrainFuelFractUseDelay,
  });
  const autonomic=createHumModSympathoadrenalSaNodeCandidate({
    ecfvMl,
    initialCarotidPressureMmHg,
    initialAverageAtrialTmpMmHg,
  });

  let timeSec=0;
  let last=null;

  function step({
    arterialPo2MmHg,
    arterialO2ContentMlPerMl,
    o2MaxMlPerMl,
    venousPh,
    venousPco2MmHg,
    carboxyPercent=0,
    tempC=37,
    cerebralPressureGradientMmHg,
    brainPco2MmHg,
    brainO2NeedMlPerMin,
    plasmaVolumeFraction,
    glucoseMgPerMl,
    ketoacidMgPerMl,
    brainLactateMgPerDl,
    carotidPressureMmHg,
    averageAtrialTmpMmHg=initialAverageAtrialTmpMmHg,
    a2PoolLog10Conc=null,
    brainFunctionEffect=1,
    exerciseSympsTotalEffect=0,
    sympsChemoEffect=1,
    otherTissueFunctionEffect=1,
    anesthesiaVascularConductance=1,
    viscosityConductanceEffect=1,
    brainVasculatureEffect=1,
  }={}){
    [
      ['arterialPo2MmHg',arterialPo2MmHg],
      ['arterialO2ContentMlPerMl',arterialO2ContentMlPerMl],
      ['o2MaxMlPerMl',o2MaxMlPerMl],
      ['venousPh',venousPh],
      ['venousPco2MmHg',venousPco2MmHg],
      ['tempC',tempC],
      ['cerebralPressureGradientMmHg',cerebralPressureGradientMmHg],
      ['brainPco2MmHg',brainPco2MmHg],
      ['brainO2NeedMlPerMin',brainO2NeedMlPerMin],
      ['plasmaVolumeFraction',plasmaVolumeFraction],
      ['glucoseMgPerMl',glucoseMgPerMl],
      ['ketoacidMgPerMl',ketoacidMgPerMl],
      ['brainLactateMgPerDl',brainLactateMgPerDl],
      ['carotidPressureMmHg',carotidPressureMmHg],
    ].forEach(([k,v])=>finite(v,k));
    if(plasmaVolumeFraction<0||plasmaVolumeFraction>1){
      throw new Error('plasmaVolumeFraction must be between 0 and 1');
    }
    nonNegative(glucoseMgPerMl,'glucoseMgPerMl');
    nonNegative(ketoacidMgPerMl,'ketoacidMgPerMl');
    nonNegative(brainLactateMgPerDl,'brainLactateMgPerDl');

    const brainFlow=solveBrainFlow({
      arterialPo2MmHg,
      arterialO2ContentMlPerMl,
      o2MaxMlPerMl,
      venousPh,
      venousPco2MmHg,
      carboxyPercent,
      tempC,
      pressureGradientMmHg:cerebralPressureGradientMmHg,
      brainPco2MmHg,
      o2NeedMlPerMin:brainO2NeedMlPerMin,
      anesthesiaVascularConductance,
      viscosityConductanceEffect,
      brainVasculatureEffect,
    });

    const plasmaFlowMlPerMin=
      brainFlow.bloodFlowMlPerMin*plasmaVolumeFraction;

    const fuel=brainFuel.step({
      dtSec,
      plasmaFlowMlPerMin,
      glucoseMgPerMl,
      ketoacidMgPerMl,
      lactateMgPerDl:brainLactateMgPerDl,
      o2NeedMlPerMin:brainO2NeedMlPerMin,
      o2UseMlPerMin:brainFlow.o2UseMlPerMin,
    });

    const sa=autonomic.step({
      dtSec,
      carotidPressureMmHg,
      averageAtrialTmpMmHg,
      brainFuelFractUseDelay:fuel.fractUseDelay,
      a2PoolLog10Conc,
      brainFunctionEffect,
      exerciseSympsTotalEffect,
      sympsChemoEffect,
      otherTissueFunctionEffect,
    });

    timeSec+=dtSec;
    last=Object.freeze({
      schema:'hummod-cardiopulmonary-compensation-candidate/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      inputs:Object.freeze({
        arterialPo2MmHg,
        arterialO2ContentMlPerMl,
        cerebralPressureGradientMmHg,
        brainPco2MmHg,
        brainO2NeedMlPerMin,
        plasmaVolumeFraction,
        glucoseMgPerMl,
        ketoacidMgPerMl,
        brainLactateMgPerDl,
        carotidPressureMmHg,
      }),
      brainFlow,
      plasmaFlowMlPerMin,
      brainFuel:fuel,
      sympathoadrenalSaNode:sa,
      heartRatePerMin:sa.heartRatePerMin,
      epiPgPerMl:sa.catecholamines.epiPgPerMl,
      nePgPerMl:sa.catecholamines.nePgPerMl,
      betaEffect:sa.catecholamines.betaEffect,
      provenance:SOURCE,
      limitations:Object.freeze({
        brainPco2Boundary:
          'explicit input; do not equate arterial or venous PCO2 without a source-valid local-brain CO2 provider',
        substratePools:
          'explicit glucose/ketoacid/lactate boundaries; systemic pool dynamics not yet integrated here',
        myocardialDepression:
          'not included in this compensation candidate',
        controlAuthority:false,
      }),
    });
    return last;
  }

  function runFor(seconds,inputs){
    finite(seconds,'seconds');
    if(seconds<0) throw new Error('seconds must be >= 0');
    const n=Math.floor(seconds/dtSec+1e-9);
    for(let i=0;i<n;i++) step(inputs);
    const rem=seconds-n*dtSec;
    if(rem>1e-9) throw new Error('seconds must be integer multiple of dtSec');
    return snapshot();
  }

  function snapshot(){
    return last||Object.freeze({
      schema:'hummod-cardiopulmonary-compensation-candidate/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      heartRatePerMin:null,
      provenance:SOURCE,
    });
  }

  return Object.freeze({step,runFor,snapshot,source:SOURCE});
}

module.exports=Object.freeze({
  SOURCE,
  createHumModCardiopulmonaryCompensationCandidate,
});
