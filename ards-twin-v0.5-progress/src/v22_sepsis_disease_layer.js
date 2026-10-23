'use strict';

/**
 * v2.2 Yamanaka sepsis disease layer.
 *
 * This layer computes only source-supported inflammation effects. It does not
 * invent a vasodilation-to-SVR gain or a capillary-leak-to-volume-loss gain.
 *
 * Live-safe output currently available:
 * - fractional left-myocardial performance projection, obtained by preserving
 *   the source Eq. 31 stroke-volume fraction as a dimensionless multiplier.
 *
 * Diagnostic/source outputs awaiting a separately justified bridge:
 * - Eq. 29 capillary permeability
 * - Eq. 30 vasodilation decrement
 *
 * That boundary is deliberate. v2.2 must not regain the v1.x pattern of
 * turning disease labels into unsourced multipliers.
 */

const {
  capillaryPermeabilityFromInflammation,
  vasodilationDecrementFromInflammation,
  strokeVolumeFromInflammation,
  arterialCapillaryFiltration,
  venousCapillaryReabsorption,
  bloodVolumeRateFromCapillaryExchange,
  systemicResistanceRatioFromYamanakaVasodilation,
}=require('./v22_yamanaka_sepsis_equations.js');
const {
  SOURCE:PARAMETER_SOURCE,
  PARAMS,
}=require('./v22_yamanaka_sepsis_parameters.js');

const SOURCE=Object.freeze({
  citation:'Yamanaka Y et al. Theor Biol Med Model. 2019;16:5.',
  doi:'10.1186/s12976-019-0101-9',
  equations:Object.freeze([29,30,31]),
  parameters:PARAMETER_SOURCE,
  myocardialProjection:
    'source Eq.31 stroke-volume fraction projected as dimensionless LV performance multiplier',
  vasodilationBridge:'not-authorized-pending-radius/resistance mapping',
  capillaryLeakBridge:'not-authorized-pending-vascular/interstitial volume mapping',
  clinicalValidation:false,
  authority:'v2.2-source-backed-sepsis-disease-layer',
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

function evaluateV22SepsisDiseaseLayer({
  inflammationNStar,
  antiInflammatoryMediatorCA=0,
  sourceAr=null,
  capillaryExchange=null,
}={}){
  nonNegative(inflammationNStar,'inflammationNStar');
  nonNegative(antiInflammatoryMediatorCA,'antiInflammatoryMediatorCA');

  const capillaryPermeabilityMlPerMmHgSec=
    capillaryPermeabilityFromInflammation(
      inflammationNStar,
      PARAMS.permeability
    );

  const vasodilationDecrement=
    vasodilationDecrementFromInflammation(
      inflammationNStar,
      PARAMS.vasodilation
    );

  const sourceStrokeVolumeMl=strokeVolumeFromInflammation(
    inflammationNStar,
    {
      normalStrokeVolumeMl:PARAMS.myocardial.normalStrokeVolumeMl,
      kS:PARAMS.myocardial.kS,
      antiInflammatoryMediator:antiInflammatoryMediatorCA,
      cInfinity:PARAMS.myocardial.cInfinity,
    }
  );

  const leftMyocardialPerformanceMultiplier=
    sourceStrokeVolumeMl/PARAMS.myocardial.normalStrokeVolumeMl;

  let systemicResistanceRatio=null;
  if(sourceAr!=null){
    systemicResistanceRatio=systemicResistanceRatioFromYamanakaVasodilation({
      sourceAr,
      vasodilationDecrement,
    });
  }

  let capillaryExchangeState=null;
  if(capillaryExchange!=null){
    if(!capillaryExchange||typeof capillaryExchange!=='object'||
       Array.isArray(capillaryExchange)){
      throw new Error('capillaryExchange must be an object or null');
    }
    const filtrationMlPerSec=arterialCapillaryFiltration({
      permeabilityLa:capillaryPermeabilityMlPerMmHgSec,
      arterialCapillaryPressureMmHg:
        capillaryExchange.arterialCapillaryPressureMmHg,
      interstitialPressureMmHg:
        capillaryExchange.interstitialPressureMmHg,
      plasmaOncoticPressureMmHg:
        capillaryExchange.plasmaOncoticPressureMmHg,
      interstitialOncoticPressureMmHg:
        capillaryExchange.interstitialOncoticPressureMmHg,
    });
    const reabsorptionMlPerSec=venousCapillaryReabsorption({
      permeabilityLv:PARAMS.permeability.lv,
      venousCapillaryPressureMmHg:
        capillaryExchange.venousCapillaryPressureMmHg,
      interstitialPressureMmHg:
        capillaryExchange.interstitialPressureMmHg,
      plasmaOncoticPressureMmHg:
        capillaryExchange.plasmaOncoticPressureMmHg,
      interstitialOncoticPressureMmHg:
        capillaryExchange.interstitialOncoticPressureMmHg,
    });
    const bloodVolumeRateMlPerSec=bloodVolumeRateFromCapillaryExchange({
      arterialFiltrationMlPerSec:filtrationMlPerSec,
      venousReabsorptionMlPerSec:reabsorptionMlPerSec,
      infusionMlPerSec:
        capillaryExchange.infusionMlPerSec==null
          ?0
          :capillaryExchange.infusionMlPerSec,
    });
    capillaryExchangeState=Object.freeze({
      filtrationMlPerSec,
      reabsorptionMlPerSec,
      bloodVolumeRateMlPerSec,
      sourceInputs:Object.freeze({...capillaryExchange}),
    });
  }

  return Object.freeze({
    inflammationNStar,
    antiInflammatoryMediatorCA,
    capillaryPermeabilityMlPerMmHgSec,
    capillaryPermeabilityRatio:
      capillaryPermeabilityMlPerMmHgSec/PARAMS.permeability.laMin,
    vasodilationDecrement,
    sourceStrokeVolumeMl,
    leftMyocardialPerformanceMultiplier,
    systemicResistanceRatio,
    capillaryExchange:capillaryExchangeState,
    liveAuthority:Object.freeze({
      leftMyocardialPerformanceMultiplier:true,
      systemicVasodilation:systemicResistanceRatio!=null,
      capillaryLeakVolume:capillaryExchangeState!=null,
    }),
    unresolved:Object.freeze({
      systemicVasodilation:systemicResistanceRatio==null
        ?'Eq.30 remains inactive unless the caller supplies the Yamanaka source-family A_r state. No Ursino-firing to Yamanaka-A_r mapping is invented.'
        :null,
      capillaryLeak:capillaryExchangeState==null
        ?'Eq.29 remains inactive unless source capillary/interstitial/oncotic pressures are explicitly supplied. No pressure or oncotic proxy is invented.'
        :null,
    }),
    provenance:SOURCE,
  });
}

module.exports=Object.freeze({
  SOURCE,
  evaluateV22SepsisDiseaseLayer,
});
