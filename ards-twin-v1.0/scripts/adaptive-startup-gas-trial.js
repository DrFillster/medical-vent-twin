#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const {Simulation,AdaptiveVolumeController}=require('../src/simulation');
const {PRESETS}=require('../src/presets');
const {createResearchDeliveredGasSession}=require('../src/research_delivered_gas_session');
const out=process.argv[2];if(!out)throw new Error('output JSON path required');
const config=(mode,x={})=>({mode,researchOnly:true,passive:true,fio2:.4,peep:5,rr:15,vt:.45,
 inspiratoryTime:1,calibrationPauseSec:.1,initialPinsp:8,minPinsp:3,maxAirwayPressure:35,
 highPressureAlarm:45,maxPressureStep:3,adaptationGain:.5,volumeToleranceFraction:.02,...x});
const boundaries={systemic:{cardiacOutputMlPerMin:5000,tissueO2UseMlPerMin:250,tissueCo2ProductionMmolPerMin:8.92},
 pulmonary:{deadSpaceBtpsMl:150,membranePermeabilityMlPerMinPerMmHg:1000},
 blood:{sidMolPerL:.04,o2MaxMlPerMl:.2,tempC:37,carboxyPercent:0},environment:{barometricPressureMmHg:760}};
const runs=[];
for(const mode of ['VC_AC_AUTOFLOW','APV_CMV']) {
 const simulation=new Simulation({params:PRESETS.phenotype_baseline(),controller:new AdaptiveVolumeController(config(mode)),
  dt:.002,trackGas:false,initialRecruitmentState:{normal:1,recruitable:0,consolidated:0}});
 const trial=createResearchDeliveredGasSession({simulation,boundaries,researchOnly:true,maxSampleAgeSec:12});
 const startup=[];
 for(let i=0;i<6;i++){trial.warmup(4.1);startup.push(simulation.controller.lastBreath);}
 trial.warmup(24);trial.initializeGas({useHumModSourceInitialState:true});
 const trajectory=[],summary=[];
 for(const [stage,settings] of [['baseline',null],['VT450to600',{vt:.6}],['pressureCap10',{vt:.6,initialPinsp:5,maxAirwayPressure:10}],['recovery',{vt:.45}],['VT450to300',{vt:.3}]]) {
  if(settings)simulation.requestControllerChange(new AdaptiveVolumeController(config(mode,settings)));
  for(let i=0;i<120;i++) {
   const row=trial.runFor(1),g=row.gas.gases.arterial,v=row.adapter.boundary.ventilation;
   trajectory.push({stage,gasTimeSec:row.gas.timeSec,mechanicsTimeSec:row.mechanicsTimeSec,
    targetVtMl:simulation.controller.settings.vt*1000,deliveredVtMl:v.tidalVolumeBtpsMl,
    actualRatePerMin:v.respiratoryRatePerMin,minuteVentilationBtpsMlPerMin:v.tidalVolumeBtpsMl*v.respiratoryRatePerMin,
    pinsp:simulation.controller.pinsp,paco2:g.pco2MmHg,ph:g.pH,pao2:g.po2MmHg,
    pressureLimited:simulation.controller.lastBreath?.targetNotAchievedAtPressureLimit || false});
  }
  summary.push(trajectory[trajectory.length-1]);
 }
 runs.push({mode,startup,summary,trajectory});
}
fs.writeFileSync(out,JSON.stringify({schema:'adaptive-startup-delivered-gas-trial/v1',
 clinicalValidation:false,patientFitted:false,nativeRuntimeModified:false,
 interpretation:'Isolated fixed-metabolism/fixed-perfusion research gas composition. No device-equivalence, patient-ABG or integrated-circulation validation is implied.',
 boundaries,gasInitialState:'HumMod source defaults (not patient baseline ABG)',runs},null,2));
console.log(JSON.stringify(runs.map(r=>({mode:r.mode,startupMl:r.startup.map(b=>b?.deliveredVtL*1000),summary:r.summary})),null,2));
