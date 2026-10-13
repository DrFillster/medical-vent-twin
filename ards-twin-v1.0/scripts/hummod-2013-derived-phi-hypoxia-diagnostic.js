#!/usr/bin/env node
'use strict';

const {
  initialLeftHeartMass2013,
}=require('../src/hummod_2013_left_heart_mass_provider.js');
const {
  sourceSizingFromReference,
}=require('../src/hummod_2013_left_heart_pump_candidate.js');
const {
  initialLeftHeartComposition2013,
}=require('../src/hummod_2013_left_heart_liquid_volume_provider.js');
const {
  hgbConcentrationFromHematocrit,
}=require('../src/hummod_hgb_concentration_source_aligned.js');
const {
  setupHgbProps,
  po2ToO2Content,
}=require('../src/hummod_hgb_tissue_source_aligned.js');
const {
  createHumMod2013DerivedPhiCompensationDecompensationCandidate,
}=require('../src/hummod_2013_derived_phi_compensation_decompensation_candidate.js');

const DT=0.1;
const HCT=0.44;
const PH=7.44;
const PCO2=40;
const TEMP=37;
const CO=0;

const lv=initialLeftHeartMass2013({
  sex:'male',
  index:1,
  ageYears:30,
  plusMinusPercent:0,
  stochasmPercent:0,
});

const lvComposition=initialLeftHeartComposition2013({
  initialLeftHeartMassG:lv.initialLeftHeartMassG,
});

const pumpSizing=sourceSizingFromReference({
  sourceCardiacOutputMlPerMin:5000,
  leftHeartMassG:lv.initialLeftHeartMassG,
  systemicArteryTotalVolumeMl:1000,
});

const hgb=hgbConcentrationFromHematocrit({
  hematocritFraction:HCT,
  carboxyPercent:CO,
});
const hgbProps=setupHgbProps({
  tempC:TEMP,
  pH:PH,
  pCO2MmHg:PCO2,
  carboxyPercent:CO,
});

function arterialO2Content(po2){
  return po2ToO2Content({
    po2MmHg:po2,
    o2MaxMlPerMl:hgb.o2MaxMlPerMl,
    p50:hgbProps.p50,
    scaleForSat:hgbProps.scaleForSat,
  });
}

const c=createHumMod2013DerivedPhiCompensationDecompensationCandidate({
  ecfvMl:15000,
  sourceSizing:pumpSizing,
  initialLeftHeartMassG:lv.initialLeftHeartMassG,
  initialLeftHeartLiquidVolumeMl:lvComposition.initialLiquidVolumeMl,
  initialArterialPh:PH,
});

function inputs(po2){
  return {
    dtSec:DT,
    arterialPo2MmHg:po2,
    arterialPh:PH,
    arterialPco2MmHg:PCO2,
    arterialO2ContentMlPerMl:arterialO2Content(po2),
    arterialHco3:0.02340,
    bloodSid:0.040,
    bloodTempC:TEMP,
    carboxyPercent:CO,

    meanArterialPressureMmHg:87,
    systemicVenousPressureMmHg:5,
    leftAtrialPressureMmHg:5.5,
    pericardialPressureMmHg:-4,

    myocardialMassG:lv.initialLeftHeartMassG,
    myocardialLiquidVolumeMl:lvComposition.initialLiquidVolumeMl,
    intracellularPotassium:0.140,
    hematocritFraction:HCT,
    adhPoolLog10Conc:Math.log10(2),
    insulinReceptorBoundFractionPercent:8,
    glucosePoolMgPerMl:1.10,
    fattyAcidPoolMgPerMl:0.160,
    lactatePoolMeqPerMl:0.001,
    thyroidPoolTotalT4T3:8,
    coreTempC:37,

    calMultiplier:1,
    anesthesiaVascularConductance:1,
    vasculatureEffect:1,
    infarctionEffect:1,
    contractileProteinFunctionalRatio:1,
    digoxinPoolConcentration:0,
    anesthesiaHeartContractility:1,
    basicContractility:1,
    stiffness:1,
    systolicX:1,
    mitralStenosisEffect:1,
    aorticStenosisEffect:1,
    mitralRegurgitationEffect:1,
    aorticRegurgitationEffect:1,
    respiratoryQuotient:0.8,
  };
}

function endpoint(label){
  const s=c.snapshot();
  return {
    label,
    timeSec:s.timeSec,
    heartRatePerMin:s.heartRatePerMin,
    myocardialIntracellularPh:s.myocardialIntracellularPh,
    myocardialPco2MmHg:s.acidBase?.myocardialPco2MmHg ?? null,
    myocardialLactateMeqPerL:s.acidBase?.myocardialLactateMeqPerL ?? null,
    fuelAdequacy:s.acidBase?.fuelAdequacy ?? null,
    fuelFractUseDelay:s.acidBase?.fuelFractUseDelay ?? null,
    structureEffect:s.leftHeartStructure?.after?.effect ?? null,
    myocardialPo2MmHg:s.coronaryFlow?.po2MmHg ?? null,
    coronaryBloodFlowMlPerMin:s.coronaryFlow?.bloodFlowMlPerMin ?? null,
    myocardialO2NeedMlPerMin:s.metabolism?.o2NeedMlPerMin ?? null,
    myocardialO2UseMlPerMin:s.coronaryFlow?.o2UseMlPerMin ?? null,
    lvContractility:s.leftHeartContractility?.contractility ?? null,
    strokeVolumeMl:s.strokeVolumeMl,
    cardiacOutputMlPerMin:s.cardiacOutputMlPerMin,
    cardiacSympatheticHz:s.autonomic?.sympathetic?.cardiacHz ?? null,
    beta1Effect:s.autonomic?.catecholamines?.beta1Effect ?? null,
  };
}

