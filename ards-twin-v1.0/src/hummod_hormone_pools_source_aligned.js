'use strict';

const {humModSource}=require('./hummod_source_identity.js');

const A2_CONC_FACTOR=0.3333;
const A2_PG_TO_PMOL=0.956;
const A2_CE_BASE=30.0;
const ADH_PG_TO_PMOL=0.922;
const ADH_PG_TO_UUNITS=0.400;
const ADH_TARGET_PG_PER_ML=2.0;

function finite(v,label){if(typeof v!=='number'||!Number.isFinite(v))throw new Error(label+' must be finite');return v;}
function nonNegative(v,label){finite(v,label);if(v<0)throw new Error(label+' must be >= 0');return v;}
function positive(v,label){finite(v,label);if(!(v>0))throw new Error(label+' must be > 0');return v;}

function a2PoolConcentration({
  reninPra,
  a2PumpRate=0,
  blockPercent=0,
  ceBase=A2_CE_BASE,
}={}){
  nonNegative(reninPra,'reninPra');
  finite(a2PumpRate,'a2PumpRate');
  finite(blockPercent,'blockPercent');
  positive(ceBase,'ceBase');
  if(blockPercent<0||blockPercent>100)throw new Error('blockPercent must be between 0 and 100');
  const ceActivity=ceBase*(1-blockPercent/100);
  const endogenousRate=reninPra*ceActivity;
  const formationRate=endogenousRate+a2PumpRate;
  const pgPerMl=A2_CONC_FACTOR*formationRate;
  const pmolPerL=A2_PG_TO_PMOL*pgPerMl;
  const log10Conc=pgPerMl>1?Math.log10(pgPerMl):0;
  return Object.freeze({
    ceActivity,endogenousRate,formationRate,pgPerMl,pmolPerL,log10Conc,
    provenance:Object.freeze({
      status:'source-aligned-equation',
      source:humModSource('Structure/Renin/A2Pool.DES','A2Pool.CalcConc'),
      clinicalValidation:false,
    }),
  });
}

function createAdhPool({
  ecfvInitialLiters,
  initialConcentrationPgPerMl=ADH_TARGET_PG_PER_ML,
}={}){
  positive(ecfvInitialLiters,'ecfvInitialLiters');
  nonNegative(initialConcentrationPgPerMl,'initialConcentrationPgPerMl');
  let mass=initialConcentrationPgPerMl*ecfvInitialLiters;
  let last=null;

  function snapshot(ecfvLiters=ecfvInitialLiters){
    positive(ecfvLiters,'ecfvLiters');
    const pgPerMl=mass/ecfvLiters;
    return Object.freeze({
      mass,
      pgPerMl,
      pmolPerL:ADH_PG_TO_PMOL*pgPerMl,
      uUPerMl:ADH_PG_TO_UUNITS*pgPerMl,
      log10Conc:pgPerMl>1?Math.log10(pgPerMl):0,
      ...(last||{}),
      provenance:Object.freeze({
        status:'source-aligned-pool-with-explicit-integration-adaptation',
        source:humModSource('Structure/ADH/ADHPool.DES','ADHPool'),
        integration:'piecewise-constant gain/loss over caller timestep; DES solver identity not claimed',
        clinicalValidation:false,
      }),
    });
  }

  function step({
    dtSec,
    ecfvLiters,
    secretionRate=0,
    pumpRate=0,
    clearanceRate=0,
  }={}){
    positive(dtSec,'dtSec');
    positive(ecfvLiters,'ecfvLiters');
    finite(secretionRate,'secretionRate');
    finite(pumpRate,'pumpRate');
    finite(clearanceRate,'clearanceRate');
    const gain=secretionRate+pumpRate;
    const loss=clearanceRate;
    const change=gain-loss;
    mass += change*(dtSec/60);
    if(!(mass>=0)||!Number.isFinite(mass))throw new Error('ADH mass became non-physical');
    last=Object.freeze({gain,loss,change,ecfvLiters});
    return snapshot(ecfvLiters);
  }

  return Object.freeze({kind:'hummod-source-aligned-adh-pool',step,snapshot});
}

module.exports={
  A2_CONC_FACTOR,A2_PG_TO_PMOL,A2_CE_BASE,
  ADH_PG_TO_PMOL,ADH_PG_TO_UUNITS,ADH_TARGET_PG_PER_ML,
  a2PoolConcentration,createAdhPool,
};
