#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const { createHumModArdsGasRuntime }=require('../src/hummod_ards_core_runtime.js');

const targetPath=process.argv[2], outputPath=process.argv[3];
if(!targetPath||!outputPath) throw new Error('usage: node scripts/native-reduced-gas-equation-alignment.js <native-target.json> <output.json>');
const target=JSON.parse(fs.readFileSync(targetPath,'utf8'));
if(target.schema!=='vent-native-reduced-hummod-calibration-target/v1') throw new Error('native calibration target required');
if(!target.nativeReducedState?.available) throw new Error('complete native reduced gas state required');
if(!target.nativeReducedBoundary?.available) throw new Error('complete native reduced boundary required');
const b=target.nativeReducedBoundary.values;
const boundary={
  ventilation:{
    respiratoryRatePerMin:b.respiratoryRatePerMin,
    tidalVolumeBtpsMl:b.tidalVolumeBtpsMl,
    deadSpaceBtpsMl:b.deadSpaceBtpsMl,
    fio2:b.fio2,
  },
  pulmonary:{
    membranePermeabilityMlPerMinPerMmHg:b.membranePermeabilityMlPerMinPerMmHg,
    ventilatedPulmonaryBloodFlowMlPerMin:b.ventilatedPulmonaryBloodFlowMlPerMin,
  },
  circulation:{cardiacOutputMlPerMin:target.endpoints.cardiacOutputLPerMin*1000},
  metabolism:{
    tissueO2UseMlPerMin:b.tissueO2UseMlPerMin,
    tissueCo2ProductionMmolPerMin:b.tissueCo2ProductionMmolPerMin,
  },
  blood:{
    sidMolPerL:b.sidMolPerL,
    o2MaxMlPerMl:b.o2MaxMlPerMl,
    tempC:b.tempC,
    carboxyPercent:b.carboxyPercent,
  },
  environment:{
    barometricPressureMmHg:b.barometricPressureMmHg,
    inspiredCo2Fraction:b.inspiredCo2Fraction,
  },
};
const runtime=createHumModArdsGasRuntime({
  initialState:target.nativeReducedState.initialState,
  boundary,
});
const initial=runtime.snapshot();
let final=initial;
for(let i=0;i<300;i++) final=runtime.step({dtSec:1});
const native=target.endpoints;
const report={
  schema:'vent-native-reduced-gas-equation-alignment/v1',
  targetId:target.targetId,
  durationSec:300,
  boundary,
  initial:{
    pao2MmHg:initial.gases.arterial.po2MmHg,
    paco2MmHg:initial.gases.arterial.pco2MmHg,
    pH:initial.gases.arterial.pH,
  },
  final:{
    pao2MmHg:final.gases.arterial.po2MmHg,
    paco2MmHg:final.gases.arterial.pco2MmHg,
    pH:final.gases.arterial.pH,
  },
  nativeReference:{
    pao2MmHg:native.pao2MmHg,
    paco2MmHg:native.paco2MmHg,
    pH:native.pH,
  },
  residual:{
    pao2MmHg:final.gases.arterial.po2MmHg-native.pao2MmHg,
    paco2MmHg:final.gases.arterial.pco2MmHg-native.paco2MmHg,
    pH:final.gases.arterial.pH-native.pH,
  },
  interpretation:{
    status:'reduced-gas-equation-alignment-only',
    purpose:'isolate reduced gas/acid-base equation drift after native state and source-native boundary matching',
    includesVentMechanics:false,
    includesReducedCirculation:false,
    fullHumModEquivalent:false,
    berlinArdsCalibration:false,
    clinicalValidation:false,
  },
};
fs.writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