function run(label,seconds,po2){
  const n=Math.round(seconds/DT);
  let minPhi=Infinity;
  let minFuel=Infinity;
  let minStructure=Infinity;
  let minMyocardialPo2=Infinity;
  let maxHr=-Infinity;
  for(let i=0;i<n;i++){
    const s=c.step(inputs(po2));
    minPhi=Math.min(minPhi,s.myocardialIntracellularPh);
    minFuel=Math.min(minFuel,s.acidBase.fuelFractUseDelay);
    minStructure=Math.min(minStructure,s.leftHeartStructure.after.effect);
    minMyocardialPo2=Math.min(minMyocardialPo2,s.coronaryFlow.po2MmHg);
    maxHr=Math.max(maxHr,s.heartRatePerMin);
  }
  return {
    endpoint:endpoint(label),
    extrema:{
      minimumMyocardialIntracellularPh:minPhi,
      minimumFuelFractUseDelay:minFuel,
      minimumStructureEffect:minStructure,
      minimumMyocardialPo2MmHg:minMyocardialPo2,
      maximumHeartRatePerMin:maxHr,
    },
  };
}

const stages=[
  run('baseline-source-coordinate',600,94),
  run('isolated-severe-hypoxia-source-coordinate',600,30),
  run('recovery',900,94),
];

const baseline=stages[0].endpoint;
const hypoxia=stages[1].endpoint;
const recovery=stages[2].endpoint;

console.log(JSON.stringify({
  schema:'hummod-2013-derived-phi-hypoxia-diagnostic/v1',
  authority:'diagnostic-only',
  canonicalControlAuthority:false,
  physiologyChanged:false,
  mechanismAuditCoordinates:{
    arterialPo2BaselineMmHg:94,
    arterialPo2HypoxiaMmHg:30,
    arterialPh:7.44,
    kCellMolarEquivalent:0.140,
    hematocritFraction:0.44,
    adhTargetConcentration:2,
    adhLog10Conc:Math.log10(2),
    insulinReceptorInitialBoundPercent:8,
    glucosePoolMgPerMl:1.10,
    fattyAcidPoolMgPerMl:0.160,
    lactatePoolMeqPerMl:0.001,
    thyroidPoolTotalT4T3:8,
    arterialHco3:0.02340,
  },
  explicitRegressionBoundaries:{
    systemicVenousPressureMmHg:5,
    bloodSid:0.040,
    pumpSourceCardiacOutputMlPerMin:5000,
    systemicArteryTotalVolumeMl:1000,
    note:
      'All listed values are explicit mechanism-audit coordinates unless separately source-sized above; they are not asserted as a HumMod default patient. Pump sizing remains a synthetic regression geometry.',
  },
  heldSourceNeutralStates:{
    anesthesiaVascularConductance:1,
    vasculatureEffect:1,
    infarctionEffect:1,
    contractileProteinFunctionalRatio:1,
    digoxinPoolConcentration:0,
    anesthesiaHeartContractility:1,
    basicContractility:1,
    stiffness:1,
    systolicX:1,
    valveEffects:1,
  },
  stages,
  changes:{
    hypoxiaMinusBaseline:{
      heartRatePerMin:hypoxia.heartRatePerMin-baseline.heartRatePerMin,
      myocardialIntracellularPh:
        hypoxia.myocardialIntracellularPh-baseline.myocardialIntracellularPh,
      fuelFractUseDelay:
        hypoxia.fuelFractUseDelay-baseline.fuelFractUseDelay,
      structureEffect:
        hypoxia.structureEffect-baseline.structureEffect,
      myocardialPo2MmHg:
        hypoxia.myocardialPo2MmHg-baseline.myocardialPo2MmHg,
      lvContractility:
        hypoxia.lvContractility-baseline.lvContractility,
      strokeVolumeMl:
        hypoxia.strokeVolumeMl-baseline.strokeVolumeMl,
      cardiacOutputMlPerMin:
        hypoxia.cardiacOutputMlPerMin-baseline.cardiacOutputMlPerMin,
    },
    recoveryMinusBaseline:{
      myocardialIntracellularPh:
        recovery.myocardialIntracellularPh-baseline.myocardialIntracellularPh,
      fuelFractUseDelay:
        recovery.fuelFractUseDelay-baseline.fuelFractUseDelay,
      structureEffect:
        recovery.structureEffect-baseline.structureEffect,
    },
  },
  interpretation:
    'Diagnostic only. No assertion is made that isolated hypoxia must lower myocardial pHi or depress output. The purpose is to observe what the source-generation-consistent 2013 chain actually does before defining a macro acceptance criterion.',
},null,2));
