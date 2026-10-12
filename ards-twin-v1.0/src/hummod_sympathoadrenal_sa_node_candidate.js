'use strict';

/**
 * Source-aligned HumMod sympathoadrenal / SA-node candidate.
 *
 * Pinned source family:
 * riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
 *
 * Exact source chain represented here:
 * SympsCNS.NA(Hz)
 *   -> AdrenalNerve.NA(Hz) = SympsCNS.NA(Hz) (absent block)
 *   -> GangliaGeneral.NA(Hz) = SympsCNS.NA(Hz) (absent block)
 *   -> NE/Epi secretion + NE spillover
 *   -> NE/Epi pools -> BetaPool.Effect
 *   -> SANode-BetaReceptors.Activity
 *   -> SANode-Rate sympathetic effect
 * plus HumMod VagusNerve -> SANode-Rate parasympathetic effect.
 *
 * Candidate only. No canonical control authority.
 *
 * Numerical coupling:
 * The autonomic state for the current interval drives catecholamine pool
 * integration over dt. The resulting humoral alpha/beta effects are used on
 * the next autonomic step (explicit operator splitting). This adds no
 * physiologic parameter and must pass timestep-convergence testing.
 */

const {
  createHumModSourceAlignedAutonomicController,
}=require('./hummod_ards_autonomic_source_aligned.js');
const {
  createHumModSourceAlignedCatecholamines,
}=require('./hummod_ards_catecholamines_source_aligned.js');
const {
  HUMMOD_SOURCE_IDENTITY,
}=require('./hummod_source_identity.js');

