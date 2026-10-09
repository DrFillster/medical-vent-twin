'use strict';

const REQUIRED_UPSTREAM_INPUTS=Object.freeze({
  avFistula:Object.freeze(['systemicArterialPressureMmHg','systemicVenousPressureMmHg','viscosityConductanceEffect','plasmaVolumeFraction']),
  bone:Object.freeze(['weightInitialOtherMassG','arterialPo2MmHg','pressureGradientMmHg','otherTissueAlphaReceptorActivity','a2PoolLog10Conc','adhPoolLog10Conc','o2NeedMlPerMin','viscosityConductanceEffect','anesthesiaVascularConductance','boneVasculatureEffect','arterialO2ContentMlPerMl','o2MaxMlPerMl','hgbP50','hgbScaleForSat','plasmaVolumeFraction']),
  brain:Object.freeze(['arterialPo2MmHg','arterialPco2MmHg','pressureGradientMmHg','sympatheticState','metabolicState','bloodO2State']),
  fat:Object.freeze(['arterialPo2MmHg','pressureGradientMmHg','alphaReceptorActivity','a2PoolLog10Conc','adhPoolLog10Conc','o2NeedMlPerMin','bloodO2State']),
  kidney:Object.freeze(['pressureGradientMmHg','tgfVascularSignal','kidneyAlphaReceptorActivity','myogenicPressureChangeMmHg','a2PoolLog10Conc','nephronCountFraction','anesthesiaVascularConductance','arcuateStenosis']),
  leftHeart:Object.freeze(['arterialPo2MmHg','pressureGradientMmHg','alphaReceptorActivity','adhPoolLog10Conc','o2NeedMlPerMin','infarctionEffect','vasculatureEffect','bloodO2State']),
  otherTissue:Object.freeze(['arterialPo2MmHg','pressureGradientMmHg','alphaReceptorActivity','a2PoolLog10Conc','adhPoolLog10Conc','o2NeedMlPerMin','bloodO2State']),
  respiratoryMuscle:Object.freeze(['arterialPo2MmHg','pressureGradientMmHg','alphaReceptorActivity','a2PoolLog10Conc','adhPoolLog10Conc','o2NeedMlPerMin','bloodO2State']),
  rightHeart:Object.freeze(['arterialPo2MmHg','pressureGradientMmHg','alphaReceptorActivity','adhPoolLog10Conc','o2NeedMlPerMin','infarctionEffect','vasculatureEffect','bloodO2State']),
  skeletalMuscle:Object.freeze(['arterialPo2MmHg','pressureGradientMmHg','alphaReceptorActivity','a2PoolLog10Conc','adhPoolLog10Conc','o2NeedMlPerMin','musclePumpEffect','metabolicVasodilationEffect','bloodO2State']),
  skin:Object.freeze(['arterialPo2MmHg','pressureGradientMmHg','otherTissueAlphaReceptorActivity','a2PoolLog10Conc','adhPoolLog10Conc','hypothalamusSkinFlowNerveActivity','skinTempC','o2NeedMlPerMin','bloodO2State']),
  giTract:Object.freeze(['arterialPo2MmHg','pressureGradientMmHg','alphaReceptorActivity','a2PoolLog10Conc','adhPoolLog10Conc','o2NeedMlPerMin','bloodO2State']),
  hepaticArtery:Object.freeze(['systemicArterialPressureMmHg','splanchnicVenousPressureMmHg']),
});

function explicitOrganNetworkReadiness(availableInputs={}){
  const missing={};
  for(const [bed,required] of Object.entries(REQUIRED_UPSTREAM_INPUTS)){
    const supplied=availableInputs[bed]||{};
    const absent=required.filter(key=>supplied[key] == null);
    if(absent.length)missing[bed]=Object.freeze(absent);
  }
  const ready=Object.keys(missing).length===0;
  return Object.freeze({
    ready,
    missing:Object.freeze(missing),
    requiredBeds:Object.freeze(Object.keys(REQUIRED_UPSTREAM_INPUTS)),
    rule:'Do not enable explicit-organ-network runtime mode until all upstream HumMod inputs are supplied without inferred placeholders.',
  });
}

module.exports={REQUIRED_UPSTREAM_INPUTS,explicitOrganNetworkReadiness};
