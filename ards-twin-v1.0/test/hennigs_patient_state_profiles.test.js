'use strict';
const assert=require('node:assert/strict');
const {PROFILES,getPatientStateProfile}=require('../src/hennigs_patient_state_profiles.js');
assert.equal(PROFILES.passive_paralyzed.muscleTransmission,0);
assert.equal(PROFILES.awake_cooperative.muscleTransmission,1);
assert(PROFILES.agitated_high_drive.driveRelative>PROFILES.awake_cooperative.driveRelative);
assert(PROFILES.agitated_high_drive.driveRelative<=1.1105014884421243);
assert.throws(()=>getPatientStateProfile('invented'));
console.log('ok - explicit Hennigs patient-state profiles');
