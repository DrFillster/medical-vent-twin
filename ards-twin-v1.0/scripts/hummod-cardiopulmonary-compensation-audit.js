#!/usr/bin/env node
'use strict';

const {
  createHumModCardiopulmonaryCompensationCandidate,
}=require('../src/hummod_cardiopulmonary_compensation_candidate.js');

const DT=0.1;
const ECFV_ML=15000;

// Source-defined pool targets from HumMod GlucosePool/KAPool.
const GLUCOSE_MG_PER_ML=1.10;
const KETOACID_MG_PER_ML=0.005;

// Source-defined initial male plasma fraction from BloodVol.DES:
// InitialPVCrit = 1 - InitialHct-Male = 1 - 0.44.
const PLASMA_VOLUME_FRACTION=0.56;

// Verified HumMod replay coordinates already used by the source-aligned
// brain-flow tests in this repository.
const BASELINE=Object.freeze({
  arterialPo2MmHg:94.009870530838,
  arterialO2ContentMlPerMl:0.196,
  o2MaxMlPerMl:0.200216828201916,
  venousPh:7.37776997729073,
  venousPco2MmHg:44.8382538764693,
  carboxyPercent:0.389637710489589,
  tempC:37,
  cerebralPressureGradientMmHg:89.3625792967117,
  brainPco2MmHg:46.5805596402771,
  brainO2NeedMlPerMin:39.3065407483815,
  carotidPressureMmHg:97,
});

const SEVERE=Object.freeze({
  arterialPo2MmHg:14.066113617021,
  arterialO2ContentMlPerMl:0.0360374485928025,
  o2MaxMlPerMl:0.199888902293675,
  venousPh:7.36136678069273,
  venousPco2MmHg:46.518495684341,
  carboxyPercent:0.390941669136932,
  tempC:37.0281783660784,
  cerebralPressureGradientMmHg:55.4181007568852,
  brainPco2MmHg:51.1215816129238,
  brainO2NeedMlPerMin:39.5553369473497,
  carotidPressureMmHg:60,
});

function runLactateCoordinate(brainLactateMgPerDl){
  const r=createHumModCardiopulmonaryCompensationCandidate({
    dtSec:DT,
    ecfvMl:ECFV_ML,
    initialCarotidPressureMmHg:BASELINE.carotidPressureMmHg,
  });

  const common={
    plasmaVolumeFraction:PLASMA_VOLUME_FRACTION,
    glucoseMgPerMl:GLUCOSE_MG_PER_ML,
    ketoacidMgPerMl:KETOACID_MG_PER_ML,
    brainLactateMgPerDl,
  };

  r.runFor(120,{...BASELINE,...common});
  const baseline=r.snapshot();

  r.runFor(180,{...SEVERE,...common});
  const severe=r.snapshot();

  r.runFor(240,{...BASELINE,...common});
  const recovery=r.snapshot();

  return {
    brainLactateMgPerDl,
    lactateCoordinateBasis:
      'source Brain-Fuel LacFraction curve coordinate only; not asserted as patient baseline',
    baseline:{
      heartRatePerMin:baseline.heartRatePerMin,
      brainTissuePo2MmHg:baseline.brainFlow.po2MmHg,
      brainO2UseMlPerMin:baseline.brainFlow.o2UseMlPerMin,
      brainFuelFractUse:baseline.brainFuel.fuel.fractUse,
      brainFuelFractUseDelay:baseline.brainFuel.fractUseDelay,
      epiPgPerMl:baseline.epiPgPerMl,
      nePgPerMl:baseline.nePgPerMl,
    },
    severe:{
      heartRatePerMin:severe.heartRatePerMin,
      brainTissuePo2MmHg:severe.brainFlow.po2MmHg,
      brainO2UseMlPerMin:severe.brainFlow.o2UseMlPerMin,
      brainFuelFractUse:severe.brainFuel.fuel.fractUse,
      brainFuelFractUseDelay:severe.brainFuel.fractUseDelay,
      epiPgPerMl:severe.epiPgPerMl,
      nePgPerMl:severe.nePgPerMl,
    },
    recovery:{
      heartRatePerMin:recovery.heartRatePerMin,
      brainFuelFractUse:recovery.brainFuel.fuel.fractUse,
      brainFuelFractUseDelay:recovery.brainFuel.fractUseDelay,
      epiPgPerMl:recovery.epiPgPerMl,
      nePgPerMl:recovery.nePgPerMl,
    },
    severeExceeded100:severe.heartRatePerMin>100,
  };
}

const lactateCoordinates=[10,30,60,100].map(runLactateCoordinate);

const out={
  schema:'hummod-cardiopulmonary-compensation-audit/v1',
  authority:'candidate-not-canonical',
  canonicalControlAuthority:false,
  physiologyChanged:false,
  sourceBoundaries:{
    glucoseMgPerMl:GLUCOSE_MG_PER_ML,
    ketoacidMgPerMl:KETOACID_MG_PER_ML,
    plasmaVolumeFraction:PLASMA_VOLUME_FRACTION,
    ecfvMl:ECFV_ML,
  },
  sourceReplay:{
    baseline:BASELINE,
    severe:SEVERE,
  },
  lactateCoordinates,
  summary:{
    anyCoordinateExceeded100:
      lactateCoordinates.some(x=>x.severeExceeded100),
    maximumSevereHeartRatePerMin:
      Math.max(...lactateCoordinates.map(x=>x.severe.heartRatePerMin)),
    minimumSevereBrainFuelFractUseDelay:
      Math.min(...lactateCoordinates.map(x=>x.severe.brainFuelFractUseDelay)),
  },
  interpretation:
    'This is an end-to-end source-family candidate audit. The lactate sweep is sensitivity analysis across source curve coordinates because native Brain-Lactate was not captured in the replay. Do not select a coordinate as clinical truth from this audit.',
};

console.log(JSON.stringify(out,null,2));
