'use strict';
const assert=require('node:assert/strict');
const {PARAMETER_SET,PARAMETERS}=require('../src/albanese_2016_control_parameter_set.js');
const {createUrsinoMagossoAutonomicShadow,vagalFiring}=require('../src/ursino_magosso_autonomic_shadow.js');
const {createUrsinoMagosso2000LocalO2Candidate}=require('../src/ursino_magosso_2000_local_o2_candidate.js');
const {arterialO2ConcentrationMlO2PerMlBlood}=require('../src/ursino_magosso_2000_oxygen_metabolic_candidate.js');
const {createUrsinoMagosso2000SplitEffectorsRuntime}=require('../src/ursino_magosso_2000_split_effectors_runtime.js');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('ok - '+name);}catch(e){failed++;console.error('FAIL - '+name+': '+e.message);}}
function close(a,b){assert(Math.abs(a-b)<1e-10,`${a} != ${b}`);}

test('published signed weights produce distinct resistance, venous and cardiac firing',()=>{
  const a=createUrsinoMagossoAutonomicShadow({controlParameterSet:PARAMETER_SET});
  const s=a.step({dtSec:0,pao2MmHg:50,tidalVolumeL:1.474,fAbSpikesPerSec:25});
  close(s.fApSpikesPerSec,11.76*1.474);
  // Independent signed form, transcribed directly from Table 7.
  const firing=(wb,wc,wp,theta)=>Math.min(60,2.1+(16.11-2.1)*Math.exp(.0675*(wb*25+wc*s.fAcSpikesPerSec+wp*s.fApSpikesPerSec-theta)));
  close(s.fSpSpikesPerSec,firing(-1.1375,1.716,-.3997,s.thetaSpSpikesPerSec));
  close(s.fSvSpikesPerSec,firing(-1.0806,1.716,-.2907,s.thetaSpSpikesPerSec));
  close(s.fShSpikesPerSec,firing(-1.75,1,0,s.thetaShSpikesPerSec));
  assert.notEqual(s.fSpSpikesPerSec,s.fSvSpikesPerSec);
  close(s.fVSpikesPerSec,vagalFiring({fAbSpikesPerSec:25,fAcSpikesPerSec:s.fAcSpikesPerSec,fApSpikesPerSec:s.fApSpikesPerSec}));
  assert.match(s.provenance.status,/adaptation/);
  assert.equal(s.provenance.parameterSource.table,7);
});

test('all three published local oxygen gains retain the source time constants and concentration units',()=>{
  const ca=arterialO2ConcentrationMlO2PerMlBlood({pao2MmHg:95,paco2MmHg:40});
  const r=createUrsinoMagosso2000LocalO2Candidate({controlParameterSet:PARAMETER_SET});
  // Set each venous concentration 0.01 mL O2/mL below its source reference.
  const s=r.step({dtSec:10,pao2MmHg:95,paco2MmHg:40,
    brainFlowMlPerSec:.7917/(ca-.13),coronaryFlowMlPerSec:.4/(ca-.10),
    muscleFlowMlPerSec:.86/(ca-.145),muscleNormalResistanceMmHgSecPerMl:4.48,
    averageCardiacPumpPowerMmHgMlPerSec:12660});
  for(const [bed,gain] of Object.entries({brain:140,heart:490,muscle:420})){
    close(s.localState[bed],gain*.01*(1-Math.exp(-1)));
  }
  assert.match(s.provenance.status,/adaptation/);
});

test('venous sympathetic input changes volumes without leaking into resistance or cardiac effectors',()=>{
  const config={initialVascularSympatheticSpikesPerSec:5,initialCardiacSympatheticSpikesPerSec:5,initialCardiacVagalSpikesPerSec:4};
  const r=createUrsinoMagosso2000SplitEffectorsRuntime(config);
  const before=r.snapshot();let s;
  for(let i=0;i<100;i++)s=r.step({dtSec:.1,vascularSympatheticSpikesPerSec:5,venousSympatheticSpikesPerSec:12,cardiacSympatheticSpikesPerSec:5,cardiacVagalSpikesPerSec:4});
  for(const key of ['Rsp','Rep','RmpNormal','EmaxLv','EmaxRv','heartPeriodSec'])close(s.absolute[key],before.absolute[key]);
  for(const key of ['Vusv','Vuev','Vumv'])assert(s.absolute[key]<before.absolute[key]);
});

test('original source profile stays the default and unknown profiles are rejected',()=>{
  const original=createUrsinoMagossoAutonomicShadow().step({dtSec:0,pao2MmHg:95,tidalVolumeL:.583,fAbSpikesPerSec:25});
  close(original.fApSpikesPerSec,23.29*.583);
  close(original.fSvSpikesPerSec,original.fSpSpikesPerSec);
  assert.equal(original.provenance.status,'exact-primary-source-transcription-shadow-only');
  assert.throws(()=>createUrsinoMagossoAutonomicShadow({controlParameterSet:'guessed-gain'}));
  assert.throws(()=>createUrsinoMagosso2000LocalO2Candidate({controlParameterSet:'guessed-gain'}));
  assert(Object.isFrozen(PARAMETERS.localOxygenGains));
});
console.log(`\nTests: passed=${passed} failed=${failed}`);
process.exit(failed?1:0);
