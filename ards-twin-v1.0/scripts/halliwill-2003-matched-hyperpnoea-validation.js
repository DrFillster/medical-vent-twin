#!/usr/bin/env node
'use strict';

const {
  createGasCardiovascularClosedLoopCandidate,
}=require('../src/ursino_magosso_gas_closed_loop_candidate.js');

const DT=0.002;

function meanWindow(r,seconds=10){
  const n=Math.round(seconds/DT);
  const sums={hrPerMin:0,mapMmHg:0};
  for(let i=0;i<n;i++){
    const s=r.snapshot();
    sums.hrPerMin+=s.hemodynamics.heartRatePerMin;
    sums.mapMmHg+=s.hemodynamics.systemicArterialPressureMmHg;
    r.step();
  }
  sums.hrPerMin/=n;
  sums.mapMmHg/=n;
  return sums;
}

function runCondition({pao2MmHg,paco2MmHg,tidalVolumeL}){
  const r=createGasCardiovascularClosedLoopCandidate({
    dtSec:DT,
    pao2MmHg:100,
    paco2MmHg:37.6,
    tidalVolumeL:0.667,
  });
  r.runFor(120);
  const baseline=meanWindow(r,10);
  r.setEnvironment({pao2MmHg,paco2MmHg,tidalVolumeL});
  r.runFor(120);
  return {baseline,...meanWindow(r,10)};
}

// Halliwill et al. 2003 Table 1 reports:
// normoxia VT 0.667 L, PETCO2 37.6 mmHg;
// matched isocapnic hyperpnoea VT 1.444 L, PETCO2 38.4 mmHg;
// isocapnic hypoxia VT 1.474 L, PETCO2 39.1 mmHg, SaO2 85.7%.
// The publication does not supply PaO2 for that condition. PaO2=50 mmHg is
// therefore an explicit test coordinate, not a claim of protocol equivalence.
const hyperpnoea=runCondition({
  pao2MmHg:100,
  paco2MmHg:38.4,
  tidalVolumeL:1.444,
});
const hypoxia=runCondition({
  pao2MmHg:50,
  paco2MmHg:39.1,
  tidalVolumeL:1.474,
});

const out={
  schema:'halliwill-2003-matched-hyperpnoea-validation/v1',
  authority:'external-validation-only',
  source:{
    citation:'Halliwill JR, Morgan BJ, Charkoudian N. J Physiol. 2003;552:295-302.',
    doi:'10.1113/jphysiol.2003.050708',
    humanFinding:'Matched hyperpnoea did not reproduce the HR/MAP rise seen during isocapnic hypoxia.',
  },
  coordinateWarning:'The human study reports SaO2, not PaO2. Candidate PaO2=50 mmHg is a declared test coordinate and is not asserted to be equivalent to SaO2 85.7%.',
  hyperpnoea,
  hypoxia,
};
console.log(JSON.stringify(out,null,2));
