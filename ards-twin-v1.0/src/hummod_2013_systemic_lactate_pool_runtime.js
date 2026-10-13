'use strict';

/**
 * HumMod 2013 persistent systemic lactate-pool runtime for v1.6.
 *
 * Primary source:
 * nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * - Structure/Lactate/LacPool.DES
 * - Structure/Sizing/Sizing-LactatePool.DES
 *
 * Source continuous equation:
 *   d(LacPool.Mass)/dt = sum(all tissue lactate outfluxes)
 *                        + IVDrip.LacRate + PumpRate
 *
 * HumMod time base is minutes. With caller-supplied rates held over a step,
 * the mass update is exact under zero-order hold.
 *
 * Candidate only. No canonical bedside authority.
 */

const {
  SOURCE:PROVIDER_SOURCE,
  OUTFLOW_KEYS,
  initialLactatePool2013,
  lactatePoolConcentration2013,
  lactatePoolMassDerivative2013,
}=require('./hummod_2013_lactate_pool_provider.js');

const SOURCE=Object.freeze({
  ...PROVIDER_SOURCE,
  files:Object.freeze([
    'Structure/Lactate/LacPool.DES',
    'Structure/Sizing/Sizing-LactatePool.DES',
  ]),
  equation:
    'LacPool.Change = sum(tissue lactate outfluxes) + IVDrip.LacRate + PumpRate',
  numericalImplementation:'exact-ZOH mass update for held source rates',
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

function createHumMod2013SystemicLactatePoolRuntime({
  initialEcfvMl,
  initialMassMeq=null,
}={}){
  positive(initialEcfvMl,'initialEcfvMl');
  const init=initialLactatePool2013({initialEcfvMl});
  let massMeq=initialMassMeq==null?init.initialMassMeq:initialMassMeq;
  nonNegative(massMeq,'initialMassMeq');

  let timeSec=0;
  let last=null;

  function step({
    dtSec,
    ecfvMl,
    tissueOutflowsMeqPerMin,
    ivDripLactateRateMeqPerMin,
    pumpRateMeqPerMin,
  }={}){
    positive(dtSec,'dtSec');
    positive(ecfvMl,'ecfvMl');

    const d=lactatePoolMassDerivative2013({
      tissueOutflowsMeqPerMin,
      ivDripLactateRateMeqPerMin,
      pumpRateMeqPerMin,
    });

    const beforeMassMeq=massMeq;
    const dtMin=dtSec/60;
    massMeq+=dtMin*d.changeMeqPerMin;

    if(massMeq<0&&massMeq>-1e-12) massMeq=0;
    if(massMeq<0){
      throw new Error('LacPool mass became negative');
    }

    const concentration=lactatePoolConcentration2013({
      massMeq,
      ecfvMl,
    });

    timeSec+=dtSec;
    last=Object.freeze({
      schema:'hummod-2013-systemic-lactate-pool-runtime/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      massMeq,
      beforeMassMeq,
      concentrationMeqPerMl:concentration.concentrationMeqPerMl,
      concentrationMeqPerL:concentration.concentrationMeqPerL,
      concentrationMgDl:concentration.concentrationMgDl,
      ecfvMl,
      tissueOutflowTotalMeqPerMin:d.tissueOutflowTotalMeqPerMin,
      ivDripLactateRateMeqPerMin:d.ivDripLactateRateMeqPerMin,
      pumpRateMeqPerMin:d.pumpRateMeqPerMin,
      changeMeqPerMin:d.changeMeqPerMin,
      requiredTissueOutflowKeys:OUTFLOW_KEYS,
      controlAuthority:false,
      provenance:SOURCE,
    });
    return last;
  }

  function snapshot({ecfvMl=null}={}){
    if(last) return last;
    const base={
      schema:'hummod-2013-systemic-lactate-pool-runtime/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,
      massMeq,
      concentrationMeqPerMl:null,
      concentrationMeqPerL:null,
      concentrationMgDl:null,
      requiredTissueOutflowKeys:OUTFLOW_KEYS,
      controlAuthority:false,
      provenance:SOURCE,
    };
    if(ecfvMl!=null){
      positive(ecfvMl,'ecfvMl');
      const c=lactatePoolConcentration2013({massMeq,ecfvMl});
      base.concentrationMeqPerMl=c.concentrationMeqPerMl;
      base.concentrationMeqPerL=c.concentrationMeqPerL;
      base.concentrationMgDl=c.concentrationMgDl;
    }
    return Object.freeze(base);
  }

  return Object.freeze({
    step,
    snapshot,
    source:SOURCE,
    requiredTissueOutflowKeys:OUTFLOW_KEYS,
  });
}

module.exports=Object.freeze({
  SOURCE,
  createHumMod2013SystemicLactatePoolRuntime,
});
