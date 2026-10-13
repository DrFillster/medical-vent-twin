'use strict';

/**
 * HumMod 2013 systemic FAPool runtime for v1.6.
 *
 * Source:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * Structure/FattyAcid/FAPool.DES
 *
 * dMass/dt =
 *   triglyceride hydrolysis fatty-acid rate
 * + lipid-deposit release
 * - total metabolic fatty-acid burn
 * - lipid-deposit uptake
 * - hepatic fatty-acid use for ketoacids
 * - fatty-acid decomposition
 *
 * Candidate only. No canonical bedside authority.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  file:'Structure/FattyAcid/FAPool.DES',
  authority:'candidate-not-canonical',
});

const TARGET_FA_MG_PER_ML=0.160;
const PER_ML_TO_PER_DL=100;
const MG_TO_MMOL=3.92;

const REQUIRED_RATES=Object.freeze([
  'triglycerideHydrolysisFattyAcidRateMgPerMin',
  'lipidDepositsReleaseMgPerMin',
  'metabolismFattyAcidTotalBurnMgPerMin',
  'lipidDepositsUptakeMgPerMin',
  'liverKetoacidFattyAcidUseMgPerMin',
  'faDecompositionMgPerMin',
]);

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

function initialMass2013({initialEcfvMl}={}){
  positive(initialEcfvMl,'initialEcfvMl');
  return TARGET_FA_MG_PER_ML*initialEcfvMl;
}

function concentrations({massMg,ecfvMl}={}){
  nonNegative(massMg,'massMg');
  positive(ecfvMl,'ecfvMl');
  const fattyAcidMgPerMl=massMg/ecfvMl;
  return Object.freeze({
    fattyAcidMgPerMl,
    fattyAcidMgDl:PER_ML_TO_PER_DL*fattyAcidMgPerMl,
    fattyAcidMmolPerL:MG_TO_MMOL*fattyAcidMgPerMl,
  });
}

function createHumMod2013FattyAcidPoolRuntime({
  initialEcfvMl,
  initialMassMg=null,
}={}){
  positive(initialEcfvMl,'initialEcfvMl');
  let massMg=initialMassMg==null?initialMass2013({initialEcfvMl}):initialMassMg;
  nonNegative(massMg,'initialMassMg');
  let timeSec=0;
  let last=null;

  function step({dtSec,ecfvMl,rates}={}){
    positive(dtSec,'dtSec');
    positive(ecfvMl,'ecfvMl');
    if(!rates||typeof rates!=='object') throw new Error('rates object is required');
    const missing=REQUIRED_RATES.filter(k=>rates[k]==null);
    if(missing.length) throw new Error('missing FAPool source rates: '+missing.join(', '));
    for(const k of REQUIRED_RATES) nonNegative(rates[k],k);

    const gain=
      rates.triglycerideHydrolysisFattyAcidRateMgPerMin+
      rates.lipidDepositsReleaseMgPerMin;
    const loss=
      rates.metabolismFattyAcidTotalBurnMgPerMin+
      rates.lipidDepositsUptakeMgPerMin+
      rates.liverKetoacidFattyAcidUseMgPerMin+
      rates.faDecompositionMgPerMin;
    const changeMgPerMin=gain-loss;
    massMg+=(dtSec/60)*changeMgPerMin;
    if(massMg<0&&massMg>-1e-9) massMg=0;
    if(massMg<0) throw new Error('FAPool mass became negative');

    const c=concentrations({massMg,ecfvMl});
    timeSec+=dtSec;
    last=Object.freeze({
      schema:'hummod-2013-fatty-acid-pool-runtime/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      massMg,
      ecfvMl,
      gainMgPerMin:gain,
      lossMgPerMin:loss,
      changeMgPerMin,
      ...c,
      requiredRates:REQUIRED_RATES,
      provenance:SOURCE,
    });
    return last;
  }

  function snapshot({ecfvMl=null}={}){
    if(last) return last;
    const base={
      schema:'hummod-2013-fatty-acid-pool-runtime/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      massMg,
      requiredRates:REQUIRED_RATES,
      provenance:SOURCE,
    };
    if(ecfvMl!=null) Object.assign(base,concentrations({massMg,ecfvMl}));
    return Object.freeze(base);
  }

  return Object.freeze({step,snapshot,source:SOURCE,requiredRates:REQUIRED_RATES});
}

module.exports=Object.freeze({
  SOURCE,
  TARGET_FA_MG_PER_ML,
  PER_ML_TO_PER_DL,
  MG_TO_MMOL,
  REQUIRED_RATES,
  initialMass2013,
  concentrations,
  createHumMod2013FattyAcidPoolRuntime,
});
