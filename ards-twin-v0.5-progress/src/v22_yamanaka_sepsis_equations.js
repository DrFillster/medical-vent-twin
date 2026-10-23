'use strict';

/**
 * Yamanaka et al. 2019 septic-shock disease-layer shadow functions.
 *
 * Primary source:
 * Yamanaka Y et al. Theor Biol Med Model. 2019;16:5.
 * doi:10.1186/s12976-019-0101-9
 *
 * No physiologic parameter defaults are supplied here. Callers must provide
 * source-transcribed or explicitly documented calibrated parameters.
 */

const SOURCE=Object.freeze({
  citation:'Yamanaka Y et al. Theor Biol Med Model. 2019;16:5.',
  doi:'10.1186/s12976-019-0101-9',
  pmid:'30841902',
  status:'published-equations-v2.2-disease-layer',
});

function finite(v,label){
  if(typeof v!=='number'||!Number.isFinite(v)) throw new Error(label+' must be finite');
  return v;
}
function positive(v,label){ finite(v,label); if(!(v>0)) throw new Error(label+' must be > 0'); return v; }
function nonNegative(v,label){ finite(v,label); if(v<0) throw new Error(label+' must be >= 0'); return v; }

function hillActivation(input,{max,min=0,ec50,slope}={}){
  nonNegative(input,'input');
  finite(max,'max');
  finite(min,'min');
  positive(ec50,'ec50');
  positive(slope,'slope');
  if(input===0) return min;
  return (max-min)/(1+Math.pow(ec50/input,slope))+min;
}

// Yamanaka Eq. 29.
function capillaryPermeabilityFromInflammation(
  inflammation,
  {laMax,laMin,ec50La,slopeLa}={}
){
  return hillActivation(inflammation,{
    max:finite(laMax,'laMax'),
    min:finite(laMin,'laMin'),
    ec50:ec50La,
    slope:slopeLa,
  });
}

// Yamanaka Eq. 30.
function vasodilationDecrementFromInflammation(
  inflammation,
  {kEx,ec50Ex,slopeEx}={}
){
  nonNegative(inflammation,'inflammation');
  finite(kEx,'kEx');
  positive(ec50Ex,'ec50Ex');
  positive(slopeEx,'slopeEx');
  if(inflammation===0) return 0;
  return kEx/(1+Math.pow(ec50Ex/inflammation,slopeEx));
}

// Yamanaka Eq. 20 helper used by Eq. 31.
function antiInflammatoryLimitedSignal(
  input,
  {antiInflammatoryMediator,cInfinity}={}
){
  nonNegative(input,'input');
  nonNegative(antiInflammatoryMediator,'antiInflammatoryMediator');
  positive(cInfinity,'cInfinity');
  return input/(1+Math.pow(antiInflammatoryMediator/cInfinity,2));
}

// Yamanaka Eq. 31.
function strokeVolumeFromInflammation(
  inflammation,
  {
    normalStrokeVolumeMl,
    kS,
    antiInflammatoryMediator,
    cInfinity,
  }={}
){
  nonNegative(inflammation,'inflammation');
  positive(normalStrokeVolumeMl,'normalStrokeVolumeMl');
  nonNegative(kS,'kS');
  const g=antiInflammatoryLimitedSignal(inflammation,{
    antiInflammatoryMediator,
    cInfinity,
  });
  return normalStrokeVolumeMl/(1+kS*g);
}

// Yamanaka Eq. 17.
function sympatheticFatigueDerivative(
  sympatheticActivity,
  {normalActivity,tauGamma}={}
){
  finite(sympatheticActivity,'sympatheticActivity');
  finite(normalActivity,'normalActivity');
  positive(tauGamma,'tauGamma');
  return (sympatheticActivity-normalActivity)/tauGamma;
}

// Yamanaka Eq. 18.
function fatiguedSympatheticActivity(
  pressureSignalDeficit,
  {
    normalPressureSignal,
    gamma,
    activityMin,
    activityMax,
  }={}
){
  finite(pressureSignalDeficit,'pressureSignalDeficit');
  positive(normalPressureSignal,'normalPressureSignal');
  finite(gamma,'gamma');
  finite(activityMin,'activityMin');
  finite(activityMax,'activityMax');
  if(activityMax<activityMin) throw new Error('activityMax must be >= activityMin');
  return (activityMax-activityMin)/
    (1+Math.exp(-pressureSignalDeficit/normalPressureSignal+gamma))+
    activityMin;
}



