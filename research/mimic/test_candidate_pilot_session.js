'use strict';
const assert=require('assert'),{spawnSync}=require('child_process'),{createCandidatePilotSession,requireEvaluationLock}=require('./candidate_pilot_session'),{config}=require('./time_verified_ps_runner');
assert.throws(()=>requireEvaluationLock(null));assert.throws(()=>requireEvaluationLock({schema:'candidate-pilot-review/v1'}));
const base={stateConfig:config({vent:{fio2_percent:40,peep:5,psv:10}},{drive:.3,elastic:1,capacity:1,resistance:1,transmission:1}),gasParameters:{deadSpace:.5,vpf:.7},sid:.04,arterialGas:{po2MmHg:90,pco2MmHg:40,pH:7.4}};
assert.throws(()=>createCandidatePilotSession({...base,gasParameters:{deadSpace:.9,vpf:.7}}));assert.throws(()=>createCandidatePilotSession({...base,arterialGas:{pH:7.4}}));
const session=createCandidatePilotSession(base);session.initialize();const z=session.runFor(10);assert(Number.isFinite(z.systemic.gasExchange.pH));
const wrongOrder=spawnSync(process.execPath,['-e',"require('./ards-twin-v1.0/src/clinical_twin_live_hummod_session');require('./research/mimic/candidate_pilot_session')"],{cwd:require('path').join(__dirname,'../..'),encoding:'utf8'});assert.notEqual(wrongOrder.status,0);assert(wrongOrder.stderr.includes('isolated worker required'));
console.log('PASS integrated corrected session smoke, rejected missing review/bad inputs, rejected unsafe initializer load order; not independent evaluation');
