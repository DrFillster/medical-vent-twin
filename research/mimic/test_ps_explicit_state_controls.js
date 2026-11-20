'use strict';
const assert=require('assert');
const {createExplicitPatientStateSession}=require('./explicit_patient_state_adapter');
const {completedBreathReadout}=require('./research_completed_breath_readout');
const base={schema:'research-explicit-patient-state/v1',mechanics:{elasticScale:1,capacityScale:1,resistanceScale:1},recruitment:{normal:1,recruitable:.35,consolidated:0},effort:{profile:'awake_cooperative',drive:1,muscleTransmission:1},ventilation:{mode:'PS',fio2:.4,peep:5,rr:2,pressureSupportCmH2O:10},evidence:{kind:'synthetic',source:'PS engineering fixture, not patient evidence'}};
const results=[];
for(const name of ['baseline','lower_drive','lower_transmission','higher_resistance']){
 const c=JSON.parse(JSON.stringify(base));if(name==='lower_drive')c.effort.drive=.5;if(name==='lower_transmission')c.effort.muscleTransmission=.5;if(name==='higher_resistance')c.mechanics.resistanceScale=10;
 const x=createExplicitPatientStateSession(c);x.session.initialize();let end;
 for(let i=0;i<6;i++){end=x.session.runFor(10);assert(Number.isFinite(end.pulmonary.totalLungVolumeL));}
 const readout=completedBreathReadout(x.session.simulation);assert(readout.inspiredVolumeL>0);
 results.push({name,timeSec:end.timeSec,readout,effectiveDrive:end.patientState.effectiveDriveRelative,effectiveTransmission:end.patientState.effectiveMuscleTransmission,musclePressure:end.patientState.patientMusclePressureCmH2O});
}
assert.strictEqual(results[1].effectiveDrive,.5);assert.strictEqual(results[2].effectiveTransmission,.5);
for(const r of results.slice(1))assert.notStrictEqual(r.readout.inspiredVolumeL,results[0].readout.inspiredVolumeL,'no volume effect '+r.name);
console.log(JSON.stringify({engineeringOnly:true,durationSec:60,clinicalValidation:false,results}));
