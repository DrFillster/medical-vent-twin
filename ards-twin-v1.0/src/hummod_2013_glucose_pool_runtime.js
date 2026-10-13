'use strict';

/**
 * HumMod 2013 systemic GlucosePool runtime for v1.6.
 *
 * Source:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * Structure/Glucose/GlucosePool.DES
 *
 * dMass/dt =
 *   GI carbohydrate absorption
 * + liver glucose release
 * + glucose pump
 * - total metabolic glucose uptake
 * - liver glucose uptake
 * - nephron spillover
 * - glucose decomposition
 *
 * Candidate only. No canonical bedside authority.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  file:'Structure/Glucose/GlucosePool.DES',
  authority:'candidate-not-canonical',
});

const BLOOD_TO_PLASMA=1.15;
const PER_ML_TO_PER_DL=100;
const MG_TO_MMOL=5.551;
const MW=180;

const REQUIRED_RATES=Object.freeze([
  'giCarbohydrateAbsorptionMgPerMin',
  'liverGlucoseReleaseMgPerMin',
  'glucosePumpRateMgPerMin',
  'metabolismGlucoseTotalUptakeMgPerMin',
  'liverGlucoseUptakeMgPerMin',
  'nephronGlucoseSpilloverMgPerMin',
  'glucoseDecompositionMgPerMin',
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

function concentrations({massMg,ecfvMl}={}){
  nonNegative(massMg,'massMg');
  positive(ecfvMl,'ecfvMl');
  const glucoseMgPerMl=massMg/ecfvMl;
  const bloodGlucoseMgPerMl=glucoseMgPerMl/BLOOD_TO_PLASMA;
  const osmoles=massMg/MW;
  const osmPerMl=osmoles/ecfvMl;
  return Object.freeze({
    glucoseMgPerMl,
    glucoseMgDl:PER_ML_TO_PER_DL*glucoseMgPerMl,
    glucoseMmolPerL:MG_TO_MMOL*glucoseMgPerMl,
    bloodGlucoseMgPerMl,
    bloodGlucoseMgDl:PER_ML_TO_PER_DL*bloodGlucoseMgPerMl,
    bloodGlucoseMmolPerL:MG_TO_MMOL*bloodGlucoseMgPerMl,
    osmoles,
    osmPerMl,
    osmMilliOsmPerL:1000*osmPerMl,
  });
}

function createHumMod2013GlucosePoolRuntime({
  initialMassMg,
}={}){
  nonNegative(initialMassMg,'initialMassMg');
  let massMg=initialMassMg;
  let timeSec=0;
  let last=null;

  function step({dtSec,ecfvMl,rates}={}){
    positive(dtSec,'dtSec');
    positive(ecfvMl,'ecfvMl');
    if(!rates||typeof rates!=='object') throw new Error('rates object is required');
    const missing=REQUIRED_RATES.filter(k=>rates[k]==null);
    if(missing.length) throw new Error('missing GlucosePool source rates: '+missing.join(', '));
    for(const k of REQUIRED_RATES) nonNegative(rates[k],k);

    const gain=
      rates.giCarbohydrateAbsorptionMgPerMin+
      rates.liverGlucoseReleaseMgPerMin+
      rates.glucosePumpRateMgPerMin;
    const loss=
      rates.metabolismGlucoseTotalUptakeMgPerMin+
      rates.liverGlucoseUptakeMgPerMin+
      rates.nephronGlucoseSpilloverMgPerMin+
      rates.glucoseDecompositionMgPerMin;
    const changeMgPerMin=gain-loss;
    massMg+=(dtSec/60)*changeMgPerMin;
    if(massMg<0&&massMg>-1e-9) massMg=0;
    if(massMg<0) throw new Error('GlucosePool mass became negative');

    const c=concentrations({massMg,ecfvMl});
    timeSec+=dtSec;
    last=Object.freeze({
      schema:'hummod-2013-glucose-pool-runtime/v1',
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
      schema:'hummod-2013-glucose-pool-runtime/v1',
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
  BLOOD_TO_PLASMA,
  PER_ML_TO_PER_DL,
  MG_TO_MMOL,
  MW,
  REQUIRED_RATES,
  concentrations,
  createHumMod2013GlucosePoolRuntime,
});
