#!/usr/bin/env node
'use strict';

const {PRESETS}=require('../src/presets.js');
const {
  createV16PhysicianArdsCandidate,
}=require('../src/v16_physician_ards_candidate.js');

function createCandidate(){
  return createV16PhysicianArdsCandidate({
    patientParams:PRESETS.phenotype_moderate_recruitability(),
    initialRecruitmentState:{
      normal:1,
      recruitable:0.5,
      consolidated:0,
    },
    ventilatorSettings:{
      fio2:0.6,
      peep:10,
      rr:20,
      vt:0.42,
      inspiratoryFlow:0.5,
      inspiratoryPause:0,
    },
    anatomicalShuntFraction:0.05,
    anatomicalShuntProvenance:{
      sourceQualified:true,
      fixture:'focused physician shunt case state only',
      canonical:false,
    },
    referenceAbsoluteAlveolarVolumeL:2.25,
    referenceAbsoluteAlveolarVolumeProvenance:{
      sourceQualified:true,
      fixture:'focused synchronized absolute-volume reference only',
      canonical:false,
    },
    referencePleuralPressureCmH2O:-5,
    referencePleuralPressureProvenance:{
      sourceQualified:true,
      fixture:'focused passive pleural-pressure reference only',
      canonical:false,
    },
    excessLungWaterMl:0,
    blood:{
      sidMolPerL:0.040,
      o2MaxMlPerMl:0.201,
      tempC:37,
      carboxyPercent:0,
    },
    metabolism:{
      tissueO2UseMlPerMin:250,
      tissueCo2ProductionMmolPerMin:9,
    },
    environment:{
      barometricPressureMmHg:760,
      inspiredCo2Fraction:0,
    },
    deadSpaceBtpsMlProvider:()=>150,
    dtSec:0.002,
    averagingWindowSec:1,
  });
}

function physicianView(label,s){
  return {
    label,
    timeSec:s.timeSec,
    ventilator:{
      peepCmH2O:s.ventilator.settings.peep,
      vtL:s.ventilator.settings.vt,
      rrPerMin:s.ventilator.settings.rr,
      fio2:s.ventilator.settings.fio2,
      airwayPressureCmH2O:s.ventilator.airwayPressureCmH2O,
      totalLungElasticVolumeL:s.ventilator.totalLungElasticVolumeL,
    },
    gas:{
      pao2MmHg:s.gas.pao2MmHg,
      paco2MmHg:s.gas.paco2MmHg,
      arterialPh:s.gas.arterialPh,
      anatomicalShuntFraction:s.gas.anatomicalShuntFraction,
      regions:s.gas.regions,
    },
    hemodynamics:s.hemodynamics,
    recruitment:s.recruitment,
    latestMeasurement:s.measurements.length
      ?s.measurements[s.measurements.length-1]
      :null,
  };
}

const candidate=createCandidate();
const stages=[];

stages.push(physicianView(
  'baseline',
  candidate.runFor(12)
));

candidate.setPEEP(14);
stages.push(physicianView(
  'after-peep-14',
  candidate.runFor(12)
));

candidate.requestVentilatorSettings({
  vt:0.36,
  rr:24,
  fio2:0.8,
});
stages.push(physicianView(
  'after-vt-rr-fio2-change',
  candidate.runFor(12)
));

stages.push(physicianView(
  'after-passive-mechanics-measurement',
  candidate.performPassiveMechanicsMeasurement({
    holdDurationSec:0.5,
  })
));

console.log(JSON.stringify({
  schema:'v16-physician-ards-perturbation-audit/v1',
  authority:'candidate-not-canonical',
  canonicalControlAuthority:false,
  physiologyChanged:false,
  fixturePurpose:
    'Focused persistent-patient perturbation audit using the same explicit source-qualified fixture boundaries as the v1.6 physician candidate regression test.',
  stages,
  interpretation:
    'Report-only physician review artifact. No expected bedside target, fitted gain, pass band, or equation tuning is embedded in this audit.',
},null,2));
