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
// - LowPressureReceptors source pathway is preserved from average atrial TMP;
// - mechanoreceptor/exercise/Cushing/brain-fuel terms remain neutral for the acute ventilator slice;
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
  lowPressurePressureChangeOnNa:Object.freeze([
    Object.freeze({x:-4,y:0,slope:0}),
    Object.freeze({x:0,y:1,slope:0.3}),
    Object.freeze({x:12,y:4,slope:0}),
  ]),
  sympsCnsLowPressureEffect:Object.freeze([
    Object.freeze({x:0,y:1.1,slope:0}),
    Object.freeze({x:1,y:1,slope:-0.1}),
    Object.freeze({x:4,y:0.9,slope:0}),
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
  baroreflexTauSourceHours:10,
  lowPressureTauSourceDays:30,
  lowPressureInitialAdaptedPressureMmHg:6,
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
  let adaptedLowPressureMmHg=SOURCE_CONSTANTS.lowPressureInitialAdaptedPressureMmHg;
  let last=null;

  function step({
    dtSec,
    carotidPressureMmHg,
    averageAtrialTmpMmHg=SOURCE_CONSTANTS.lowPressureInitialAdaptedPressureMmHg,
    humoralAlphaPoolEffect:stepHumoralAlphaPoolEffect=humoralAlphaPoolEffect,
    humoralBetaPoolEffect:stepHumoralBetaPoolEffect=humoralBetaPoolEffect,
  }={}){
    positive(dtSec,'dtSec');
    finite(carotidPressureMmHg,'carotidPressureMmHg');
    finite(averageAtrialTmpMmHg,'averageAtrialTmpMmHg');
    finite(stepHumoralAlphaPoolEffect,'humoralAlphaPoolEffect');
    finite(stepHumoralBetaPoolEffect,'humoralBetaPoolEffect');

    // HumMod circulation and dynamic equations use a minute-based timebase.
    // Baroreflex.DES: RateConst = 1/(60*Tau), Tau=10 -> 600 min = 10 h.
    const baroreflexTauSec=
      60 * 60 * SOURCE_CONSTANTS.baroreflexTauSourceHours;
    adaptedPressureMmHg +=
      (carotidPressureMmHg-adaptedPressureMmHg)*
      (1-Math.exp(-dtSec/baroreflexTauSec));

    const pressureChangeMmHg=carotidPressureMmHg-adaptedPressureMmHg;
    const baroreflexNa=hermite(CURVES.baroreflexPressureEffect,pressureChangeMmHg);

    // LowPressureReceptors.DES:
    // AvePressure=(RightAtrium.TMP+LeftAtrium.TMP)/2
    // RateConst=1/(1440*Tau), Tau=30 -> 30 days.
    const lowPressureTauSec=
      24 * 60 * 60 * SOURCE_CONSTANTS.lowPressureTauSourceDays;
    adaptedLowPressureMmHg +=
      (averageAtrialTmpMmHg-adaptedLowPressureMmHg)*
      (1-Math.exp(-dtSec/lowPressureTauSec));
    const lowPressureChangeMmHg=
      averageAtrialTmpMmHg-adaptedLowPressureMmHg;
    const lowPressureNa=
      hermite(CURVES.lowPressurePressureChangeOnNa,lowPressureChangeMmHg);

    const sourceBaroEffect=hermite(CURVES.sympsCnsBaroEffect,baroreflexNa);
    const sympsCnsBaroEffect=1+baroSensitivity*(sourceBaroEffect-1);
    const sympsCnsLowPressureEffect=
      hermite(CURVES.sympsCnsLowPressureEffect,lowPressureNa);

    // SympsCNS.ReflexNA = BaroEffect * LowPressureEffect *
    // MechanoEffect * SympsChemo.Effect. In this source snapshot,
    // Mechanoreceptors.FiringRate=0 -> MechanoEffect=1 and
    // SympsChemo.Effect=1, so the retained reflex product is exact here.
    const sympsCnsReflexNa=
      sympsCnsBaroEffect * sympsCnsLowPressureEffect;
    const sympsCnsNa=sympsCnsReflexNa;
    const sympsCnsHz=SOURCE_CONSTANTS.sympsCnsHzScale*sympsCnsNa;

    const gangliaHz=sympsCnsHz;
    const gangliaNa=SOURCE_CONSTANTS.gangliaNaScale*gangliaHz;

    const vagusHz=clamp(hermite(CURVES.vagusHz,sympsCnsHz),0,8);
    const vagusNa=SOURCE_CONSTANTS.vagusNaScale*vagusHz;

    const saBetaActivity=receptorActivity({
      gangliaHz,
      humoralPoolEffect:stepHumoralBetaPoolEffect,
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
      humoralPoolEffect:stepHumoralBetaPoolEffect,
    });

    const venousAlphaActivity=receptorActivity({
      gangliaHz,
      humoralPoolEffect:stepHumoralAlphaPoolEffect,
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
      averageAtrialTmpMmHg,
      adaptedLowPressureMmHg,
      lowPressureChangeMmHg,
      lowPressureNa,
      sympsCnsBaroEffect,
      sympsCnsLowPressureEffect,
      sympsCnsReflexNa,
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
      humoralAlphaPoolEffect:stepHumoralAlphaPoolEffect,
      humoralBetaPoolEffect:stepHumoralBetaPoolEffect,
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
        adaptedLowPressureMmHg,
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
          'Mechanoreceptors',
          'ExerciseSymps',
          'CushingResponse',
          'Brain-Fuel/Brain-Function',
          'A2Pool/CNSTrophicFactor',
        ]),
        defaultHumoralBoundaries:Object.freeze({
          alphaPoolEffect:humoralAlphaPoolEffect,
          betaPoolEffect:humoralBetaPoolEffect,
          note:'step-level dynamic HumMod pool effects may override these defaults',
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
