'use strict';
const assert=require('node:assert/strict');
const {Simulation,AdaptiveVolumeController}=require('../src/simulation');
const {PRESETS}=require('../src/presets');
const {DeliveredBreathSampler}=require('../src/ventilator/delivered_breaths');
const {createResearchDeliveredGasSession}=require('../src/research_delivered_gas_session');
const {createLiveCoreBoundaryFromVent}=require('../src/hummod_ards_core_vent_adapter');
let failed=0;
function test(name,fn){try{fn();console.log('ok -',name);}catch(e){failed++;console.error('FAIL -',name,e.stack);}}
function settings(extra={}) {return {mode:'VC_AC_AUTOFLOW',researchOnly:true,passive:true,
 fio2:.4,peep:5,rr:15,vt:.45,inspiratoryTime:1,initialPinsp:8,minPinsp:3,maxAirwayPressure:35,
 highPressureAlarm:45,maxPressureStep:3,adaptationGain:.5,volumeToleranceFraction:.02,
 calibrationPauseSec:.1,...extra};}
function sim(extra={},dt=.002){return new Simulation({params:PRESETS.phenotype_baseline(),
 controller:new AdaptiveVolumeController(settings(extra)),dt,trackGas:false,
 initialRecruitmentState:{normal:1,recruitable:0,consolidated:0}});}
const boundaries=()=>({systemic:{cardiacOutputMlPerMin:5000,tissueO2UseMlPerMin:250,tissueCo2ProductionMmolPerMin:8.92},
 pulmonary:{deadSpaceBtpsMl:150,membranePermeabilityMlPerMinPerMmHg:1000},
 blood:{sidMolPerL:.04,o2MaxMlPerMl:.2,tempC:37,carboxyPercent:0},environment:{barometricPressureMmHg:760}});
