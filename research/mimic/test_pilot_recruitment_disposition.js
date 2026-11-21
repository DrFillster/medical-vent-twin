'use strict';
const assert=require('assert');const {optionsFor}=require('./explicit_patient_state_adapter');const {config}=require('./time_verified_ps_runner');const {recruitmentRate}=require('../../ards-twin-v1.0/src/recruitment');
const p={vent:{fio2_percent:40,peep:5,psv:10}},c={drive:.3,elastic:1,capacity:1,resistance:1,transmission:1};const cfg=config(p,c),options=optionsFor(cfg),cp=options.patientMechanicsParams.compartments.find(x=>x.id==='recruitable');
assert(!cfg.recruitmentKinetics);const defaults={P_open:25,P_close:10,k_open:.02,k_close:.05};
for(const pressure of [0,5,12,24,30,40])assert.strictEqual(recruitmentRate(.35,pressure,cp),recruitmentRate(.35,pressure,defaults));
const corrected=optionsFor({...cfg,recruitmentKinetics:{...cp.recruitment}}).patientMechanicsParams.compartments.find(x=>x.id==='recruitable');assert.equal(corrected.P_open,cp.recruitment.P_open);assert.notStrictEqual(recruitmentRate(.35,24,cp),recruitmentRate(.35,24,corrected));
console.log('PASS selected path uses effective runtime defaults, differs from template-declared thresholds; validation freeze remains blocked pending explicit kinetic-path disposition');