const SOURCE=Object.freeze({
  sourceRepository:HUMMOD_SOURCE_IDENTITY.canonicalRepository,
  sourceRevision:HUMMOD_SOURCE_IDENTITY.canonicalRevision,
  reproducibilityMirrorRepository:
    HUMMOD_SOURCE_IDENTITY.reproducibilityMirrorRepository,
  reproducibilityMirrorRevision:
    HUMMOD_SOURCE_IDENTITY.reproducibilityMirrorRevision,
  equations:Object.freeze([
    'Structure/Nerves/SympsCNS.DES',
    'Structure/Nerves/AdrenalNerve.DES',
    'Structure/Nerves/GangliaGeneral.DES',
    'Structure/Nerves/VagusNerve.DES',
    'Structure/Catechols/NESecretion.DES',
    'Structure/Catechols/EpiSecretion.DES',
    'Structure/Catechols/NEPool.DES',
    'Structure/Catechols/EpiPool.DES',
    'Structure/Catechols/BetaPool.DES',
    'Structure/Heart/SANode-BetaReceptors.DES',
    'Structure/Heart/SANode-Rate.DES',
  ]),
  authority:'candidate-not-canonical',
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

function createHumModSympathoadrenalSaNodeCandidate({
  ecfvMl,
  initialCarotidPressureMmHg=97,
  initialAverageAtrialTmpMmHg=6,
}={}){
  positive(ecfvMl,'ecfvMl');
  positive(initialCarotidPressureMmHg,'initialCarotidPressureMmHg');
  finite(initialAverageAtrialTmpMmHg,'initialAverageAtrialTmpMmHg');

  const autonomic=createHumModSourceAlignedAutonomicController({
    initialCarotidPressureMmHg,
  });
  const catechols=createHumModSourceAlignedCatecholamines({ecfvMl});

  let pool=catechols.snapshot();
  let state=null;

  function step({
    dtSec,
    carotidPressureMmHg,
    averageAtrialTmpMmHg=initialAverageAtrialTmpMmHg,
    brainFuelFractUseDelay=null,
    a2PoolLog10Conc=null,
    brainFunctionEffect=1,
    exerciseSympsTotalEffect=0,
    sympsChemoEffect=1,
    otherTissueFunctionEffect=1,
  }={}){
    positive(dtSec,'dtSec');
    finite(carotidPressureMmHg,'carotidPressureMmHg');
    finite(averageAtrialTmpMmHg,'averageAtrialTmpMmHg');
    if(brainFuelFractUseDelay!=null){
      finite(brainFuelFractUseDelay,'brainFuelFractUseDelay');
    }
    if(a2PoolLog10Conc!=null){
      finite(a2PoolLog10Conc,'a2PoolLog10Conc');
    }
    finite(brainFunctionEffect,'brainFunctionEffect');
    finite(exerciseSympsTotalEffect,'exerciseSympsTotalEffect');
    finite(sympsChemoEffect,'sympsChemoEffect');
    finite(otherTissueFunctionEffect,'otherTissueFunctionEffect');

    const a=autonomic.step({
      dtSec,
      carotidPressureMmHg,
      averageAtrialTmpMmHg,
      humoralAlphaPoolEffect:pool.alphaEffect,
      humoralBetaPoolEffect:pool.betaEffect,
      brainFuelFractUseDelay,
      a2PoolLog10Conc,
      brainFunctionEffect,
      exerciseSympsTotalEffect,
      sympsChemoEffect,
    });

    // Exact source identities when blockade/switches are inactive:
    // AdrenalNerve.NA(Hz) = SympsCNS.NA(Hz)
    // GangliaGeneral.NA(Hz) = SympsCNS.NA(Hz)
    const adrenalNerveHz=a.sympsCnsHz;
    const generalGangliaHz=a.sympsCnsHz;

    pool=catechols.step({
      dtSec,
      adrenalNerveHz,
      generalGangliaHz,
      otherTissueFunctionEffect,
    });

    state=Object.freeze({
      schema:'hummod-sympathoadrenal-sa-node-candidate/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      inputs:Object.freeze({
        carotidPressureMmHg,
        averageAtrialTmpMmHg,
        brainFuelFractUseDelay,
        a2PoolLog10Conc,
        brainFunctionEffect,
        exerciseSympsTotalEffect,
        sympsChemoEffect,
        otherTissueFunctionEffect,
      }),
      sympsCnsHz:a.sympsCnsHz,
      adrenalNerveHz,
      generalGangliaHz,
      vagusHz:a.vagusHz,
      catecholamines:pool,
      saBetaActivity:a.saBetaActivity,
      parasympatheticEffectPerMin:a.parasympatheticEffectPerMin,
      sympatheticEffectPerMin:a.sympatheticEffectPerMin,
      heartRatePerMin:a.heartRatePerMin,
      ventricularBetaActivity:a.ventricularBetaActivity,
      autonomic:a,
      numericalCoupling:Object.freeze({
        method:'explicit-operator-split',
        addedPhysiologicLag:false,
        convergenceRequired:true,
        note:
          'Current autonomic output integrates catecholamine pools over dt; updated pool effects enter the next autonomic step.',
      }),
      provenance:SOURCE,
    });
    return state;
  }

  function runFor(seconds,inputs){
    finite(seconds,'seconds');
    if(seconds<0) throw new Error('seconds must be >= 0');
    if(!inputs||typeof inputs!=='object') throw new Error('inputs object required');
    const dtSec=positive(inputs.dtSec,'inputs.dtSec');
    const n=Math.floor(seconds/dtSec+1e-9);
    for(let i=0;i<n;i++) step(inputs);
    const rem=seconds-n*dtSec;
    if(rem>1e-9) throw new Error('seconds must be integer multiple of dtSec');
    return snapshot();
  }

  function snapshot(){
    return state||Object.freeze({
      schema:'hummod-sympathoadrenal-sa-node-candidate/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      catecholamines:pool,
      heartRatePerMin:null,
      provenance:SOURCE,
    });
  }

  return Object.freeze({step,runFor,snapshot,source:SOURCE});
}

module.exports=Object.freeze({
  SOURCE,
  createHumModSympathoadrenalSaNodeCandidate,
});