function session(s=sim()){return createResearchDeliveredGasSession({simulation:s,boundaries:boundaries(),researchOnly:true,maxSampleAgeSec:12});}
test('AutoFlow calibration removes original first-breath overshoot and records calibration provenance',()=>{
 const s=sim();s.runFor(4.1);let b=s.controller.lastBreath;
 assert.equal(b.control,'FLOW_CALIBRATION');assert(Math.abs(b.deliveredVtL-.45)<.002);
 assert.equal(b.feedbackStatus,'STARTUP_FLOW_CALIBRATION');s.runFor(4);
 assert.equal(s.controller.lastBreath.control,'ADAPTIVE_PRESSURE');assert(s.controller.lastBreath.deliveredVtL<.47);
 const old=sim({startupStrategy:'provided-pressure'});old.runFor(4.1);assert(old.controller.lastBreath.deliveredVtL>.65);
});
test('calibration pause is explicit; APV low-pressure startup remains separately identified',()=>{
 assert.throws(()=>sim({calibrationPauseSec:undefined}),/calibrationPauseSec/);
 assert.throws(()=>sim({calibrationPauseSec:1}),/calibrationPauseSec/);
 const a=sim({mode:'APV_CMV'});a.runFor(4.1);assert(a.controller.lastBreath.deliveredVtL<.45);
 assert.equal(a.controller.diagnostics().startupStrategy,'low-pressure-probe');
 a.runFor(44);assert(Math.abs(a.controller.lastBreath.deliveredVtL-.45)<.01);
});
test('pressure-limited calibration re-solves mechanics and never forces target volume',()=>{
 const s=sim({vt:1,initialPinsp:5,maxAirwayPressure:10});s.runFor(4.1);
 assert(s.trace.every(r=>r.output.airwayPressure<=10+1e-7));
 assert(s.controller.lastBreath.deliveredVtL<.6);assert(s.controller.lastBreath.targetNotAchievedAtPressureLimit);
 assert(s.controller.lastBreath.control==='FLOW_CALIBRATION');
});
test('calibration and its pressure-ceiling re-solve remain transactional on failure',()=>{
 const s=sim();const before=JSON.stringify(s.controller.diagnostics());
 s.mechanics.step=()=>({state:s.state,output:{solverFailure:true}});assert(s.step().failed);
 assert.equal(JSON.stringify(s.controller.diagnostics()),before);assert.equal(s.trace.length,0);
 const cap=sim({maxAirwayPressure:10,initialPinsp:5,vt:1});let count=0;
 cap.mechanics.step=()=>++count===1?{state:cap.state,output:{solverFailure:false,airwayPressure:20}}:{state:cap.state,output:{solverFailure:true}};
 assert(cap.step().failed);assert.equal(count,2);assert.equal(cap.state.t,0);assert.equal(cap.controller.cycleTime,0);
});
test('sampler fails closed before warmup and measures cycle timestamps instead of set rate',()=>{
 const sampler=new DeliveredBreathSampler();assert.throws(()=>sampler.sample(0,10),/no valid completed/);
 const ctrl={mode:'APV_CMV',cycleTime:.002};
 sampler.observe({before:{t:0,totalVolume:2},after:{t:.002,totalVolume:2.2},phase:'INSPIRATION',controller:ctrl,dt:.002});
 ctrl.cycleTime=1;sampler.observe({before:{t:1,totalVolume:2.2},after:{t:1.002,totalVolume:2},phase:'EXPIRATION',controller:ctrl,dt:.002});
 ctrl.cycleTime=.002;sampler.observe({before:{t:5,totalVolume:2},after:{t:5.002,totalVolume:2.1},phase:'INSPIRATION',controller:ctrl,dt:.002});
 const q=sampler.sample(5,10);assert.equal(q.actualRatePerMin,12);assert(Math.abs(q.deliveredVtL-.2)<1e-10);
 assert.throws(()=>sampler.sample(20,10),/stale/);
});
test('research gas boundary requires measured breaths, explicit dead space and opt-in',()=>{
 const s=sim();assert.throws(()=>createLiveCoreBoundaryFromVent({simulation:s,...boundaries()}),/VC_AC only/);
 const c=session(s);assert.throws(()=>c.initializeGas({useHumModSourceInitialState:true}),/no valid completed/);
 c.warmup(12);c.initializeGas({useHumModSourceInitialState:true});const r=c.runFor(1);
 assert(r.adapter.boundary.ventilation.tidalVolumeBtpsMl>0);
 assert.equal(r.adapter.diagnostics.ventilationAuthority,'research-only-last-completed-breath');
 assert.throws(()=>createResearchDeliveredGasSession({simulation:s,boundaries:boundaries()}),/researchOnly/);
 const b=boundaries();delete b.pulmonary.deadSpaceBtpsMl;
 assert.throws(()=>createResearchDeliveredGasSession({simulation:s,boundaries:b,researchOnly:true,maxSampleAgeSec:12}),/dead space/);
 const bad={...c.sampler.sample(s.state.t,12),actualRatePerMin:100,researchOnly:true};
 assert.throws(()=>createLiveCoreBoundaryFromVent({simulation:s,...boundaries(),researchDeliveredVentilation:bad}),/timing/);
});
test('gas input uses low delivered VT under a pressure cap, not the higher target',()=>{
 const s=sim({vt:.6,initialPinsp:5,maxAirwayPressure:10});const c=session(s);
 c.warmup(40);c.initializeGas({useHumModSourceInitialState:true});const x=c.runFor(10);
 const v=x.adapter.boundary.ventilation;assert(v.tidalVolumeBtpsMl<500);assert.notEqual(v.tidalVolumeBtpsMl,600);
 assert(Math.abs(v.tidalVolumeBtpsMl-c.sampler.last.deliveredVtL*1000)<3);
 assert(Math.abs(v.respiratoryRatePerMin-c.sampler.last.actualRatePerMin)<.1);
});
test('higher delivered ventilation lowers PaCO2 and raises pH with unchanged metabolism',()=>{
 const outputs=[];
 for(const vt of [.35,.6]){
  const c=session(sim({vt}));c.warmup(48);c.initializeGas({useHumModSourceInitialState:true});outputs.push(c.runFor(90));
 }
 assert(outputs[1].gas.gases.arterial.pco2MmHg<outputs[0].gas.gases.arterial.pco2MmHg);
 assert(outputs[1].gas.gases.arterial.pH>outputs[0].gas.gases.arterial.pH);
 assert.equal(outputs[1].gas.boundary.metabolism.tissueCo2ProductionMmolPerMin,outputs[0].gas.boundary.metabolism.tissueCo2ProductionMmolPerMin);
});
test('pressure ceiling at the same set VT increases PaCO2 through measured delivery shortfall',()=>{
 const outputs=[];
 for(const cap of [35,10]){
  const c=session(sim({vt:.6,maxAirwayPressure:cap,initialPinsp:5}));c.warmup(48);
  c.initializeGas({useHumModSourceInitialState:true});outputs.push(c.runFor(90));
 }
 assert(outputs[1].adapter.boundary.ventilation.tidalVolumeBtpsMl<outputs[0].adapter.boundary.ventilation.tidalVolumeBtpsMl);
 assert(outputs[1].gas.gases.arterial.pco2MmHg>outputs[0].gas.gases.arterial.pco2MmHg);
});
test('timestep refinement preserves startup calibration within 2 mL',()=>{
 const a=sim({},.002),b=sim({},.001);a.runFor(4.1);b.runFor(4.1);
 assert(Math.abs(a.controller.lastBreath.deliveredVtL-b.controller.lastBreath.deliveredVtL)<.002);
});
test('VT reduction and mode change recalibrate without replacing the persistent lung',()=>{
 const s=sim();s.runFor(32);const priorTime=s.state.t,priorVolume=s.state.totalVolume;
 s.requestControllerChange(new AdaptiveVolumeController(settings({vt:.3})));
 assert.equal(s.state.totalVolume,priorVolume);s.runFor(12);
 assert(s.state.t>priorTime);assert(s.controller.lastBreath.deliveredVtL<.32);
 s.setPEEP(8);assert(s.controller.feedbackInvalidated);s.runFor(8);
 s.requestControllerChange(new AdaptiveVolumeController(settings({mode:'APV_CMV',peep:8,vt:.3})));
 s.runFor(16);assert.equal(s.controller.mode,'APV_CMV');
 assert(s.trace.every(r=>Number.isFinite(r.output.totalVolume)));
});
test('holds invalidate delivered sampling rather than substituting a set volume',()=>{
 const s=sim();const c=session(s);c.warmup(8);
 s.requestInspiratoryHold(.5);assert.throws(()=>c.warmup(4.6),/no valid completed/);
 assert.throws(()=>c.sampler.sample(s.state.t,12),/no valid completed/);
 c.warmup(4.1);assert(c.sampler.sample(s.state.t,12).deliveredVtL>0);
});
test('gas and mechanics clocks advance together; failed mechanics cannot advance gas',()=>{
 const s=sim(),c=session(s);c.warmup(12);c.initializeGas({useHumModSourceInitialState:true});
 const start=s.state.t;const x=c.runFor(2);assert(Math.abs(x.mechanicsTimeSec-start-x.gas.timeSec)<1e-8);
 const gasTime=x.gas.timeSec;s.mechanics.step=()=>({state:s.state,output:{solverFailure:true}});
 assert.throws(()=>c.runFor(1),/mechanical solve/);assert.equal(c.snapshot().gas.timeSec,gasTime);
 assert(c.snapshot().failed);
});
test('isolated gas composition rejects hold maneuvers before advancing either clock',()=>{
 const s=sim(),c=session(s);c.warmup(12);c.initializeGas({useHumModSourceInitialState:true});
 s.requestInspiratoryHold(.5);const time=s.state.t;
 assert.throws(()=>c.runFor(1),/does not support hold/);assert.equal(s.state.t,time);assert.equal(c.snapshot().gas.timeSec,0);
 assert(c.snapshot().failed);
});
process.exitCode=failed?1:0;
