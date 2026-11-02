#!/usr/bin/env node
'use strict';
// Deterministic synthetic mechanics benchmark; writes JSON to stdout only.
const { Simulation, AdaptiveVolumeController }=require('../src/simulation');
const { PRESETS }=require('../src/presets');
const results=[];
for(const mode of ['VC_AC_AUTOFLOW','APV_CMV']) {
  const simulation=new Simulation({params:PRESETS.phenotype_baseline(),
    controller:new AdaptiveVolumeController({mode,researchOnly:true,passive:true,calibrationPauseSec:.1,
      fio2:.4,peep:5,rr:15,vt:.45,inspiratoryTime:1,initialPinsp:8,minPinsp:3,
      maxAirwayPressure:35,highPressureAlarm:45,maxPressureStep:3,
      adaptationGain:.5,volumeToleranceFraction:.02}),
    dt:.002,trackGas:false,initialRecruitmentState:{normal:1,recruitable:0,consolidated:0}});
  const stages=[['baseline',()=>{}],['increased_stiffness',()=>simulation.params.compartments.forEach(c=>{c.elasticScale*=1.5;})],
    ['increased_resistance',()=>{simulation.params.centralAirwayResistance*=4;}],
    ['higher_vt_target',()=>{simulation.controller.settings.vt=.6;}],
    ['pressure_limited_target',()=>{simulation.controller.settings.vt=2;}]];
  for(const [stage,change] of stages) {
    change();simulation.runFor(40);
    results.push({stage,timeSec:simulation.state.t,...simulation.controller.diagnostics()});
  }
}
console.log(JSON.stringify({schema:'passive-adaptive-vent-benchmark/v1',
  authority:'synthetic engineering verification, not device or clinical validation',
  interpretation:'Both profiles deliberately share an unvalidated surrogate update law; matching behavior is not vendor equivalence.',results},null,2));
