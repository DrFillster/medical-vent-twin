'use strict';

/**
 * Integrated noncanonical cardiopulmonary compensation candidate.
 *
 * Important ownership boundary:
 * - HumMod 2012/2013 chemoreflex candidate owns acute autonomic/catecholamine/SA-node response.
 * - Existing source-aligned brain flow + Brain-Fuel chain is carried in parallel as a
 *   metabolic state only. It does NOT feed the newer sympathetic controller here.
 *
 * This deliberately avoids mixing the older 2011 SympsCNS controller with the
 * newer 2012/2013 branch-specific sympathetic architecture.
 */

const {
  solveBrainFlow,
}=require('./hummod_brain_hypoxia_source_aligned.js');
const {
  createHumModBrainFuelCandidate,
}=require('./hummod_brain_fuel_candidate.js');
const {
  createHumMod2013ChemoreflexSaNodeCandidate,
}=require('./hummod_2013_chemoreflex_sa_node_candidate.js');

const SOURCE=Object.freeze({
  authority:'candidate-not-canonical',
  autonomic:Object.freeze({
    repository:'nysuloem/HumMod-UTSC-CPG',
    revision:'51d369eb75669e150ef7c61e3ba8bcb1e068aecf',
    generation:'HumMod-2012/2013',
  }),
  cerebralMetabolic:Object.freeze({
    repository:'riliescu/hummod-standalone',
    revision:'8dab57e05631f779bf5020fe0dd51874d8ae98c1',
    status:'parallel-observation-only',
  }),
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
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function createHumMod2013CardiopulmonaryCompensationCandidate({
  dtSec,
  ecfvMl,
  initialArterialPh=7.44,
  initialBrainFuelFractUseDelay=1,
}={}){
  positive(dtSec,'dtSec');
  positive(ecfvMl,'ecfvMl');

  const chemo=createHumMod2013ChemoreflexSaNodeCandidate({
    ecfvMl,
    initialArterialPh,
  });
  const brainFuel=createHumModBrainFuelCandidate({
    initialFractUseDelay:initialBrainFuelFractUseDelay,
  });

  let timeSec=0;
  let last=null;

  function step({
    arterialPo2MmHg,
    arterialPh,
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
    anesthesiaVascularConductance=1,
    viscosityConductanceEffect=1,
    brainVasculatureEffect=1,
  }={}){
    [
      ['arterialPo2MmHg',arterialPo2MmHg],
      ['arterialPh',arterialPh],
      ['arterialO2ContentMlPerMl',arterialO2ContentMlPerMl],
      ['o2MaxMlPerMl',o2MaxMlPerMl],
      ['venousPh',venousPh],
      ['venousPco2MmHg',venousPco2MmHg],
      ['carboxyPercent',carboxyPercent],
      ['tempC',tempC],
      ['cerebralPressureGradientMmHg',cerebralPressureGradientMmHg],
      ['brainPco2MmHg',brainPco2MmHg],
      ['brainO2NeedMlPerMin',brainO2NeedMlPerMin],
      ['plasmaVolumeFraction',plasmaVolumeFraction],
      ['glucoseMgPerMl',glucoseMgPerMl],
      ['ketoacidMgPerMl',ketoacidMgPerMl],
      ['brainLactateMgPerDl',brainLactateMgPerDl],
    ].forEach(([k,v])=>finite(v,k));
    if(plasmaVolumeFraction<0||plasmaVolumeFraction>1){
      throw new Error('plasmaVolumeFraction must be between 0 and 1');
    }
    nonNegative(glucoseMgPerMl,'glucoseMgPerMl');
    nonNegative(ketoacidMgPerMl,'ketoacidMgPerMl');
    nonNegative(brainLactateMgPerDl,'brainLactateMgPerDl');

    const autonomic=chemo.step({
      dtSec,
      arterialPo2MmHg,
      arterialPh,
    });

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
    const cerebralFuel=brainFuel.step({
      dtSec,
      plasmaFlowMlPerMin,
      glucoseMgPerMl,
      ketoacidMgPerMl,
      lactateMgPerDl:brainLactateMgPerDl,
      o2NeedMlPerMin:brainO2NeedMlPerMin,
      o2UseMlPerMin:brainFlow.o2UseMlPerMin,
    });

    timeSec+=dtSec;
    last=Object.freeze({
      schema:'hummod-2013-cardiopulmonary-compensation-candidate/v1',
      timeSec,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      inputs:Object.freeze({
        arterialPo2MmHg,
        arterialPh,
        arterialO2ContentMlPerMl,
        cerebralPressureGradientMmHg,
        brainPco2MmHg,
      }),
      autonomic,
      brainFlow,
      cerebralFuel,
      heartRatePerMin:autonomic.heartRatePerMin,
      epiPgPerMl:autonomic.catecholamines.epiPgPerMl,
      nePgPerMl:autonomic.catecholamines.nePgPerMl,
      beta1Effect:autonomic.catecholamines.beta1Effect,
      provenance:SOURCE,
      ownership:Object.freeze({
        acuteChronotropy:'HumMod 2012/2013 chemoreflex sympathetic/catecholamine/SA-node chain',
        cerebralMetabolism:'parallel observation only',
        myocardialDepression:'not yet integrated',
        conductionFailure:'not yet integrated',
      }),
      limitations:Object.freeze({
        sourceGenerationBridge:
          'Cerebral metabolic chain does not feed the 2013 sympathetic controller in this candidate; doing so requires later-generation Brain-Fuel/sympathetic reproduction.',
        myocardialDepression:
          'Not yet integrated; combined severe hypoxia/acidemia remains a compensation-only state.',
        canonicalControlAuthority:false,
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
      schema:'hummod-2013-cardiopulmonary-compensation-candidate/v1',
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
  createHumMod2013CardiopulmonaryCompensationCandidate,
});
