'use strict';
const {Simulation}=require('../src/simulation.js');
const {PRESETS}=require('../src/presets.js');
const {SimvCandidateController,SOURCE}=require('../src/ventilator/simv_candidate.js');
function assert(c,m){if(!c)throw new Error(m||'assertion failed');}
function makeController(){return new SimvCandidateController({fio2:.4,peep:5,mandatoryRatePerMin:6,mandatoryPinspCmH2O:10,mandatoryInspiratoryTimeSec:.8,mandatoryRiseTimeSec:.1,pressureSupportCmH2O:6,supportRiseTimeSec:.1,flowTriggerLMin:1.5,cycleOffFraction:.25,minExpiratoryTimeSec:.15,maxSupportInspiratoryTimeSec:1.3,syncWindowSec:1});}
function effort({timeSec}){const phase=timeSec%3.2;return phase<.9?4:0;}
let rejected=false;try{new SimvCandidateController({fio2:.4,peep:5});}catch(e){rejected=/mandatoryRatePerMin/.test(e.message);}assert(rejected,'SIMV candidate must fail closed without explicit timing/trigger inputs');
assert(SOURCE.sampleIntervalSec===.01,'assisted trigger must sample at 10 ms');
const controller=makeController();
const sim=new Simulation({params:PRESETS.phenotype_baseline(),controller,dt:.001,initialRecruitmentState:{normal:1,recruitable:0,consolidated:0},patientEffortProvider:effort});
sim.runFor(24);const snap=controller.snapshot();
assert(snap.mandatoryBreathCount>=2,'SIMV must deliver mandatory breaths');
assert(snap.spontaneousBreathCount>=2,'SIMV must permit flow-triggered supported breaths');
const rows=sim.trace.filter(r=>r.phase==='INSPIRATION');
assert(rows.some(r=>r.output.airwayPressure>14.5),'mandatory breaths must reach PEEP + mandatory Pinsp');
assert(rows.some(r=>r.output.airwayPressure>10.5&&r.output.airwayPressure<12),'supported breaths must reach PEEP + PS');
assert(sim.trace.some(r=>r.patientMusclePressureCmH2O>=4),'trace must preserve patient effort');
assert(['FLOW','FLOW_SYNC','TIME'].includes(snap.lastTrigger));
assert(snap.controlAuthority===false&&snap.authority==='candidate-not-canonical');
console.log('ok - candidate SIMV uses source flow trigger for spontaneous/synchronized assistance');
console.log(JSON.stringify({mandatoryBreaths:snap.mandatoryBreathCount,spontaneousBreaths:snap.spontaneousBreathCount,totalBreaths:snap.breathIndex,lastTrigger:snap.lastTrigger,lastCycleReason:snap.lastCycleReason},null,2));
