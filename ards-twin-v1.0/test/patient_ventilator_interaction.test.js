'use strict';const assert=require('node:assert/strict');const {analyzePatientVentilatorInteraction}=require('../src/patient_ventilator_interaction.js');
const tr=[
 {t:0,phase:'EXPIRATION',patientMusclePressureCmH2O:0},{t:.1,phase:'EXPIRATION',patientMusclePressureCmH2O:1},{t:.2,phase:'INSPIRATION',patientMusclePressureCmH2O:1},{t:.3,phase:'EXPIRATION',patientMusclePressureCmH2O:1},{t:.4,phase:'INSPIRATION',patientMusclePressureCmH2O:1},{t:.5,phase:'EXPIRATION',patientMusclePressureCmH2O:0},
 {t:1,phase:'EXPIRATION',patientMusclePressureCmH2O:1},{t:1.5,phase:'EXPIRATION',patientMusclePressureCmH2O:0}];
const x=analyzePatientVentilatorInteraction(tr);assert.equal(x.doubleTriggers,1);assert.equal(x.ineffectiveEfforts,1);assert.equal(x.totalEfforts,2);console.log('ok - interaction analyzer derives ineffective efforts and double triggers from actual timing');
