#!/usr/bin/env node
'use strict';

const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('../src/ursino_magosso_2000_expanded_hypoxia_closed_loop.js');
const {
  standardPo2FromSaturation,
}=require('../src/severinghaus_1979_standard_odc_candidate.js');

const {SOURCE:PHYSICIAN_SOURCE}=require('../src/physician_validation_candidate.js');
const DT=0.002;
const controlParameterSet=process.argv.find(x=>x.startsWith('--control-parameter-set='))
  ?.split('=')[1]||PHYSICIAN_SOURCE.controlParameterSet;

// Human MAP is a mean, not an arbitrary cardiac-phase sample. Align the
// trapezoidal average to complete cardiac cycles (boundary precision DT).
// The same method and minimum 10 s window apply to both experimental arms.
function meanWindow(r,seconds=10){
  let previousPhase=r.snapshot().vascularState.phase;
  let aligned=false;
  for(let i=0;i<Math.ceil(3/DT);i++){
    r.step();const phase=r.snapshot().vascularState.phase;
    if(phase<previousPhase){aligned=true;break;}
    previousPhase=phase;
  }
  if(!aligned)throw new Error('No cardiac-cycle boundary for averaging');
  const start=r.snapshot().timeSec;
  const sums={hrPerMin:0,mapMmHg:0};let n=0,cycles=0;
  previousPhase=r.snapshot().vascularState.phase;
  let complete=false;
  for(let i=0;i<Math.ceil((seconds+3)/DT);i++){
    const before=r.snapshot();r.step();const after=r.snapshot();
    sums.hrPerMin+=(before.hemodynamics.heartRatePerMin+after.hemodynamics.heartRatePerMin)/2;
    sums.mapMmHg+=(before.hemodynamics.systemicArterialPressureMmHg+after.hemodynamics.systemicArterialPressureMmHg)/2;
    n++;
    const phase=after.vascularState.phase;
    if(phase<previousPhase){cycles++;if(n*DT>=seconds){complete=true;break;}}
    previousPhase=phase;
  }
  if(!complete)throw new Error('Incomplete cardiac-cycle average');
  sums.hrPerMin/=n;sums.mapMmHg/=n;
  return {...sums,averaging:{method:'complete-cardiac-cycle-aligned-trapezoid',minimumWindowSec:seconds,windowSec:n*DT,cycles,startSec:start,endSec:r.snapshot().timeSec,boundaryPrecisionSec:DT}};
}

function runCondition({pao2MmHg,paco2MmHg,tidalVolumeL}){
  const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
    dtSec:DT,
    controlParameterSet,
    pao2MmHg:100,
    paco2MmHg:40,
    tidalVolumeL:0.667,
    ventilationMode:'external-delivered-vt',
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
//
// Candidate gas coordinates:
// - keep PaCO2 at the source-family isocapnic coordinate of 40 mmHg in both
//   challenge arms; do not equate PETCO2 with PaCO2;
// - map reported SaO2 85.7% through Severinghaus 1979 Eq. 2 only as a
//   standard-curve protocol approximation, not an exact subject PaO2.
const standardCurveHypoxicPaO2MmHg=standardPo2FromSaturation(0.857);

const hyperpnoea=runCondition({
  pao2MmHg:100,
  paco2MmHg:40,
  tidalVolumeL:1.444,
});
const hypoxia=runCondition({
  pao2MmHg:standardCurveHypoxicPaO2MmHg,
  paco2MmHg:40,
  tidalVolumeL:1.474,
});

const out={
  schema:'halliwill-2003-matched-hyperpnoea-validation/v1',
  authority:'external-validation-only',
  controlParameterSet,
  productionQualification:false,
  interpretation:controlParameterSet==='ursino-magosso-2000'
    ?'Original 2000 source-family validation; qualification target unchanged.'
    :'Current parallel physician candidate: published-parameter adaptation; not full 2016 model reproduction or production qualification.',
  source:{
    citation:'Halliwill JR, Morgan BJ, Charkoudian N. J Physiol. 2003;552:295-302.',
    doi:'10.1113/jphysiol.2003.050708',
    humanFinding:'Matched hyperpnoea did not reproduce the HR/MAP rise seen during isocapnic hypoxia.',
  },
  protocolMapping:{
    reportedHypoxicSaO2Fraction:0.857,
    standardCurveHypoxicPaO2MmHg,
    standardCurveSource:'Severinghaus 1979 Eq. 2, doi:10.1152/jappl.1979.46.3.599',
    candidatePaCO2MmHg:40,
    reportedStudyPETCO2MmHg:{baseline:37.6,hyperpnoea:38.4,hypoxia:39.1},
  },
  coordinateWarning:'Hypoxic PaO2 is a Severinghaus standard-curve estimate from reported SaO2, not an exact subject PaO2. Candidate PaCO2 is held at 40 mmHg to represent isocapnia; reported PETCO2 is retained as metadata and is not equated with PaCO2.',
  hyperpnoea,
  hypoxia,
};
console.log(JSON.stringify(out,null,2));
