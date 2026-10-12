#!/usr/bin/env node
'use strict';

const {
  createGasCardiovascularClosedLoopCandidate,
}=require('../src/ursino_magosso_gas_closed_loop_candidate.js');
const {
  standardPo2FromSaturation,
}=require('../src/severinghaus_1979_standard_odc_candidate.js');

const DT=0.002;

function meanWindow(r,seconds=10){
  const n=Math.round(seconds/DT);
  const sums={hrPerMin:0,mapMmHg:0,vtL:0};
  for(let i=0;i<n;i++){
    const s=r.snapshot();
    sums.hrPerMin+=s.hemodynamics.heartRatePerMin;
    sums.mapMmHg+=s.hemodynamics.systemicArterialPressureMmHg;
    sums.vtL+=s.ventilation.activeTidalVolumeL;
    r.step();
  }
  for(const k of Object.keys(sums)) sums[k]/=n;
  return sums;
}

const baselinePaO2MmHg=standardPo2FromSaturation(0.97);
const hypoxicPaO2MmHg=standardPo2FromSaturation(0.84);

const r=createGasCardiovascularClosedLoopCandidate({
  dtSec:DT,
  pao2MmHg:baselinePaO2MmHg,
  paco2MmHg:40,
  ventilationMode:'ursino-magosso-2000-spontaneous-validation',
});

r.runFor(120);
const baseline=meanWindow(r,10);

r.setEnvironment({
  pao2MmHg:hypoxicPaO2MmHg,
  paco2MmHg:40,
});
r.runFor(180);
const hypoxia=meanWindow(r,10);

const out={
  schema:'houssiere-2005-isocapnic-hypoxia-validation/v1',
  authority:'external-validation-only',
  source:{
    citation:'Houssiere A et al. Am J Physiol Heart Circ Physiol. 2005;288:H1724-H1731.',
    doi:'10.1152/ajpheart.01043.2004',
    reported:{
      baselineSaO2Fraction:0.97,
      hypoxicSaO2Fraction:0.84,
      baselineHrPerMin:64,
      hypoxicHrPerMin:83,
      baselineMapMmHg:83,
      hypoxicMapMmHg:86,
      endTidalCo2MmHgApproximately:38,
      hypoxiaDurationSec:180,
    },
  },
  protocolMapping:{
    baselinePaO2MmHg,
    hypoxicPaO2MmHg,
    mapping:'Severinghaus 1979 standard ODC Eq. 2',
    candidatePaCO2MmHg:40,
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
  },
  coordinateWarning:'Study SaO2 is mapped through the Severinghaus standard curve and is not an exact subject PaO2. Study PETCO2 is retained as metadata and is not equated with arterial PaCO2.',
  candidate:{baseline,hypoxia},
  qualitativeComparison:{
    hrDirection:hypoxia.hrPerMin>baseline.hrPerMin?'increase':'not-increase',
    mapDirection:hypoxia.mapMmHg>baseline.mapMmHg?'increase':'not-increase',
    status:'validation-only-not-calibration',
  },
};

console.log(JSON.stringify(out,null,2));
