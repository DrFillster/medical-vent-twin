'use strict';
const assert=require('assert');
const {optionsFor,createExplicitPatientStateSession}=require('./explicit_patient_state_adapter');
const c={schema:'research-explicit-patient-state/v1',mechanics:{elasticScale:1,capacityScale:1,resistanceScale:1},recruitment:{normal:1,recruitable:.35,consolidated:0},effort:{profile:'awake_cooperative',drive:1,muscleTransmission:1},ventilation:{mode:'PC_AC',fio2:.4,peep:5,rr:15,pinspCmH2O:15,inspiratoryTimeSec:1},evidence:{kind:'synthetic',source:'engineering fixture, no clinical disease assertion'}};
const original=JSON.stringify(c),results=[];
for(const [name,changes] of [['baseline',{}],['higher_resistance',{resistanceScale:10}],['higher_elastic_scale',{elasticScale:2}],['lower_capacity',{capacityScale:.5}],['lower_drive',{}],['lower_transmission',{}],['different_recruitment',{}],['explicit_kinetics',{}]]){
 const v=JSON.parse(original);Object.assign(v.mechanics,changes);
 if(name==='lower_drive')v.effort.drive=.5;
 if(name==='lower_transmission')v.effort.muscleTransmission=.5;
 if(name==='different_recruitment')v.recruitment.recruitable=.8;
 if(name==='explicit_kinetics')v.recruitmentKinetics={P_open:22,P_close:12,k_open:.02,k_close:.05};
 const x=createExplicitPatientStateSession(v);const init=x.session.initialize(),end=x.session.runFor(4);
 assert(end.timeSec>init.timeSec);assert(Number.isFinite(end.pulmonary.totalLungVolumeL));assert.strictEqual(end.coupling.patientMechanicsOverrideApplied,true);
 assert.strictEqual(x.provenance.referenceTemplateIsPatientDiagnosis,false);
 assert.strictEqual(end.patientState.effectiveDriveRelative,v.effort.drive);
 assert.strictEqual(end.patientState.effectiveMuscleTransmission,v.effort.muscleTransmission);
 if(v.recruitmentKinetics)assert.strictEqual(x.session.simulation.params.compartments[1].P_open,22);
 results.push({name,timeSec:end.timeSec,totalLungVolumeL:end.pulmonary.totalLungVolumeL,overrideApplied:end.coupling.patientMechanicsOverrideApplied});
}
assert.strictEqual(JSON.stringify(c),original);
for(const mutate of [x=>delete x.mechanics.capacityScale,x=>x.evidence.source='',x=>x.recruitment.normal=.5,x=>x.effort.drive=NaN]){const v=JSON.parse(original);mutate(v);assert.throws(()=>optionsFor(v));}
console.log(JSON.stringify({engineeringOnly:true,patientDataRead:false,configurations:results,negativeContractTests:4,productionEdited:false}));
