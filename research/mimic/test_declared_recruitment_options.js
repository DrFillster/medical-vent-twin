'use strict';
const assert=require('assert'),{config}=require('./time_verified_ps_runner'),{optionsFor}=require('./explicit_patient_state_adapter'),{declaredRecruitmentOptions}=require('./declared_recruitment_options'),{recruitmentRate,stepRecruitmentWithFloor}=require('../../ards-twin-v1.0/src/recruitment');
const cfg=config({vent:{fio2_percent:40,peep:5,psv:10}},{drive:.3,elastic:1,capacity:1,resistance:1,transmission:1}),before=JSON.stringify(cfg),legacy=optionsFor(cfg),fixed=declaredRecruitmentOptions(cfg);assert.equal(JSON.stringify(cfg),before);const cp=fixed.patientMechanicsParams.compartments.find(x=>x.id==='recruitable');
for(const pressure of [0,5,12,24,30,40])assert.equal(recruitmentRate(.35,pressure,cp),recruitmentRate(.35,pressure,cp.recruitment));
for(const k of ['P_open','P_close','k_open','k_close'])assert.equal(cp[k],cp.recruitment[k]);
const strip=o=>{o=JSON.parse(JSON.stringify(o));for(const c of o.patientMechanicsParams.compartments)for(const k of ['P_open','P_close','k_open','k_close'])delete c[k];return o;};assert.deepStrictEqual(strip(legacy),strip(fixed));
const volume=.4*cp.capacity;assert(stepRecruitmentWithFloor(.6,0,.02,volume,cp,0)*cp.capacity>=volume);
assert.throws(()=>declaredRecruitmentOptions({...cfg,recruitmentKinetics:{P_open:5,P_close:10,k_open:.02,k_close:.05}}));
console.log('PASS declared kinetics reach dynamic rate; no input mutation or unrelated options changed; feasible-volume floor retained');
