'use strict';
const assert=require('node:assert/strict');
const {Simulation}=require('../src/simulation.js');
const {PRESETS}=require('../src/presets.js');
const {PROFILE}=require('../src/hennigs_supported_spontaneous_profile.js');
const {createHennigsNeuralOscillatorRuntime}=require('../src/hennigs_neural_oscillator_runtime.js');
const {createHennigsPatientEffortCandidate}=require('../src/hennigs_patient_effort_candidate.js');
const {createHennigsMechanicalClosedEffortCandidate}=require('../src/hennigs_mechanical_closed_effort_candidate.js');
const {PressureSupportCandidateController}=require('../src/ventilator/pressure_support_candidate.js');

function estimateRawPeriodSec(dRel){
  const dtSec=.002,r=createHennigsNeuralOscillatorRuntime({dtSec,dRel});
  let prev=r.snapshot().state.I; const x=[];
  for(let i=0;i<300000&&x.length<8;i++){const s=r.step();if(s.timeSec>120&&prev<=0&&s.state.I>0)x.push(s.timeSec);prev=s.state.I;}
  const p=x.slice(1).map((t,i)=>t-x[i]); return p.reduce((a,b)=>a+b,0)/p.length;
}
const effort=createHennigsPatientEffortCandidate({
  dtSec:.001,dRel:PROFILE.minimumRelativeDrive,
  gainProfile:'hennigs-2026-validation-reference',
  respiratoryFailureFraction:.75,
  physicalClock:{profile:'hennigs-eq9',estimateRawPeriodSec},
});
const closed=createHennigsMechanicalClosedEffortCandidate({
  effort,initialEndExpiratoryVolumeL:.5416124745859138,
  functionalResidualCapacityL:2.5,heringBreuerThresholdL:1.0,
});
const controller=new PressureSupportCandidateController({
  fio2:.4,peep:5,pressureSupport:8,flowTriggerLMin:1.5,cycleOffFraction:.25,
  minExpiratoryTimeSec:.15,maxInspiratoryTimeSec:1.5,riseTimeSec:.1,backupRatePerMin:2,
});
const sim=new Simulation({params:PRESETS.phenotype_baseline(),controller,dt:.001,
  initialRecruitmentState:{normal:1,recruitable:0,consolidated:0},patientEffortProvider:closed.provider});
sim.runFor(30);
const completed=sim.metrics().filter(b=>b.VtInspired>.02);
const meanVt=completed.reduce((s,b)=>s+b.VtInspired,0)/completed.length;
assert(completed.length>=5);
assert.equal(controller.snapshot().lastTrigger,'FLOW');
assert(Number.isFinite(meanVt)&&meanVt>.1&&meanVt<1.5);
assert(Math.abs(effort.snapshot().prescribedRespiratoryRatePerMin-12.5)<1e-6);
assert(Math.max(...sim.trace.map(r=>r.patientMusclePressureCmH2O))>0);
console.log('ok - Hennigs-supported resting drive triggers bounded pressure support');
console.log(JSON.stringify({breaths:completed.length,meanVt,rr:effort.snapshot().prescribedRespiratoryRatePerMin,lastTrigger:controller.snapshot().lastTrigger},null,2));
