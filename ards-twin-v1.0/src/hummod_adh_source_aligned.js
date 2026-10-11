'use strict';

// Source-aligned HumMod ADH algebra and mass-balance primitives.
// Sources:
// Structure/ADH/ADHFastMass.DES
// Structure/ADH/ADHSlowMass.DES
// Structure/ADH/ADHSynthesis.DES
// Structure/ADH/ADHSecretion.DES
// Structure/ADH/ADHClearance.DES
// Structure/ADH/ADHPool.DES
// pinned to riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
//
// No osmolality, CNS sympathetic activity, ECFV, or organ-flow state is
// invented here. Those remain explicit inputs.

const FAST_INITIAL_MASS=3200.0;
const FAST_FLUX_K_PER_MIN=0.0043;
const SLOW_INITIAL_MASS=17000.0;
const SLOW_FLUX_K_PER_MIN=0.0010;
const SYNTHESIS_BASE=3.2;
const SECRETION_BASE_K=0.001;
const POOL_TARGET_PG_PER_ML=2.0;
const PG_TO_PMOL=0.922;
const PG_TO_UUNITS=0.400;
const CLEARANCE_K=Object.freeze({
  liver:0.0005,
  kidney:0.00059,
  other:0.00108,
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
function positive(v,label){
  finite(v,label);
  if(!(v>0)) throw new Error(label+' must be > 0');
  return v;
}
function lerp(x,x0,y0,x1,y1){
  if(x1===x0) return y0;
  return y0+(x-x0)*(y1-y0)/(x1-x0);
}

// Piecewise-linear source curves, preserving source plateaus.
function adhOsmEffect(deltaOsm){
  finite(deltaOsm,'deltaOsm');
  if(deltaOsm<=0.243) return 0;
  if(deltaOsm<0.253) return lerp(deltaOsm,0.243,0,0.253,1);
  if(deltaOsm<0.263) return lerp(deltaOsm,0.253,1,0.263,5);
  return 5;
}

function adhNeuralEffect(pituitaryNa){
  finite(pituitaryNa,'pituitaryNa');
  if(pituitaryNa<=0.50) return 0.4;
  if(pituitaryNa<1.00) return lerp(pituitaryNa,0.50,0.4,1.00,1.0);
  if(pituitaryNa<1.20) return lerp(pituitaryNa,1.00,1.0,1.20,2.0);
  if(pituitaryNa<1.50) return lerp(pituitaryNa,1.20,2.0,1.50,20.0);
  return 20.0;
}

function adhSynthesisFeedback(slowMass){
  nonNegative(slowMass,'slowMass');
  if(slowMass<=0) return 4.0;
  if(slowMass<17000) return lerp(slowMass,0,4.0,17000,1.0);
  if(slowMass<20000) return lerp(slowMass,17000,1.0,20000,0.0);
  return 0.0;
}

function adhSynthesisRate({slowMass}={}){
  const feedback=adhSynthesisFeedback(slowMass);
  return Object.freeze({
    feedback,
    rate:SYNTHESIS_BASE*feedback,
    controlAuthority:false,
  });
}

function adhStorageFluxes({fastMass,slowMass}={}){
  nonNegative(fastMass,'fastMass');
  nonNegative(slowMass,'slowMass');
  return Object.freeze({
    fastFlux:FAST_FLUX_K_PER_MIN*fastMass,
    slowFlux:SLOW_FLUX_K_PER_MIN*slowMass,
    controlAuthority:false,
  });
}

function adhSecretionRate({
  fastMass,
  bodyOsm,
  osmoreceptors,
  pituitaryNa,
}={}){
  nonNegative(fastMass,'fastMass');
  finite(bodyOsm,'bodyOsm');
  finite(osmoreceptors,'osmoreceptors');
  finite(pituitaryNa,'pituitaryNa');

  const base=SECRETION_BASE_K*fastMass;
  const osmEffect=adhOsmEffect(bodyOsm-osmoreceptors);
  const neuralEffect=adhNeuralEffect(pituitaryNa);
  return Object.freeze({
    base,
    osmEffect,
    neuralEffect,
    rate:base*osmEffect*neuralEffect,
    controlAuthority:false,
  });
}

function adhStorageMassDerivatives({
  fastMass,
  slowMass,
  secretionRate,
}={}){
  const flux=adhStorageFluxes({fastMass,slowMass});
  nonNegative(secretionRate,'secretionRate');
  const synthesis=adhSynthesisRate({slowMass});
  return Object.freeze({
    fastChange:flux.slowFlux-flux.fastFlux-secretionRate,
    slowChange:synthesis.rate+flux.fastFlux-flux.slowFlux,
    flux,
    synthesis,
    controlAuthority:false,
  });
}

function initialAdhPoolMass({initialEcfvL}={}){
  positive(initialEcfvL,'initialEcfvL');
  return POOL_TARGET_PG_PER_ML*initialEcfvL;
}

function adhPoolConcentration({
  poolMass,
  ecfvL,
}={}){
  nonNegative(poolMass,'poolMass');
  positive(ecfvL,'ecfvL');
  const pgPerMl=poolMass/ecfvL;
  return Object.freeze({
    pgPerMl,
    pmolPerL:PG_TO_PMOL*pgPerMl,
    uUPerMl:PG_TO_UUNITS*pgPerMl,
    log10Conc:pgPerMl>1?Math.log10(pgPerMl):0,
    controlAuthority:false,
  });
}

function adhClearance({
  adhPgPerMl,
  liverBloodFlowMlPerMin,
  kidneyBloodFlowMlPerMin,
  otherTissueBloodFlowMlPerMin,
}={}){
  nonNegative(adhPgPerMl,'adhPgPerMl');
  [
    ['liverBloodFlowMlPerMin',liverBloodFlowMlPerMin],
    ['kidneyBloodFlowMlPerMin',kidneyBloodFlowMlPerMin],
    ['otherTissueBloodFlowMlPerMin',otherTissueBloodFlowMlPerMin],
  ].forEach(([k,v])=>nonNegative(v,k));

  const liver=CLEARANCE_K.liver*liverBloodFlowMlPerMin*adhPgPerMl;
  const kidney=CLEARANCE_K.kidney*kidneyBloodFlowMlPerMin*adhPgPerMl;
  const other=CLEARANCE_K.other*otherTissueBloodFlowMlPerMin*adhPgPerMl;
  return Object.freeze({
    liver,
    kidney,
    other,
    total:liver+kidney+other,
    controlAuthority:false,
  });
}

function adhPoolMassDerivative({
  secretionRate,
  pumpRate=0,
  clearanceTotal,
}={}){
  nonNegative(secretionRate,'secretionRate');
  finite(pumpRate,'pumpRate');
  nonNegative(clearanceTotal,'clearanceTotal');
  return Object.freeze({
    gain:secretionRate+pumpRate,
    loss:clearanceTotal,
    change:secretionRate+pumpRate-clearanceTotal,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  FAST_INITIAL_MASS,
  FAST_FLUX_K_PER_MIN,
  SLOW_INITIAL_MASS,
  SLOW_FLUX_K_PER_MIN,
  SYNTHESIS_BASE,
  SECRETION_BASE_K,
  POOL_TARGET_PG_PER_ML,
  PG_TO_PMOL,
  PG_TO_UUNITS,
  CLEARANCE_K,
  adhOsmEffect,
  adhNeuralEffect,
  adhSynthesisFeedback,
  adhSynthesisRate,
  adhStorageFluxes,
  adhSecretionRate,
  adhStorageMassDerivatives,
  initialAdhPoolMass,
  adhPoolConcentration,
  adhClearance,
  adhPoolMassDerivative,
});
