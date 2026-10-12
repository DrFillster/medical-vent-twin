'use strict';

/**
 * Ursino & Magosso 2000 hypoxia-driven tidal-volume candidate.
 *
 * Primary source:
 * Ursino M, Magosso E. Acute cardiovascular response to isocapnic hypoxia.
 * I. A mathematical model. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165.
 * DOI 10.1152/ajpheart.2000.279.1.H149. Eqs. 28-29, Table 2.
 *
 * Intended use:
 * - source-reproduction / spontaneous-breathing validation;
 * - NOT mechanically ventilated bedside authority.
 *
 * In controlled ventilation, delivered VT remains owned by Vent.
 */

const SOURCE=Object.freeze({
  citation:'Ursino M, Magosso E. Am J Physiol Heart Circ Physiol. 2000;279:H149-H165.',
  doi:'10.1152/ajpheart.2000.279.1.H149',
  equations:Object.freeze([28,29]),
  authority:'candidate-not-canonical',
});

const P=Object.freeze({
  gainLPerNeuralRateUnit:0.125,
  tauSec:3,
  delaySec:6,
  basalTidalVolumeL:0.583,
  basalChemoreceptorSpikesPerSec:3.6,
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)){
    throw new Error(label+' must be finite');
  }
  return v;
}
function nonNegative(v,label){
  finite(v,label);
  if(v<0) throw new Error(label+' must be >= 0');
  return v;
}

function interpolate(history,target,fallback){
  if(!history.length) return fallback;
  if(target<history[0].t) return fallback;
  if(target===history[0].t) return history[0].v;
  for(let i=history.length-1;i>=1;i--){
    const a=history[i-1],b=history[i];
    if(a.t<=target&&target<=b.t){
      const span=b.t-a.t;
      if(!(span>0)) return a.v;
      const w=(target-a.t)/span;
      return a.v+w*(b.v-a.v);
    }
  }
  return history[history.length-1].v;
}

function createUrsinoMagosso2000TidalVolumeCandidate(){
  let timeSec=0;
  let deltaTidalVolumeL=0;
  const history=[];
  let state=Object.freeze({
    timeSec:0,
    tidalVolumeL:P.basalTidalVolumeL,
    deltaTidalVolumeL:0,
    authority:SOURCE.authority,
    canonicalControlAuthority:false,
    intendedMode:'spontaneous-source-validation-only',
    provenance:SOURCE,
  });

  function step({dtSec,fAcSpikesPerSec}={}){
    nonNegative(dtSec,'dtSec');
    nonNegative(fAcSpikesPerSec,'fAcSpikesPerSec');

    // Record the input at the beginning of the held interval. Before t=0,
    // Eq. 29 sees the basal chemoreceptor firing; do not back-fill the first
    // observed stimulus into negative-time history.
    if(!history.length){
      history.push({t:timeSec,v:fAcSpikesPerSec});
    }

    const delayed=interpolate(
      history,
      timeSec-P.delaySec,
      P.basalChemoreceptorSpikesPerSec
    );

    // Eqs. 28-29: chemoreceptor activity above the basal firing point
    // generates a delayed linear VT target, followed by first-order dynamics.
    const targetDeltaL=P.gainLPerNeuralRateUnit*
      (delayed-P.basalChemoreceptorSpikesPerSec);

    if(dtSec>0){
      const decay=Math.exp(-dtSec/P.tauSec);
      deltaTidalVolumeL=
        targetDeltaL+(deltaTidalVolumeL-targetDeltaL)*decay;
    }

    timeSec+=dtSec;
    history.push({t:timeSec,v:fAcSpikesPerSec});
    const keepAfter=timeSec-P.delaySec-2;
    while(history.length>2&&history[1].t<keepAfter) history.shift();

    const tidalVolumeL=P.basalTidalVolumeL+deltaTidalVolumeL;
    if(!(tidalVolumeL>0)){
      throw new Error('source tidal-volume candidate became non-positive');
    }

    state=Object.freeze({
      timeSec,
      fAcSpikesPerSec,
      delayedFAcSpikesPerSec:delayed,
      targetDeltaTidalVolumeL:targetDeltaL,
      deltaTidalVolumeL,
      tidalVolumeL,
      authority:SOURCE.authority,
      canonicalControlAuthority:false,
      intendedMode:'spontaneous-source-validation-only',
      provenance:SOURCE,
    });
    return state;
  }

  return Object.freeze({
    step,
    snapshot:()=>state,
    source:SOURCE,
    parameters:P,
  });
}

module.exports=Object.freeze({
  SOURCE,P,createUrsinoMagosso2000TidalVolumeCandidate,
});
