'use strict';

/**
 * HumMod 2013 persistent KCell runtime for v1.6.
 *
 * Primary source:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * - Structure/K/KCell.DES
 * - Structure/K/KFluxToCell.DES
 * - Structure/K/KFluxToPool.DES
 *
 * Source continuous equation:
 *   d(KCell.Mass)/dt = KFluxToCell.Rate - KFluxToPool.Rate
 *
 * with:
 *   KFluxToCell.Rate = 0.0018 * KAldoEffect.Delayed * KPool.Mass
 *   KFluxToPool.Rate = 8e-5 * (KCell.Mass - 2180)
 *
 * HumMod time base is minutes. This implementation advances the linear
 * equation with the exact zero-order-hold solution over each caller step.
 *
 * Candidate only. No canonical bedside authority.
 */

const {
  SOURCE:PROVIDER_SOURCE,
  KCELL_CAPTIVE_MASS_MEQ,
  K_TO_CELL_BASIC_PER_MIN,
  K_TO_POOL_BASIC_PER_MIN,
  initialKCellMass2013,
  kCellConcentration2013,
}=require('./hummod_2013_kcell_provider.js');

const SOURCE=Object.freeze({
  ...PROVIDER_SOURCE,
  files:Object.freeze([
    'Structure/K/KCell.DES',
    'Structure/K/KFluxToCell.DES',
    'Structure/K/KFluxToPool.DES',
  ]),
  equation:'KCell.Change = KFluxToCell.Rate - KFluxToPool.Rate',
  numericalImplementation:'exact-ZOH integration of linear source mass equation',
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
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function createHumMod2013KCellRuntime({
  initialIcfvMl,
  initialMassMeq=null,
}={}){
  positive(initialIcfvMl,'initialIcfvMl');
  const init=initialKCellMass2013({initialIcfvMl});
  let massMeq=initialMassMeq==null?init.initialMassMeq:initialMassMeq;
  nonNegative(massMeq,'initialMassMeq');

  let timeSec=0;
  let last=null;

  function step({
    dtSec,
    kPoolMassMeq,
    delayedAldosteroneEffect,
    cellWaterVolumeMl,
  }={}){
    positive(dtSec,'dtSec');
    nonNegative(kPoolMassMeq,'kPoolMassMeq');
    nonNegative(delayedAldosteroneEffect,'delayedAldosteroneEffect');
    positive(cellWaterVolumeMl,'cellWaterVolumeMl');

    const gainRateMeqPerMin=
      K_TO_CELL_BASIC_PER_MIN*delayedAldosteroneEffect*kPoolMassMeq;

    const b=K_TO_POOL_BASIC_PER_MIN;
    const equilibriumMassMeq=
      KCELL_CAPTIVE_MASS_MEQ+(gainRateMeqPerMin/b);
    const dtMin=dtSec/60;
    const decay=Math.exp(-b*dtMin);

    const beforeMassMeq=massMeq;
    massMeq=equilibriumMassMeq+
      (massMeq-equilibriumMassMeq)*decay;

    if(massMeq<0&&massMeq>-1e-12) massMeq=0;
    if(massMeq<0) throw new Error('KCell mass became negative');

    const lossRateMeqPerMin=
      K_TO_POOL_BASIC_PER_MIN*(massMeq-KCELL_CAPTIVE_MASS_MEQ);
    const concentration=kCellConcentration2013({
      kCellMassMeq:massMeq,
      cellWaterVolumeMl,
    });

    timeSec+=dtSec;
    last=Object.freeze({
      schema:'hummod-2013-kcell-runtime/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      massMeq,
      concentrationMeqPerMl:concentration.concentrationMeqPerMl,
      concentrationMeqPerL:concentration.concentrationMeqPerL,
      beforeMassMeq,
      gainRateMeqPerMin,
      lossRateMeqPerMin,
      kPoolMassMeq,
      delayedAldosteroneEffect,
      cellWaterVolumeMl,
      internal:Object.freeze({
        equilibriumMassMeq,
        decay,
        dtMin,
      }),
      controlAuthority:false,
      provenance:SOURCE,
    });
    return last;
  }

  function snapshot({cellWaterVolumeMl=null}={}){
    if(last) return last;
    const base={
      schema:'hummod-2013-kcell-runtime/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      massMeq,
      concentrationMeqPerMl:null,
      concentrationMeqPerL:null,
      controlAuthority:false,
      provenance:SOURCE,
    };
    if(cellWaterVolumeMl!=null){
      positive(cellWaterVolumeMl,'cellWaterVolumeMl');
      const c=kCellConcentration2013({
        kCellMassMeq:massMeq,
        cellWaterVolumeMl,
      });
      base.concentrationMeqPerMl=c.concentrationMeqPerMl;
      base.concentrationMeqPerL=c.concentrationMeqPerL;
    }
    return Object.freeze(base);
  }

  return Object.freeze({
    step,
    snapshot,
    source:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  createHumMod2013KCellRuntime,
});
