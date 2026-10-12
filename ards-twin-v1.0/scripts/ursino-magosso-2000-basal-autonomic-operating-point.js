#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('../src/ursino_magosso_2000_expanded_hypoxia_closed_loop.js');
const {
  peripheralChemoreceptorStatic,
  pulmonaryStretchStatic,
  cnsHypoxiaStatic,
  peripheralSympatheticFiring,
  cardiacSympatheticFiring,
  vagalFiring,
}=require('../src/ursino_magosso_autonomic_shadow.js');
const {
  P:VT_P,
}=require('../src/ursino_magosso_2000_tidal_volume_candidate.js');

const DT=0.002;

function blankMean(){
  return {
    hr:0,map:0,co:0,vt:0,pumpPower:0,
    fAb:0,fAc:0,fAp:0,thetaSp:0,thetaSh:0,fSp:0,fSh:0,fV:0,
  };
}

const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
  dtSec:DT,pao2MmHg:95,paco2MmHg:40,
  ventilationMode:'ursino-magosso-2000-spontaneous-validation',
});
r.runFor(180);

const n=Math.round(20/DT);
const mean=blankMean();
const maxAbsResidual={
  fSp:0,fSh:0,fV:0,
};

for(let i=0;i<n;i++){
  const s=r.snapshot();
  const a=s.autonomic;

  const expectedFSp=peripheralSympatheticFiring({
    fAbSpikesPerSec:a.fAbSpikesPerSec,
    fAcSpikesPerSec:a.fAcSpikesPerSec,
    fApSpikesPerSec:a.fApSpikesPerSec,
    thetaSpSpikesPerSec:a.thetaSpSpikesPerSec,
  });
  const expectedFSh=cardiacSympatheticFiring({
    fAbSpikesPerSec:a.fAbSpikesPerSec,
    fAcSpikesPerSec:a.fAcSpikesPerSec,
    thetaShSpikesPerSec:a.thetaShSpikesPerSec,
  });
  const expectedFV=vagalFiring({
    fAbSpikesPerSec:a.fAbSpikesPerSec,
    fAcSpikesPerSec:a.fAcSpikesPerSec,
    fApSpikesPerSec:a.fApSpikesPerSec,
  });

  maxAbsResidual.fSp=Math.max(
    maxAbsResidual.fSp,Math.abs(a.fSpSpikesPerSec-expectedFSp)
  );
  maxAbsResidual.fSh=Math.max(
    maxAbsResidual.fSh,Math.abs(a.fShSpikesPerSec-expectedFSh)
  );
  maxAbsResidual.fV=Math.max(
    maxAbsResidual.fV,Math.abs(a.fVSpikesPerSec-expectedFV)
  );

  mean.hr+=s.hemodynamics.heartRatePerMin;
  mean.map+=s.hemodynamics.systemicArterialPressureMmHg;
  mean.co+=s.hemodynamics.leftVentricleOutflowMlPerSec;
  mean.vt+=s.ventilation.activeTidalVolumeL;
  mean.pumpPower+=s.averagePumpPowerMmHgMlPerSec;
  mean.fAb+=a.fAbSpikesPerSec;
  mean.fAc+=a.fAcSpikesPerSec;
  mean.fAp+=a.fApSpikesPerSec;
  mean.thetaSp+=a.thetaSpSpikesPerSec;
  mean.thetaSh+=a.thetaShSpikesPerSec;
  mean.fSp+=a.fSpSpikesPerSec;
  mean.fSh+=a.fShSpikesPerSec;
  mean.fV+=a.fVSpikesPerSec;
  r.step();
}
for(const k of Object.keys(mean)) mean[k]/=n;

const basalStatic={
  fAc:peripheralChemoreceptorStatic(95),
  fAp:pulmonaryStretchStatic(VT_P.basalTidalVolumeL),
  thetaSp:cnsHypoxiaStatic(95,'sp'),
  thetaSh:cnsHypoxiaStatic(95,'sh'),
};

const out={
  schema:'ursino-magosso-2000-basal-autonomic-operating-point/v2',
  authority:'source-reproduction-diagnostic-only',
  method:{
    dtSec:DT,settleSec:180,meanWindowSec:20,
    comparison:'instantaneous source-equation residuals; no nonlinear mean-field substitution',
  },
  publishedBasal:{
    tidalVolumeL:VT_P.basalTidalVolumeL,
    chemoreceptorSpikesPerSec:VT_P.basalChemoreceptorSpikesPerSec,
  },
  basalStatic,
  mean,
  maxAbsInstantaneousResidual:maxAbsResidual,
  basalCoordinateResidual:{
    fAc:mean.fAc-basalStatic.fAc,
    fAp:mean.fAp-basalStatic.fAp,
    thetaSp:mean.thetaSp-basalStatic.thetaSp,
    thetaSh:mean.thetaSh-basalStatic.thetaSh,
    vt:mean.vt-VT_P.basalTidalVolumeL,
  },
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-magosso-2000-basal-autonomic-operating-point.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
