'use strict';

/**
 * HumMod 2013 systemic InsulinPool runtime for v1.6.
 * Source: nysuloem/HumMod-UTSC-CPG@93ee1b30b74a0f2e60a2c961bbf569b4c8237611
 * Structure/Insulin/InsulinPool.DES
 *
 * Candidate only. Upstream secretion/clearance remain explicit.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  file:'Structure/Insulin/InsulinPool.DES',
  authority:'candidate-not-canonical',
});
const TARGET_INSULIN=20;
const REQUIRED_RATES=Object.freeze([
  'insulinSecretionRatePerMin',
  'insulinPumpRatePerMin',
  'insulinInjectionAbsorbRatePerMin',
  'generalReceptorUnbindingRatePerMin',
  'liverReceptorUnbindingRatePerMin',
  'insulinClearanceRatePerMin',
]);
function finite(v,l){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(l+' must be finite');return v;}
function positive(v,l){finite(v,l);if(!(v>0))throw new Error(l+' must be > 0');return v;}
function nonNegative(v,l){finite(v,l);if(v<0)throw new Error(l+' must be >= 0');return v;}

function createHumMod2013InsulinPoolRuntime({initialEcfvMl,initialMass=null}={}){
  positive(initialEcfvMl,'initialEcfvMl');
  let mass=initialMass==null?TARGET_INSULIN*(initialEcfvMl/1000):initialMass;
  nonNegative(mass,'initialMass');
  let timeSec=0,last=null;

  function step({dtSec,ecfvMl,rates}={}){
    positive(dtSec,'dtSec'); positive(ecfvMl,'ecfvMl');
    if(!rates||typeof rates!=='object')throw new Error('rates object is required');
    const missing=REQUIRED_RATES.filter(k=>rates[k]==null);
    if(missing.length)throw new Error('missing InsulinPool source rates: '+missing.join(', '));
    for(const k of REQUIRED_RATES)nonNegative(rates[k],k);

    const gain=rates.insulinSecretionRatePerMin+
      rates.insulinPumpRatePerMin+
      rates.insulinInjectionAbsorbRatePerMin+
      rates.generalReceptorUnbindingRatePerMin+
      rates.liverReceptorUnbindingRatePerMin;
    const loss=rates.insulinClearanceRatePerMin;
    mass+=(dtSec/60)*(gain-loss);
    if(mass<0&&mass>-1e-12)mass=0;
    if(mass<0)throw new Error('InsulinPool mass became negative');

    const insulinSourceConcentration=mass/(ecfvMl/1000);
    timeSec+=dtSec;
    last=Object.freeze({
      schema:'hummod-2013-insulin-pool-runtime/v1',
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      timeSec,mass,ecfvMl,insulinSourceConcentration,
      gainPerMin:gain,lossPerMin:loss,changePerMin:gain-loss,
      requiredRates:REQUIRED_RATES,provenance:SOURCE,
    });
    return last;
  }

  function snapshot({ecfvMl=null}={}){
    if(last)return last;
    const x={schema:'hummod-2013-insulin-pool-runtime/v1',authority:SOURCE.authority,canonicalControlAuthority:false,timeSec,mass,requiredRates:REQUIRED_RATES,provenance:SOURCE};
    if(ecfvMl!=null){positive(ecfvMl,'ecfvMl');x.insulinSourceConcentration=mass/(ecfvMl/1000);}
    return Object.freeze(x);
  }
  return Object.freeze({step,snapshot,source:SOURCE,requiredRates:REQUIRED_RATES});
}
module.exports=Object.freeze({SOURCE,TARGET_INSULIN,REQUIRED_RATES,createHumMod2013InsulinPoolRuntime});
