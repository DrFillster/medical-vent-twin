'use strict';

// Acute source-aligned HumMod autonomic subset for v1.2.
//
// Canonical source: HumMod/hummod-standalone
// Reproducibility mirror snapshot:
// riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
//
// Preserved source relations:
// - Baroreflex adaptation/pressure-effect structure
// - SympsCNS baroreflex effect
// - GangliaGeneral neural activity scaling
// - VagusNerve response
// - SANode-BetaReceptors neural/humoral weighting
// - SANode-Rate parasympathetic/sympathetic response
// - SystemicVeins alpha-receptor weighting and V0 effect
// - ventricular beta-receptor contractility relation
//
// Deliberate reductions:
// - low-pressure/mechanoreceptor/exercise/Cushing/brain-fuel terms fixed at
//   neutral values for the acute ventilator slice;
// - humoral alpha/beta pool effects are explicit normalized boundaries;
// - DES curve interpolation is reproduced with local cubic Hermite segments;
// - distributed organ vascular control is not represented here.

const {
  HUMMOD_SOURCE_IDENTITY,
} = require('./hummod_source_identity.js');

const HUMMOD_AUTONOMIC_SOURCE_REVISION =
  HUMMOD_SOURCE_IDENTITY.canonicalRevision;

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){ finite(v,label); if(!(v>0)) throw new Error(label+' must be > 0'); return v; }
function clamp(v,lo,hi){ return Math.max(lo,Math.min(hi,v)); }

function hermite(points,x){
  finite(x,'curve input');
  if(!Array.isArray(points)||points.length<2) throw new Error('curve requires >= 2 points');
  if(x<=points[0].x) return points[0].y + points[0].slope*(x-points[0].x);
  const last=points[points.length-1];
  if(x>=last.x) return last.y + last.slope*(x-last.x);
  let i=0;
  while(i+1<points.length && x>points[i+1].x) i++;
  const a=points[i], b=points[i+1];
  const h=b.x-a.x;
  const t=(x-a.x)/h;
  const h00=2*t*t*t-3*t*t+1;
  const h10=t*t*t-2*t*t+t;
  const h01=-2*t*t*t+3*t*t;
  const h11=t*t*t-t*t;
  return h00*a.y+h10*h*a.slope+h01*b.y+h11*h*b.slope;
}

const CURVES=Object.freeze({
  baroreflexPressureEffect:Object.freeze([
    Object.freeze({x:-50,y:0,slope:0}),
    Object.freeze({x:0,y:1,slope:0.02}),
    Object.freeze({x:50,y:2,slope:0}),
  ]),
  sympsCnsBaroEffect:Object.freeze([
    Object.freeze({x:0,y:1.5,slope:0}),
    Object.freeze({x:1,y:1,slope:-0.5}),
    Object.freeze({x:2,y:0.5,slope:0}),
  ]),
  vagusHz:Object.freeze([
    Object.freeze({x:0,y:8,slope:0}),
    Object.freeze({x:1.5,y:2,slope:-2}),
    Object.freeze({x:4.5,y:0,slope:0}),
  ]),
  saParasympatheticEffect:Object.freeze([
    Object.freeze({x:0,y:0,slope:0}),
    Object.freeze({x:2,y:-20,slope:-8}),
    Object.freeze({x:8,y:-40,slope:0}),
  ]),
  saSympatheticEffect:Object.freeze([
    Object.freeze({x:0,y:0,slope:0}),
    Object.freeze({x:1,y:10,slope:10}),
    Object.freeze({x:5,y:120,slope:0}),
  ]),
  systemicVeinsV0AlphaEffect:Object.freeze([
    Object.freeze({x:0,y:1.2,slope:0}),
    Object.freeze({x:1,y:1,slope:-0.30}),
    Object.freeze({x:3,y:0.6,slope:0}),
  ]),
});

const SOURCE_CONSTANTS=Object.freeze({
  baroreflexTauMin:10,
  sympsCnsHzScale:1.5,
  gangliaNaScale:0.667,
  vagusNaScale:0.667,
  receptorNeuralK:0.333,
  receptorHumoralK:0.5,
  saNodeBasicRatePerMin:82,
  systemicVeinsV0BasicMl:1700,
});

function receptorActivity({
  gangliaHz,
  humoralPoolEffect=1,
  neuralK=SOURCE_CONSTANTS.receptorNeuralK,
  humoralK=SOURCE_CONSTANTS.receptorHumoralK,
}={}){
  finite(gangliaHz,'gangliaHz');
  finite(humoralPoolEffect,'humoralPoolEffect');
  return neuralK*gangliaHz + humoralK*humoralPoolEffect;
}

