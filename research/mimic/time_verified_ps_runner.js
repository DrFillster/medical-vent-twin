'use strict';
const assert=require('assert');
const {createExplicitPatientStateSession}=require('./explicit_patient_state_adapter');
function config(p,c){return {schema:'research-explicit-patient-state/v1',mechanics:{elasticScale:c.elastic,capacityScale:c.capacity,resistanceScale:c.resistance},recruitment:{normal:1,recruitable:.35,consolidated:0},effort:{profile:'awake_cooperative',drive:c.drive,muscleTransmission:c.transmission},ventilation:{mode:'PS',fio2:p.vent.fio2_percent/100,peep:p.vent.peep,rr:2,pressureSupportCmH2O:p.vent.psv},evidence:{kind:'development',source:'strict pre-cutoff packet; fitted engineering controls, not diagnosed disease'}};}
function run(p,c,duration){const {session:s}=createExplicitPatientStateSession(config(p,c));s.initialize();for(let t=0;t<duration;t+=10){s.runFor(Math.min(10,duration-t));s.compactTraceHistory(60);}const snap=s.snapshot(),z=snap.pulmonary.measurements.lastCompletedBreath,i=snap.patientVentilatorInteraction;assert(z);const model={vt_ml:z.VtInspired*1000,mv_l_min:z.MV,rr_min:z.RR};assert(Object.values(model).every(x=>Number.isFinite(x)&&x>0));return {model,interaction:{efforts:i.totalEfforts,breaths:i.totalVentilatorBreaths},effortAgreement:i.totalEfforts>0&&i.totalVentilatorBreaths>0&&i.totalEfforts>=.8*i.totalVentilatorBreaths&&i.totalVentilatorBreaths>=.8*i.totalEfforts};}

module.exports={config,run};
