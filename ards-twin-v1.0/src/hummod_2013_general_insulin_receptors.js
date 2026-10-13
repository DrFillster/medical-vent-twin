'use strict';

/**
 * HumMod 2013 InsulinReceptors-General runtime for v1.6.
 * Source: Structure/Insulin/InsulinReceptors-General.DES
 *
 * Source:
 * Binding=K1*[Insulin]*Free
 * Unbinding=K2*Bound
 * Degradation=K3*Bound
 * dBound/dt=Binding-Unbinding-Degradation
 * dFree/dt=Unbinding-Binding+Degradation
 *
 * Candidate only.
 */

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'93ee1b30b74a0f2e60a2c961bbf569b4c8237611',
  file:'Structure/Insulin/InsulinReceptors-General.DES',
  authority:'candidate-not-canonical',
});
const INITIAL_BOUND=1520;
const INITIAL_FREE=17480;
const K1=0.0000489;
const K2=0.000394;
const K3=0.005526;
function finite(v,l){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(l+' must be finite');return v;}
function positive(v,l){finite(v,l);if(!(v>0))throw new Error(l+' must be > 0');return v;}
function nonNegative(v,l){finite(v,l);if(v<0)throw new Error(l+' must be >= 0');return v;}

function createHumMod2013GeneralInsulinReceptors({initialBound=INITIAL_BOUND,initialFree=INITIAL_FREE}={}){
  nonNegative(initialBound,'initialBound'); nonNegative(initialFree,'initialFree');
  const receptorSum=initialBound+initialFree; positive(receptorSum,'receptorSum');
  let bound=initialBound,timeSec=0,last=null;

  function step({dtSec,insulinSourceConcentration,t2d=0}={}){
    positive(dtSec,'dtSec'); nonNegative(insulinSourceConcentration,'insulinSourceConcentration'); nonNegative(t2d,'t2d');
    const a=K1*insulinSourceConcentration;
    const b=K2+K3;
    const lambda=a+b;
    const eq=(a*receptorSum)/lambda;
    bound=eq+(bound-eq)*Math.exp(-lambda*(dtSec/60));
    const free=receptorSum-bound;

    const total=free+bound-(t2d*10);
    if(!(total>0))throw new Error('InsulinReceptors-General Total must be > 0');
    const boundFraction=bound/total;
    const boundFractionPercent=100*boundFraction/(t2d+1);
    const bindingRatePerMin=K1*insulinSourceConcentration*free;
    const unbindingRatePerMin=K2*bound;
    const degradationRatePerMin=K3*bound;

    timeSec+=dtSec;
    last=Object.freeze({
      schema:'hummod-2013-general-insulin-receptors/v1',
      authority:SOURCE.authority,canonicalControlAuthority:false,timeSec,
      bound,free,total,boundFraction,boundFractionPercent,
      bindingRatePerMin,unbindingRatePerMin,degradationRatePerMin,
      netBindingRatePerMin:bindingRatePerMin-unbindingRatePerMin,
      insulinSourceConcentration,t2d,
      numericalImplementation:'exact-ZOH solution of conserved two-state source system',
      provenance:SOURCE,
    });
    return last;
  }

  function snapshot(){return last||Object.freeze({schema:'hummod-2013-general-insulin-receptors/v1',authority:SOURCE.authority,canonicalControlAuthority:false,timeSec,bound,free:receptorSum-bound,provenance:SOURCE});}
  return Object.freeze({step,snapshot,source:SOURCE});
}
module.exports=Object.freeze({SOURCE,INITIAL_BOUND,INITIAL_FREE,K1,K2,K3,createHumMod2013GeneralInsulinReceptors});
