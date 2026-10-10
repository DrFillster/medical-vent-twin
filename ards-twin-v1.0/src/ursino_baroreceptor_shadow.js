'use strict';

/**
 * Ursino 1998 carotid/sinoaortic baroreceptor afferent shadow.
 *
 * Physiologic source:
 * Ursino M. Interaction between carotid baroregulation and the pulsating heart:
 * a mathematical model. Am J Physiol Heart Circ Physiol. 1998;275:H1733-H1747.
 * doi:10.1152/ajpheart.1998.275.5.H1733.
 *
 * Parameter transcription cross-check:
 * PLOS Comput Biol. 2024;20:e1012377, Table 2, explicitly states that all
 * baroreflex values are taken from Ursino 1998 and uses arterial pressure as
 * a surrogate for carotid sinus pressure.
 *
 * Shadow only. No output has physiologic authority.
 */

const SOURCE=Object.freeze({
  primary:'Ursino M. Am J Physiol Heart Circ Physiol. 1998;275:H1733-H1747.',
  doi:'10.1152/ajpheart.1998.275.5.H1733',
  surrogateCrossCheck:'PLOS Comput Biol. 2024;20:e1012377',
  status:'published-equation-shadow-only',
});

const P=Object.freeze({
  pressureMidMmHg:92,
  fMinSpikesPerSec:2.52,
  fMaxSpikesPerSec:47.78,
  kMmHg:11.758,
  tauPoleSec:2.076,
  tauZeroSec:6.37,
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function nonNegative(v,label){ finite(v,label); if(v<0) throw new Error(label+' must be >= 0'); return v; }

function baroreceptorStatic(filteredPressureMmHg){
  finite(filteredPressureMmHg,'filteredPressureMmHg');
  const e=Math.exp((filteredPressureMmHg-P.pressureMidMmHg)/P.kMmHg);
  return (P.fMinSpikesPerSec+P.fMaxSpikesPerSec*e)/(1+e);
}

function createUrsinoBaroreceptorShadow(){
  let filteredPressureMmHg=null;
  let previousPressureMmHg=null;
  let state=Object.freeze({
    arterialPressureMmHg:null,
    filteredPressureMmHg:null,
    pressureDerivativeMmHgPerSec:null,
    fAbSpikesPerSec:null,
    authority:'shadow-diagnostic-only',
    pressureMapping:'systemic arterial pressure used as published-surrogate for carotid sinus pressure',
    provenance:SOURCE,
  });

  function step({dtSec,arterialPressureMmHg}={}){
    nonNegative(dtSec,'dtSec');
    finite(arterialPressureMmHg,'arterialPressureMmHg');
    const derivative=previousPressureMmHg==null || dtSec===0
      ? 0
      : (arterialPressureMmHg-previousPressureMmHg)/dtSec;
    const target=arterialPressureMmHg+P.tauZeroSec*derivative;
    if(filteredPressureMmHg==null){
      filteredPressureMmHg=arterialPressureMmHg;
    }else if(dtSec>0){
      const decay=Math.exp(-dtSec/P.tauPoleSec);
      filteredPressureMmHg=target+(filteredPressureMmHg-target)*decay;
    }
    previousPressureMmHg=arterialPressureMmHg;
    state=Object.freeze({
      arterialPressureMmHg,
      filteredPressureMmHg,
      pressureDerivativeMmHgPerSec:derivative,
      fAbSpikesPerSec:baroreceptorStatic(filteredPressureMmHg),
      authority:'shadow-diagnostic-only',
      pressureMapping:'systemic arterial pressure used as published-surrogate for carotid sinus pressure',
      provenance:SOURCE,
    });
    return state;
  }

  return Object.freeze({step,snapshot:()=>state,parameters:P,source:SOURCE});
}

module.exports={SOURCE,P,baroreceptorStatic,createUrsinoBaroreceptorShadow};
