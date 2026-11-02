'use strict';
const assert = require('node:assert/strict');
const { Simulation, AdaptiveVolumeController, VcAcController } = require('../src/simulation');
const { PRESETS } = require('../src/presets');
const { createBerlinClinicalTwinSession, buildController } = require('../src/clinical_twin_session');
const { normalizeMode } = require('../src/ventilator/modes');
const { BreathPhase } = require('../src/ventilator/controller');
let failed = 0;
function test(name, fn) { try { fn(); console.log('ok -', name); } catch(e) { failed++; console.error('FAIL -', name, e.stack); } }
const settings = (extra = {}) => ({ mode:'VC_AC_AUTOFLOW', researchOnly:true, passive:true, startupStrategy:'provided-pressure',
  fio2:.4, peep:5, rr:15, vt:.45, inspiratoryTime:1, initialPinsp:8,
  minPinsp:3, maxAirwayPressure:35, maxPressureStep:3, adaptationGain:.5,
  volumeToleranceFraction:.02, ...extra });
function sim(extra = {}, preset='phenotype_baseline', dt=.002) {
  return new Simulation({ params:PRESETS[preset](), controller:new AdaptiveVolumeController(settings(extra)),
    dt, trackGas:false, initialRecruitmentState:{normal:1,recruitable:0,consolidated:0} });
}
test('exact observed labels map separately; ambiguous and spontaneous modes fail closed', () => {
  assert.equal(normalizeMode('CMV/ASSIST'),'VC_AC');
  assert.equal(normalizeMode('CMV/ASSIST/AutoFlow'),'VC_AC_AUTOFLOW');
  assert.equal(normalizeMode('APV (cmv)'),'APV_CMV');
  for (const m of ['CMV','CPAP/PSV','SPONT','P-CMV','APV (simv)','__proto__']) assert.throws(()=>normalizeMode(m));
  assert(buildController({mode:'CMV/ASSIST',fio2:.4,peep:5,rr:15,vtL:.45,inspiratoryFlowLps:.5}) instanceof VcAcController);
});
test('explicit research/passive gates, timing, pressure margin and finite parameters enforced', () => {
  for (const change of [{researchOnly:false},{passive:false},{passive:undefined},{vt:0},{initialPinsp:NaN},
    {minPinsp:0},{maxAirwayPressure:7},{maxPressureStep:4},{adaptationGain:undefined},
    {adaptationGain:0},{volumeToleranceFraction:1},{inspiratoryTime:4},{inspiratoryPause:NaN}]) {
    assert.throws(()=>new AdaptiveVolumeController(settings(change)), JSON.stringify(change));
  }
  assert.throws(()=>new AdaptiveVolumeController(settings({mode:'APV_CMV'})), /highPressureAlarm/);
  assert.throws(()=>new AdaptiveVolumeController(settings({mode:'APV_CMV',highPressureAlarm:40})), /APV profile/);
});
test('passive AutoFlow surrogate converges via delivered volume; pressure waveform has decelerating flow', () => {
  const s=sim();s.runFor(60);const d=s.controller.diagnostics();
  assert(d.completedBreaths>=14);assert(Math.abs(d.lastBreath.deliveredVtL-.45)<.45*.025);
  const rows=s.trace.filter(r=>r.phase===BreathPhase.INSPIRATION && r.t>52 && r.t<53);
  assert(rows.length>100);
  assert(rows[10].output.airwayFlow>rows[rows.length-10].output.airwayFlow);
  assert(rows.every(r=>Math.abs(r.output.airwayPressure-(5+d.currentPinspCmH2O))<1e-6));
  assert.equal(d.authority,'research-only-passive-adaptive-surrogate');
});
test('APV profile remains distinct and enforces alarm-derived ceiling', () => {
  const s=sim({mode:'APV_CMV',highPressureAlarm:45});s.runFor(60);
  assert.equal(s.controller.mode,'APV_CMV');
  const {createVentToArdsCoreSnapshot}=require('../src/hummod_ards_core_coupling');
  assert.equal(createVentToArdsCoreSnapshot(s).ventilator.mode,'APV_CMV');assert(Math.abs(s.controller.lastBreath.deliveredVtL-.45)<.02);
  assert(s.trace.every(r=>r.output.airwayPressure<=35+1e-7));
});
test('unreachable volume stays pressure limited and reports unmet target instead of forcing set VT', () => {
  const s=sim({vt:1.2,initialPinsp:3,maxAirwayPressure:10});s.runFor(40);
  assert(s.trace.every(r=>r.output.airwayPressure<=10+1e-7));
  assert(s.controller.lastBreath.deliveredVtL<.6);
  assert(s.controller.lastBreath.targetNotAchievedAtPressureLimit);
  assert.throws(()=>s.setPEEP(8),/insufficient pressure margin/);assert.equal(s.controller.settings.peep,5);
});
test('adaptation is bounded, occurs once per breath, and responds to target change', () => {
  const s=sim();s.runFor(40);const p=s.controller.pinsp;
  s.controller.settings.vt=.6;s.runFor(40);
  assert(s.controller.pinsp>p);assert(Math.abs(s.controller.lastBreath.deliveredVtL-.6)<.025);
  const c=new AdaptiveVolumeController(settings());c.inspiredVolumeL=.1;c.cycleTime=4;
  c.step({totalVolume:2},.002);assert.equal(c.pinsp,11);assert.equal(c.completedBreaths,1);
  c.step({totalVolume:2},.002);assert.equal(c.pinsp,11);assert.equal(c.completedBreaths,1);
  c.inspiredVolumeL=1;c.cycleTime=4;c.step({totalVolume:2},.002);assert.equal(c.pinsp,8);
});
test('controller changes preserve patient state and report actual adaptive mode', () => {
  const s=sim();s.runFor(6);const before=s.state.t;
  const request=s.requestControllerChange(new AdaptiveVolumeController(settings({mode:'APV_CMV',highPressureAlarm:45})));assert.equal(request.toMode,'APV_CMV');
  s.runFor(5);assert(s.state.t>before);assert.equal(s.controller.mode,'APV_CMV');
  assert(s.interventions.some(e=>e.kind==='APPLY_CONTROLLER_CHANGE' && e.fromMode==='VC_AC_AUTOFLOW' && e.toMode==='APV_CMV'));
  assert(s.trace.every(r=>Number.isFinite(r.output.totalVolume)));
});
test('rejected mechanics steps roll back adaptation and do not learn uncommitted volumes', () => {
  const s=sim();s.runFor(4);s.controller.cycleTime=4;const before=JSON.stringify(s.controller.diagnostics());
  const t=s.state.t;const n=s.trace.length;
  s.mechanics.step=()=>({state:s.state,output:{solverFailure:true,failureKind:'INJECTED'}});
  assert(s.step().failed);assert.equal(JSON.stringify(s.controller.diagnostics()),before);
  assert.equal(s.state.t,t);assert.equal(s.trace.length,n);
});
test('hold-contaminated breaths are excluded from controller feedback', () => {
  const c=new AdaptiveVolumeController(settings());c.inspiredVolumeL=.1;
  c.observeCommittedStep({totalVolume:2},'INSPIRATION',true);c.cycleTime=4;
  c.step({totalVolume:2},.002);assert.equal(c.pinsp,8);assert.equal(c.lastBreath.feedbackUsed,false);
  assert.equal(c.lastBreath.feedbackStatus,'HOLD_INTERRUPTED');
  const s=sim();s.runFor(8);s.requestInspiratoryHold(.3);s.runFor(6);
  assert(s.measurements.some(m=>m.kind==='INSPIRATORY_HOLD'));
});
test('time-step refinement and heterogeneous-lung runs remain finite', () => {
  const a=sim({},'phenotype_baseline',.002),b=sim({},'phenotype_baseline',.001);
  a.runFor(48);b.runFor(48);assert(Math.abs(a.controller.lastBreath.deliveredVtL-b.controller.lastBreath.deliveredVtL)<.01);
  for(const preset of ['phenotype_low_recruitability','phenotype_high_recruitability']) {
    const s=sim({},preset);s.runFor(40);
    assert(s.trace.every(r=>Number.isFinite(r.output.totalVolume) && r.output.compartmentVolumes.every(v=>v>=0)));
    assert(s.controller.pinsp>=3 && s.controller.pinsp<=30);
  }
});
test('clinical session accepts observed labels and exposes target separately from delivered volume', () => {
  const { HUMMOD_EXPORT_SCHEMA }=require('../src/hummod_export_contract');
  const { HUMMOD_STANDALONE_UPSTREAM: source }=require('../src/hummod_standalone_manifest');
  const values={'PO2Artys.Pressure':80,'CO2Artys.Pressure':40,'BloodPh.ArtysPh':7.4,
    'Heart-Rate.Rate':90,'SystemicArtys.Pressure':75,'CardiacOutput.Flow(L/Min)':5};
  const humModExport={schema:HUMMOD_EXPORT_SCHEMA,trajectoryId:'adaptive-mode-test',
    source:{repository:source.repository,revision:source.revision,mirrorRepository:source.mirrorRepository,
      mirrorRevision:source.mirrorRevision,exporterVersion:'fixture/1'},symbols:Object.keys(values),
    rows:[{timestampSec:0,values},{timestampSec:100,values}]};
  const ventilation={mode:'CMV/ASSIST/AutoFlow',researchOnly:true,passive:true,calibrationPauseSec:.1,fio2:.4,peep:5,rr:15,
    vtL:.45,inspiratoryTimeSec:1,initialPinspCmH2O:8,minPinspCmH2O:3,maxAirwayPressureCmH2O:35,
    maxPressureStepCmH2O:3,adaptationGain:.5,volumeToleranceFraction:.02};
  const session=createBerlinClinicalTwinSession({caseId:'berlin-moderate-moderate-aspiration',
    humModExport,ventilation,initialRecruitmentState:{normal:1,recruitable:.35,consolidated:0}});
  session.initialize();const snap=session.runFor(20);
  assert.equal(snap.ventilator.mode,'VC_AC_AUTOFLOW');assert.equal(snap.ventilator.vtL,.45);
  assert(snap.ventilator.adaptive.lastBreath.deliveredVtL>0);
  assert.equal(snap.coupling.systemicResponseToVentInterventions,'not-modeled-by-fixed-replay');
  session.requestVentilationChange({...ventilation,mode:'APV (cmv)',highPressureAlarmCmH2O:45});
  const next=session.runFor(8);assert.equal(next.ventilator.mode,'APV_CMV');
  assert.equal(next.systemic.gasExchange.paco2MmHg,40);
});
test('stiffer lungs and increased resistance increase required pressure without forcing delivered VT', () => {
  const s=sim();s.runFor(40);const first=s.controller.pinsp;
  s.params.compartments.forEach(c=>{c.elasticScale*=1.5;});s.runFor(40);
  const stiff=s.controller.pinsp;assert(stiff>first);
  s.params.centralAirwayResistance*=4;s.runFor(40);
  assert(s.controller.pinsp>stiff);assert(Math.abs(s.controller.lastBreath.deliveredVtL-.45)<.025);
  s.setPEEP(8);assert(s.controller.feedbackInvalidated);
  s.runFor(4);assert.equal(s.controller.lastBreath.feedbackStatus,'PEEP_CHANGED');
});
process.exitCode=failed?1:0;
