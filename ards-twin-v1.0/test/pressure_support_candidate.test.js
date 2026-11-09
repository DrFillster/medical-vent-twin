'use strict';

const { Simulation } = require('../src/simulation.js');
const { PRESETS } = require('../src/presets.js');
const { PressureSupportCandidateController, SOURCE } = require('../src/ventilator/pressure_support_candidate.js');

function assert(cond,msg){if(!cond)throw new Error(msg||'assertion failed');}
function effort({timeSec}){const phase=timeSec%4;return phase<1?4:0;}

function run(pressureSupport){
  const controller=new PressureSupportCandidateController({
    fio2:0.4,peep:5,pressureSupport,
    flowTriggerLMin:1.5,cycleOffFraction:0.25,
    minExpiratoryTimeSec:0.15,maxInspiratoryTimeSec:1.5,
    riseTimeSec:0.1,backupRatePerMin:2,
  });
  const sim=new Simulation({
    params:PRESETS.phenotype_baseline(),controller,dt:0.001,
    initialRecruitmentState:{normal:1,recruitable:0,consolidated:0},
    patientEffortProvider:effort,
  });
  sim.runFor(16);
  return {sim,controller};
}

let rejected=false;
try{new PressureSupportCandidateController({fio2:.4,peep:5,pressureSupport:8});}
catch(e){rejected=/flowTriggerLMin/.test(e.message);}
assert(rejected,'candidate must fail closed when source timing inputs are omitted');
assert(SOURCE.sampleIntervalSec===0.01,'Hennigs trigger sampling must be 10 ms');
assert(SOURCE.defaultFlowTriggerLMin===1.5,'source default beta must be 1.5 L/min');
assert(SOURCE.defaultCycleOffFraction===0.25,'source alpha must be 0.25');

const cpap=run(0), ps=run(8);
assert(ps.controller.breath>=3,'patient effort flow should trigger repeated supported breaths');
assert(ps.controller.snapshot().lastTrigger==='FLOW','spontaneous breaths should use source flow trigger');
assert(ps.sim.trace.some(r=>r.phase==='INSPIRATION'&&r.output.airwayPressure>12),
  'pressure support should raise inspiratory airway pressure above CPAP');
assert(ps.sim.trace.some(r=>r.phase==='EXPIRATION'&&Math.abs(r.output.airwayPressure-5)<0.2),
  'expiration should return to PEEP');

const rampRows=ps.sim.trace.filter(r=>r.phase==='INSPIRATION').slice(0,80);
assert(rampRows.some(r=>r.output.airwayPressure>5&&r.output.airwayPressure<13),
  'source Eq24 linear ramp should create intermediate airway pressures');

function meanBreathVt(sim){
  const breaths=sim.metrics().filter(b=>b.VtInspired>0.02);
  return breaths.reduce((sum,b)=>sum+b.VtInspired,0)/breaths.length;
}
const cpapVt=meanBreathVt(cpap.sim),psVt=meanBreathVt(ps.sim);
assert(psVt>cpapVt,'pressure support must increase VT for the same patient effort');
const snap=ps.controller.snapshot();
assert(snap.controlAuthority===false&&snap.authority==='candidate-not-canonical');
console.log('ok - source-aligned candidate PS/CPAP uses rising-flow trigger, ramp, and flow cycle');
console.log(JSON.stringify({cpapVt,psVt,breaths:snap.breathIndex,lastTrigger:snap.lastTrigger,lastCycleReason:snap.lastCycleReason},null,2));
