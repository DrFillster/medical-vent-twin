'use strict';

// Stateful transcription of the pinned 2013 KCell/KPool exchange and KAldoEffect.
// All extrarenal/renal sources and both current water volumes are mandatory.
// This closes the potassium balance equations, not their upstream providers.
const {hermite}=require('./hummod_2013_left_heart_contractility_candidate.js');
const {
  K_TO_CELL_BASIC_PER_MIN,
  K_TO_POOL_BASIC_PER_MIN,
  KCELL_CAPTIVE_MASS_MEQ,
}=require('./hummod_2013_kcell_provider.js');

const SOURCE=Object.freeze({
  repository:'nysuloem/HumMod-UTSC-CPG',
  revision:'51d369eb75669e150ef7c61e3ba8bcb1e068aecf',
  files:Object.freeze(['KCell.DES','KPool.DES','KFluxToCell.DES',
    'KFluxToPool.DES','KAldoEffect.DES'].map(n=>'Structure/K/'+n)),
  authority:'candidate-not-canonical',
});
const ALDO_TAU_MIN=120;
const ALDO_EFFECT=Object.freeze([
  Object.freeze({x:0,y:0.9,slope:0}),
  Object.freeze({x:300,y:1,slope:0.00025}),
  Object.freeze({x:1500,y:1.1,slope:0}),
]);
const EXTERNAL_RATES=Object.freeze([
  'giAbsorptionMeqPerMin','ivDripMeqPerMin','transfusionMeqPerMin',
  'collectingDuctOutflowMeqPerMin','sweatOutflowMeqPerMin',
  'hemorrhageMeqPerMin','dialyzerFluxMeqPerMin',
]);
function finite(x,name){
  if(typeof x!=='number'||!Number.isFinite(x))throw new Error(name+' must be finite');
  return x;
}
function nonNegative(x,name){
  finite(x,name);if(x<0)throw new Error(name+' must be >= 0');return x;
}
function positive(x,name){
  finite(x,name);if(!(x>0))throw new Error(name+' must be > 0');return x;
}

function createHumMod2013PotassiumBalanceCandidate({
  initialCellMassMeq,initialPoolMassMeq,
}={}){
  let cell=nonNegative(initialCellMassMeq,'initialCellMassMeq');
  let pool=nonNegative(initialPoolMassMeq,'initialPoolMassMeq');
  let delayedAldosteroneEffect=1; // KAldoEffect delay initialval, not a clamp.
  let timeSec=0;
  let last=null;
  function step(inputs={}){
    const dtMin=positive(inputs.dtSec,'dtSec')/60;
    const cellWaterVolumeMl=positive(inputs.cellWaterVolumeMl,'cellWaterVolumeMl');
    const ecfvMl=positive(inputs.ecfvMl,'ecfvMl');
    const aldo=nonNegative(inputs.aldosteronePmolPerL,'aldosteronePmolPerL');
    // Dialyzer flux is signed in the source (a negative flux adds K).
    for(const key of EXTERNAL_RATES)finite(inputs[key],key);
    const externalGain=inputs.giAbsorptionMeqPerMin+inputs.ivDripMeqPerMin+
      inputs.transfusionMeqPerMin;
    const externalLoss=inputs.collectingDuctOutflowMeqPerMin+
      inputs.sweatOutflowMeqPerMin+inputs.hemorrhageMeqPerMin+
      inputs.dialyzerFluxMeqPerMin;
    const net=externalGain-externalLoss;
    const immediate=hermite(ALDO_EFFECT,aldo);

    // Lie split: exchange uses the start-of-interval delayed effect; then the
    // source first-order aldosterone delay is advanced exactly for held input.
    // Backward Euler jointly advances both exchange masses. The exchange flux
    // cancels algebraically, so total K changes by dt*(external gain-loss).
    // No mass floor or invented repair is applied if an interval exhausts K.
    const a=K_TO_CELL_BASIC_PER_MIN*delayedAldosteroneEffect;
    const b=K_TO_POOL_BASIC_PER_MIN;
    const total=cell+pool+dtMin*net;
    const nextCell=(cell+dtMin*(a*total+b*KCELL_CAPTIVE_MASS_MEQ))/
      (1+dtMin*(a+b));
    const nextPool=total-nextCell;
    nonNegative(nextCell,'advanced KCell mass');
    nonNegative(nextPool,'advanced KPool mass');
    const nextDelayed=immediate+(delayedAldosteroneEffect-immediate)*
      Math.exp(-dtMin/ALDO_TAU_MIN);
    const toCell=a*nextPool;
    const toPool=b*(nextCell-KCELL_CAPTIVE_MASS_MEQ);
    const conservationResidual=nextCell+nextPool-(cell+pool)-dtMin*net;
    const cellResidual=nextCell-cell-dtMin*(toCell-toPool);
    const poolResidual=nextPool-pool-dtMin*(net+toPool-toCell);
    cell=nextCell;pool=nextPool;delayedAldosteroneEffect=nextDelayed;
    timeSec+=inputs.dtSec;
    last=Object.freeze({
      ...snapshotBase(),
      cellConcentrationMeqPerMl:cell/cellWaterVolumeMl,
      poolConcentrationMeqPerMl:pool/ecfvMl,
      cellConcentrationMeqPerL:1000*cell/cellWaterVolumeMl,
      poolConcentrationMeqPerL:1000*pool/ecfvMl,
      immediateAldosteroneEffect:immediate,
      fluxToCellMeqPerMin:toCell,fluxToPoolMeqPerMin:toPool,
      externalNetMeqPerMin:net,
      residuals:Object.freeze({conservationResidual,cellResidual,poolResidual}),
      inputs:Object.freeze({...inputs}),
    });
    return last;
  }
  function snapshotBase(){
    return {
      schema:'hummod-2013-potassium-balance-candidate/v1',timeSec,
      cellMassMeq:cell,poolMassMeq:pool,delayedAldosteroneEffect,
      controlAuthority:false,canonicalControlAuthority:false,provenance:SOURCE,
      numericalImplementation:'coupled backward-Euler exchange; exact held-input aldosterone delay; first-order Lie splitting',
      liveProviderReadiness:'blocked until water, aldosterone and every external K rate are supplied by live source providers',
    };
  }
  return Object.freeze({step,snapshot:()=>last||Object.freeze(snapshotBase())});
}
module.exports=Object.freeze({SOURCE,ALDO_TAU_MIN,ALDO_EFFECT,EXTERNAL_RATES,
  createHumMod2013PotassiumBalanceCandidate});
