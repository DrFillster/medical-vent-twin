#!/usr/bin/env node
'use strict';

const {PRESETS}=require('../src/presets.js');
const {
  createV16PhysicianArdsCandidate,
}=require('../src/v16_physician_ards_candidate.js');

function createCandidate(){
  return createV16PhysicianArdsCandidate({
    patientParams:PRESETS.phenotype_moderate_recruitability(),
    initialRecruitmentState:{normal:1,recruitable:0.5,consolidated:0},
    ventilatorSettings:{
      fio2:0.6,peep:10,rr:20,vt:0.42,
      inspiratoryFlow:0.5,inspiratoryPause:0,
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
      sidMolPerL:0.040,o2MaxMlPerMl:0.201,tempC:37,carboxyPercent:0,
    },
    metabolism:{
      tissueO2UseMlPerMin:250,tissueCo2ProductionMmolPerMin:9,
    },
    environment:{barometricPressureMmHg:760,inspiredCo2Fraction:0},
    deadSpaceBtpsMlProvider:()=>150,
    dtSec:0.002,
    averagingWindowSec:1,
  });
}

function view(label,candidate){
  const bedside=candidate.snapshot();
  const integrated=candidate.integrated.snapshot();
  const gas=integrated.pulmonaryGas?.gas;
  const exchange=gas?.exchange;
  const cv=integrated.cardiovascular?.cardiovascular;
  const ctl=cv?.controller;

  return {
    label,
    timeSec:bedside.timeSec,
    ventilator:{
      peepCmH2O:bedside.ventilator.settings.peep,
      vtL:bedside.ventilator.settings.vt,
      rrPerMin:bedside.ventilator.settings.rr,
      fio2:bedside.ventilator.settings.fio2,
    },
    oxygen:{
      arterialPo2MmHg:bedside.gas.pao2MmHg,
      regionalArterialPo2TargetMmHg:
        integrated.physicianState?.regionalArterialPo2TargetMmHg ?? null,
      arterialO2ContentMlPerMl:
        gas?.gases?.arterial?.o2ContentMlPerMl ?? null,
      venousPo2MmHg:gas?.gases?.venous?.po2MmHg ?? null,
      venousO2ContentMlPerMl:
        gas?.gases?.venous?.o2ContentMlPerMl ?? null,
      appliedArterialO2TargetMlPerMl:
        exchange?.massBalance?.appliedArterialO2TargetMlPerMl ?? null,
      globalLungArterialO2TargetMlPerMl:
        exchange?.massBalance?.globalLungArterialO2TargetMlPerMl ?? null,
      arterialO2TargetAuthority:
        exchange?.massBalance?.arterialO2TargetAuthority ?? null,
      oxygenDeliveryMlPerMin:
        exchange?.massBalance?.oxygenDeliveryMlPerMin ?? null,
      actualTissueO2UseMlPerMin:
        exchange?.massBalance?.actualTissueO2UseMlPerMin ?? null,
      oxygenSupplyDeficitMlPerMin:
        exchange?.massBalance?.oxygenSupplyDeficitMlPerMin ?? null,
    },
    autonomic:{
      baroreceptorSpikesPerSec:
        ctl?.afferents?.fAbSpikesPerSec ?? null,
      chemoreceptorSpikesPerSec:
        ctl?.afferents?.fAcSpikesPerSec ?? null,
      pulmonaryStretchSpikesPerSec:
        ctl?.afferents?.fApSpikesPerSec ?? null,
      vascularSympatheticSpikesPerSec:
        ctl?.autonomic?.fSpSpikesPerSec ?? null,
      cardiacSympatheticSpikesPerSec:
        ctl?.autonomic?.fShSpikesPerSec ?? null,
      cardiacVagalSpikesPerSec:
        ctl?.autonomic?.fVSpikesPerSec ?? null,
    },
    hemodynamics:bedside.hemodynamics,
    regions:bedside.gas.regions,
  };
}

const c=createCandidate();
const stages=[];

c.runFor(12);
stages.push(view('baseline-12s',c));

c.setPEEP(14);
c.runFor(12);
stages.push(view('peep14-plus-12s',c));

c.requestVentilatorSettings({vt:0.36,rr:24,fio2:0.8});
c.runFor(12);
stages.push(view('fio2-0.80-plus-12s',c));

c.runFor(24);
stages.push(view('fio2-0.80-plus-36s-total',c));

console.log(JSON.stringify({
  schema:'v16-physician-ards-oxygen-autonomic-trace/v1',
  authority:'candidate-not-canonical',
  physiologyChanged:false,
  purpose:
    'Separate regional arterial O2 target from delayed arterial state and expose the active autonomic inputs/effectors. No expected target or fitted physiology is embedded.',
  stages,
},null,2));