/**
 * Yamanaka Eqs. 4-6 reduced fluid-exchange relations.
 * Units follow the source:
 * - permeability mL/mmHg/s
 * - pressures mmHg
 * - result mL/s
 */
function arterialCapillaryFiltration({
  permeabilityLa,
  arterialCapillaryPressureMmHg,
  interstitialPressureMmHg,
  plasmaOncoticPressureMmHg,
  interstitialOncoticPressureMmHg,
}={}){
  nonNegative(permeabilityLa,'permeabilityLa');
  for(const [k,v] of Object.entries({
    arterialCapillaryPressureMmHg,
    interstitialPressureMmHg,
    plasmaOncoticPressureMmHg,
    interstitialOncoticPressureMmHg,
  })) finite(v,k);
  return permeabilityLa*(
    (arterialCapillaryPressureMmHg-interstitialPressureMmHg)-
    (plasmaOncoticPressureMmHg-interstitialOncoticPressureMmHg)
  );
}

function venousCapillaryReabsorption({
  permeabilityLv,
  venousCapillaryPressureMmHg,
  interstitialPressureMmHg,
  plasmaOncoticPressureMmHg,
  interstitialOncoticPressureMmHg,
}={}){
  nonNegative(permeabilityLv,'permeabilityLv');
  for(const [k,v] of Object.entries({
    venousCapillaryPressureMmHg,
    interstitialPressureMmHg,
    plasmaOncoticPressureMmHg,
    interstitialOncoticPressureMmHg,
  })) finite(v,k);
  return permeabilityLv*(
    (interstitialPressureMmHg-venousCapillaryPressureMmHg)-
    (interstitialOncoticPressureMmHg-plasmaOncoticPressureMmHg)
  );
}

function bloodVolumeRateFromCapillaryExchange({
  arterialFiltrationMlPerSec,
  venousReabsorptionMlPerSec,
  infusionMlPerSec=0,
}={}){
  finite(arterialFiltrationMlPerSec,'arterialFiltrationMlPerSec');
  finite(venousReabsorptionMlPerSec,'venousReabsorptionMlPerSec');
  finite(infusionMlPerSec,'infusionMlPerSec');
  return -arterialFiltrationMlPerSec+
    venousReabsorptionMlPerSec+
    infusionMlPerSec;
}

/**
 * Yamanaka Eqs. 9-10 and 30 disease-only resistance ratio.
 *
 * Source states R is inversely proportional to r^4, with
 * K_r,cr = 1/A_r and r proportional to K_r,cr. Eq.30 applies
 * A_r -> A_r - EX. Therefore, at the same underlying sympathetic
 * state, the disease-only resistance ratio is:
 *   R_sepsis/R_control = ((A_r - EX)/A_r)^4
 *
 * Caller must supply the source-family A_r state. This function refuses to
 * invent an Ursino/Magosso-firing -> Yamanaka-A_r mapping.
 */
function systemicResistanceRatioFromYamanakaVasodilation({
  sourceAr,
  vasodilationDecrement,
}={}){
  positive(sourceAr,'sourceAr');
  nonNegative(vasodilationDecrement,'vasodilationDecrement');
  const septicAr=sourceAr-vasodilationDecrement;
  if(!(septicAr>0)){
    throw new Error(
      'Yamanaka Eq.30 produced non-positive A_r; source-state mapping is outside the valid domain'
    );
  }
  return Math.pow(septicAr/sourceAr,4);
}

module.exports=Object.freeze({
  SOURCE,
  hillActivation,
  capillaryPermeabilityFromInflammation,
  vasodilationDecrementFromInflammation,
  antiInflammatoryLimitedSignal,
  strokeVolumeFromInflammation,
  sympatheticFatigueDerivative,
  fatiguedSympatheticActivity,
  arterialCapillaryFiltration,
  venousCapillaryReabsorption,
  bloodVolumeRateFromCapillaryExchange,
  systemicResistanceRatioFromYamanakaVasodilation,
});
