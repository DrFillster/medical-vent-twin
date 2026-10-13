'use strict';

/**
 * HumMod 2013 blood-volume fraction provider for v1.6.
 *
 * Source:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * - Structure/BloodVolume/BloodVol.DES
 * - Structure/Sizing/Sizing-BloodVolume.DES
 *
 * Source equations:
 *   Vol   = RBCVol.Vol + PlasmaVol.Vol
 *   Hct   = RBCVol.Vol / Vol
 *   PVCrit = 1 - Hct
 *
 * Candidate only. No canonical bedside authority.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  files:Object.freeze([
    'Structure/BloodVolume/BloodVol.DES',
    'Structure/Sizing/Sizing-BloodVolume.DES',
  ]),
  authority:'candidate-not-canonical',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function bloodVolumeFractions2013({
  rbcVolumeMl,
  plasmaVolumeMl,
}={}){
  nonNegative(rbcVolumeMl,'rbcVolumeMl');
  nonNegative(plasmaVolumeMl,'plasmaVolumeMl');
  const bloodVolumeMl=rbcVolumeMl+plasmaVolumeMl;
  if(!(bloodVolumeMl>0)) throw new Error('total blood volume must be > 0');
  const hematocritFraction=rbcVolumeMl/bloodVolumeMl;
  const plasmaVolumeFraction=1-hematocritFraction;

  return Object.freeze({
    schema:'hummod-2013-blood-volume-fractions/v1',
    authority:SOURCE.authority,
    canonicalControlAuthority:false,
    rbcVolumeMl,
    plasmaVolumeMl,
    bloodVolumeMl,
    bloodVolumeL:bloodVolumeMl/1000,
    hematocritFraction,
    hematocritPercent:100*hematocritFraction,
    plasmaVolumeFraction,
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  bloodVolumeFractions2013,
});