function createHumModSourceAlignedAutonomicController({
  initialCarotidPressureMmHg=97,
  humoralAlphaPoolEffect=1,
  humoralBetaPoolEffect=1,
  baroSensitivity=1,
  saNodeBasicRatePerMin=SOURCE_CONSTANTS.saNodeBasicRatePerMin,
  systemicVenousV0BasicMl=SOURCE_CONSTANTS.systemicVeinsV0BasicMl,
}={}){
  positive(initialCarotidPressureMmHg,'initialCarotidPressureMmHg');
  finite(humoralAlphaPoolEffect,'humoralAlphaPoolEffect');
  finite(humoralBetaPoolEffect,'humoralBetaPoolEffect');
  finite(baroSensitivity,'baroSensitivity');
  positive(saNodeBasicRatePerMin,'saNodeBasicRatePerMin');
  positive(systemicVenousV0BasicMl,'systemicVenousV0BasicMl');

  let adaptedPressureMmHg=initialCarotidPressureMmHg;
  let last=null;

  function step({
    dtSec,
    carotidPressureMmHg,
  }={}){
    positive(dtSec,'dtSec');
    finite(carotidPressureMmHg,'carotidPressureMmHg');

    // HumMod Baroreflex: RateConst = 1/(60*Tau), Tau=10 min.
    const tauSec=60*SOURCE_CONSTANTS.baroreflexTauMin;
    adaptedPressureMmHg +=
      (carotidPressureMmHg-adaptedPressureMmHg)*
      (1-Math.exp(-dtSec/tauSec));

    const pressureChangeMmHg=carotidPressureMmHg-adaptedPressureMmHg;
    const baroreflexNa=hermite(CURVES.baroreflexPressureEffect,pressureChangeMmHg);

    // Acute subset keeps the omitted HumMod CNS inputs neutral (=1 multiplier,
    // zero additive drive), preserving the source baroreflex mapping itself.
    const sourceBaroEffect=hermite(CURVES.sympsCnsBaroEffect,baroreflexNa);
    const sympsCnsBaroEffect=1+baroSensitivity*(sourceBaroEffect-1);
    const sympsCnsNa=sympsCnsBaroEffect;
    const sympsCnsHz=SOURCE_CONSTANTS.sympsCnsHzScale*sympsCnsNa;

    const gangliaHz=sympsCnsHz;
    const gangliaNa=SOURCE_CONSTANTS.gangliaNaScale*gangliaHz;

    const vagusHz=clamp(hermite(CURVES.vagusHz,sympsCnsHz),0,8);
    const vagusNa=SOURCE_CONSTANTS.vagusNaScale*vagusHz;

    const saBetaActivity=receptorActivity({
      gangliaHz,
      humoralPoolEffect:humoralBetaPoolEffect,
    });
    const parasympatheticEffectPerMin=
      hermite(CURVES.saParasympatheticEffect,vagusHz);
    const sympatheticEffectPerMin=
      hermite(CURVES.saSympatheticEffect,saBetaActivity);
    const heartRatePerMin=clamp(
      saNodeBasicRatePerMin+
      parasympatheticEffectPerMin+
      sympatheticEffectPerMin,
      0,260);

    const ventricularBetaActivity=receptorActivity({
      gangliaHz,
      humoralPoolEffect:humoralBetaPoolEffect,
    });

    const venousAlphaActivity=receptorActivity({
      gangliaHz,
      humoralPoolEffect:humoralAlphaPoolEffect,
    });
    const systemicVenousV0AlphaEffect=
      hermite(CURVES.systemicVeinsV0AlphaEffect,venousAlphaActivity);
    const systemicVenousV0Ml=
      systemicVenousV0BasicMl*systemicVenousV0AlphaEffect;

    last=Object.freeze({
      carotidPressureMmHg,
      adaptedPressureMmHg,
      pressureChangeMmHg,
      baroreflexNa,
      sympsCnsBaroEffect,
      sympsCnsNa,
      sympsCnsHz,
      gangliaHz,
      gangliaNa,
      vagusHz,
      vagusNa,
      saBetaActivity,
      parasympatheticEffectPerMin,
      sympatheticEffectPerMin,
      heartRatePerMin,
      ventricularBetaActivity,
      contractilityMultiplier:ventricularBetaActivity,
      venousAlphaActivity,
      systemicVenousV0AlphaEffect,
      systemicVenousV0Ml,
    });
    return snapshot();
  }

  function snapshot(){
    return Object.freeze({
      schema:'hummod-source-aligned-autonomic/v1.2',
      ...(last||{
        adaptedPressureMmHg,
        heartRatePerMin:null,
        contractilityMultiplier:null,
        systemicVenousV0Ml:null,
      }),
      provenance:Object.freeze({
        status:'source-aligned-acute-subset',
        sourceRepository:HUMMOD_SOURCE_IDENTITY.canonicalRepository,
        sourceRevision:HUMMOD_AUTONOMIC_SOURCE_REVISION,
        sourceCanonicalStatus:HUMMOD_SOURCE_IDENTITY.canonicalStatus,
        reproducibilityMirrorRepository:
          HUMMOD_SOURCE_IDENTITY.reproducibilityMirrorRepository,
        reproducibilityMirrorRevision:
          HUMMOD_SOURCE_IDENTITY.reproducibilityMirrorRevision,
        clinicalValidation:false,
        neutralizedDependencies:Object.freeze([
          'LowPressureReceptors',
          'Mechanoreceptors',
          'ExerciseSymps',
          'CushingResponse',
          'Brain-Fuel/Brain-Function',
          'A2Pool/CNSTrophicFactor',
        ]),
        normalizedHumoralBoundaries:Object.freeze({
          alphaPoolEffect:humoralAlphaPoolEffect,
          betaPoolEffect:humoralBetaPoolEffect,
        }),
      }),
    });
  }

  return Object.freeze({
    kind:'hummod-source-aligned-autonomic',
    step,
    snapshot,
  });
}

module.exports={
  HUMMOD_AUTONOMIC_SOURCE_REVISION,
  CURVES,
  SOURCE_CONSTANTS,
  hermite,
  receptorActivity,
  createHumModSourceAlignedAutonomicController,
};
