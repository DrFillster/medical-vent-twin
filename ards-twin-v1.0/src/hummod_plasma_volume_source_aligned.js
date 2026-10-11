'use strict';

// Source-aligned HumMod plasma-volume primitive.
// Source: Structure/BloodVolume/PlasmaVol.DES
// pinned to riliescu/hummod-standalone@8dab57e05631f779bf5020fe0dd51874d8ae98c1
//
// All water gains/losses remain explicit upstream inputs.

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

function initialPlasmaVolumeMl({
  initialPvCrit,
  initialBloodVolumeMl,
}={}){
  finite(initialPvCrit,'initialPvCrit');
  if(initialPvCrit<0||initialPvCrit>1){
    throw new Error('initialPvCrit must be between 0 and 1');
  }
  positive(initialBloodVolumeMl,'initialBloodVolumeMl');
  return initialPvCrit*initialBloodVolumeMl;
}

function plasmaVolumeLiters({volumeMl}={}){
  nonNegative(volumeMl,'volumeMl');
  return volumeMl/1000;
}

function plasmaVolumeMassDerivative({
  giLumenAbsorptionMlPerMin,
  lymphWaterRateMlPerMin,
  ivDripWaterRateMlPerMin,
  excessLungWaterFluxMlPerMin,
  peritoneumLossMlPerMin,
  transfusionPlasmaRateMlPerMin,
  collectingDuctWaterOutflowMlPerMin,
  capillaryWaterRateMlPerMin,
  peritoneumGainMlPerMin,
  hemorrhagePlasmaRateMlPerMin,
  pericardiumHemorrhagePlasmaFlowMlPerMin,
}={}){
  const fields={
    giLumenAbsorptionMlPerMin,
    lymphWaterRateMlPerMin,
    ivDripWaterRateMlPerMin,
    excessLungWaterFluxMlPerMin,
    peritoneumLossMlPerMin,
    transfusionPlasmaRateMlPerMin,
    collectingDuctWaterOutflowMlPerMin,
    capillaryWaterRateMlPerMin,
    peritoneumGainMlPerMin,
    hemorrhagePlasmaRateMlPerMin,
    pericardiumHemorrhagePlasmaFlowMlPerMin,
  };
  for(const [k,v] of Object.entries(fields)) finite(v,k);

  const gain=
    giLumenAbsorptionMlPerMin+
    lymphWaterRateMlPerMin+
    ivDripWaterRateMlPerMin+
    excessLungWaterFluxMlPerMin+
    peritoneumLossMlPerMin+
    transfusionPlasmaRateMlPerMin;

  const loss=
    collectingDuctWaterOutflowMlPerMin+
    capillaryWaterRateMlPerMin+
    excessLungWaterFluxMlPerMin+
    peritoneumGainMlPerMin+
    hemorrhagePlasmaRateMlPerMin+
    pericardiumHemorrhagePlasmaFlowMlPerMin;

  return Object.freeze({
    gainMlPerMin:gain,
    lossMlPerMin:loss,
    changeMlPerMin:gain-loss,
    controlAuthority:false,
  });
}

module.exports=Object.freeze({
  initialPlasmaVolumeMl,
  plasmaVolumeLiters,
  plasmaVolumeMassDerivative,
});
