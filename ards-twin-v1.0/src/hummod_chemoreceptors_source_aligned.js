'use strict';

const {hermite}=require('./hummod_ards_autonomic_source_aligned.js');
const {humModSource}=require('./hummod_source_identity.js');

const PO2_EFFECT=Object.freeze([
  Object.freeze({x:30,y:10.0,slope:0}),
  Object.freeze({x:60,y:2.0,slope:-0.05}),
  Object.freeze({x:94,y:0.5,slope:-0.005}),
  Object.freeze({x:400,y:0.2,slope:0}),
]);
const PH_EFFECT=Object.freeze([
  Object.freeze({x:7.10,y:2.0,slope:0}),
  Object.freeze({x:7.44,y:0.4,slope:-3.0}),
  Object.freeze({x:7.70,y:0.0,slope:0}),
]);
const SYMPS_EFFECT=Object.freeze([
  Object.freeze({x:0,y:0.0,slope:0}),
  Object.freeze({x:1,y:0.1,slope:0.2}),
  Object.freeze({x:4,y:0.6,slope:0}),
]);
const ACCLIMATION_STEADY_STATE=Object.freeze([
  Object.freeze({x:0,y:0,slope:0}),
  Object.freeze({x:1,y:1,slope:0.3}),
  Object.freeze({x:10,y:2,slope:0}),
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

function createHumModChemoreceptors({
  initialAcclimationEffect=1,
  acclimationTauMin=20,
}={}){
  finite(initialAcclimationEffect,'initialAcclimationEffect');
  positive(acclimationTauMin,'acclimationTauMin');
  let acclimationEffect=initialAcclimationEffect;
  let last=null;

  function step({
    dtSec,
    arterialPo2MmHg,
    arterialPh,
    gangliaGeneralHz,
    alphaPoolEffect,
    alphaBlockadeEffect=1,
    otherTissueFunctionFailed=false,
    clamp=false,
    clampLevel=0,
  }={}){
    positive(dtSec,'dtSec');
    finite(arterialPo2MmHg,'arterialPo2MmHg');
    finite(arterialPh,'arterialPh');
    finite(gangliaGeneralHz,'gangliaGeneralHz');
    finite(alphaPoolEffect,'alphaPoolEffect');
    finite(alphaBlockadeEffect,'alphaBlockadeEffect');
    finite(clampLevel,'clampLevel');

    const po2Effect=hermite(PO2_EFFECT,arterialPo2MmHg);
    const phEffect=hermite(PH_EFFECT,arterialPh);
    const alphaAgonism=alphaBlockadeEffect*
      ((0.5*gangliaGeneralHz)+(0.5*alphaPoolEffect));
    const sympsEffect=hermite(SYMPS_EFFECT,alphaAgonism);
    const basicFiringRate=po2Effect+phEffect+sympsEffect;

    const steadyState=hermite(ACCLIMATION_STEADY_STATE,basicFiringRate);
    // Source delay: K = 1/(60*Tau) on HumMod minute timebase.
    // Converted to seconds here as a first-order stable-delay integration.
    const tauSec=60*acclimationTauMin;
    acclimationEffect +=
      (steadyState-acclimationEffect)*(dtSec/tauSec);

    let firingRate;
    if(clamp) firingRate=clampLevel;
    else if(otherTissueFunctionFailed) firingRate=0;
    else firingRate=basicFiringRate*acclimationEffect;

    last=Object.freeze({
      arterialPo2MmHg,
      arterialPh,
      gangliaGeneralHz,
      alphaPoolEffect,
      alphaAgonism,
      po2Effect,
      phEffect,
      sympsEffect,
      basicFiringRate,
      acclimationSteadyState:steadyState,
      acclimationEffect,
      firingRate,
      provenance:Object.freeze({
        status:'source-aligned-chemoreceptor-signal',
        receptorSource:humModSource('Structure/Nerves/Chemoreceptors.DES','Chemoreceptors.Calc'),
        acclimationSource:humModSource('Structure/Nerves/ChemoreceptorAcclimation.DES','ChemoreceptorAcclimation'),
        sympsChemoSource:humModSource('Structure/Nerves/SympsChemo.DES','SympsChemo.Calc'),
        sympsChemoEffectInPinnedSource:1.0,
        drivesSympsCnsInBrowser:false,
        clinicalValidation:false,
      }),
    });
    return last;
  }

  function snapshot(){
    return last||Object.freeze({
      acclimationEffect,
      firingRate:null,
      provenance:Object.freeze({
        status:'initialized',
        drivesSympsCnsInBrowser:false,
      }),
    });
  }

  return Object.freeze({kind:'hummod-source-aligned-chemoreceptors',step,snapshot});
}

module.exports={
  PO2_EFFECT,PH_EFFECT,SYMPS_EFFECT,ACCLIMATION_STEADY_STATE,
  createHumModChemoreceptors,
};
