'use strict';
const {spawnSync}=require('child_process'),assert=require('assert');
const tests=['test_isolated_state_controls.js','test_expiratory_state_controls.js','test_recruitment_history_controls.js','test_recruitment_parameter_wiring.js','test_explicit_patient_state_adapter.js'];
for(const t of tests){const x=spawnSync(process.execPath,[require('path').join(__dirname,t)],{encoding:'utf8'});assert.strictEqual(x.status,0,t+'\n'+x.stderr);console.log('PASS '+t);}
console.log('NOTE: recruitment parameter mismatch test reproduces an unresolved legacy defect, not a repaired production path.');
