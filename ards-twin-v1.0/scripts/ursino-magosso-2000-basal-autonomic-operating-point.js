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
  sourceTargets,
}=require('../src/ursino_magosso_2000_split_effectors_candidate.js');
const {
  P:VT_P,
}=require('../src/ursino_magosso_2000_tidal_volume_candidate.js');

const DT=0.002;

function blank(){
  return {
    hr:0,map:0,co:0,vt:0,pumpPower:0,
    fAb:0,fAc:0,fAp:0,thetaSp:0,thetaSh:0,
    fSp:0,fSh:0,fV:0,
    EmaxLv:0,EmaxRv:0,Rsp:0,Rep:0,Rmp:0,
    Vusv:0,Vuev:0,Vumv:0,heartPeriod:0,
  };
}

function add(x,s){
  const a=s.autonomic,e=s.vascularEffectors;
  x.hr+=s.hemodynamics.heartRatePerMin;
  x.map+=s.hemodynamics.systemicArterialPressureMmHg;
  x.co+=s.hemodynamics.leftVentricleOutflowMlPerSec;
  x.vt+=s.ventilation.activeTidalVolumeL;
  x.pumpPower+=s.averagePumpPowerMmHgMlPerSec;
  x.fAb+=a.fAbSpikesPerSec;
  x.fAc+=a.fAcSpikesPerSec;
  x.fAp+=a.fApSpikesPerSec;
  x.thetaSp+=a.thetaSpSpikesPerSec;
  x.thetaSh+=a.thetaShSpikesPerSec;
  x.fSp+=a.fSpSpikesPerSec;
  x.fSh+=a.fShSpikesPerSec;
  x.fV+=a.fVSpikesPerSec;
  x.EmaxLv+=e.EmaxLv;
  x.EmaxRv+=e.EmaxRv;
  x.Rsp+=e.Rsp;
  x.Rep+=e.Rep;
  x.Rmp+=e.Rmp;
  x.Vusv+=e.Vusv;
  x.Vuev+=e.Vuev;
  x.Vumv+=e.Vumv;
  x.heartPeriod+=e.heartPeriodSec;
}

function mean(r,seconds){
  const n=Math.round(seconds/DT),sum=blank();
  for(let i=0;i<n;i++){
    add(sum,r.snapshot());
    r.step();
  }
  for(const k of Object.keys(sum)) sum[k]/=n;
  return sum;
}

const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
  dtSec:DT,pao2MmHg:95,paco2MmHg:40,
  ventilationMode:'ursino-magosso-2000-spontaneous-validation',
});
r.runFor(180);
const settled=mean(r,20);

const expectedAfferents={
  fAc:peripheralChemoreceptorStatic(95),
  fApAtBasalVT:pulmonaryStretchStatic(VT_P.basalTidalVolumeL),
  thetaSp:cnsHypoxiaStatic(95,'sp'),
  thetaSh:cnsHypoxiaStatic(95,'sh'),
};

const expectedAutonomicAtSettledFAb={
  fSp:peripheralSympatheticFiring({
    fAbSpikesPerSec:settled.fAb,
    fAcSpikesPerSec:expectedAfferents.fAc,
    fApSpikesPerSec:expectedAfferents.fApAtBasalVT,
    thetaSpSpikesPerSec:expectedAfferents.thetaSp,
  }),
  fSh:cardiacSympatheticFiring({
    fAbSpikesPerSec:settled.fAb,
    fAcSpikesPerSec:expectedAfferents.fAc,
    thetaShSpikesPerSec:expectedAfferents.thetaSh,
  }),
  fV:vagalFiring({
    fAbSpikesPerSec:settled.fAb,
    fAcSpikesPerSec:expectedAfferents.fAc,
    fApSpikesPerSec:expectedAfferents.fApAtBasalVT,
  }),
};

const expectedEffectors=sourceTargets({
  vascularSympatheticSpikesPerSec:settled.fSp,
  cardiacSympatheticSpikesPerSec:settled.fSh,
  cardiacVagalSpikesPerSec:settled.fV,
}).absolute;

const out={
  schema:'ursino-magosso-2000-basal-autonomic-operating-point/v1',
  authority:'source-reproduction-diagnostic-only',
  method:{
    dtSec:DT,settleSec:180,meanWindowSec:20,
    pao2MmHg:95,paco2MmHg:40,
    ventilationMode:'ursino-magosso-2000-spontaneous-validation',
  },
  publishedBasal:{
    tidalVolumeL:VT_P.basalTidalVolumeL,
    chemoreceptorSpikesPerSec:VT_P.basalChemoreceptorSpikesPerSec,
  },
  settled,
  expectedAfferents,
  expectedAutonomicAtSettledFAb,
  expectedEffectorsAtSettledFiring:expectedEffectors,
  residuals:{
    fAc:settled.fAc-expectedAfferents.fAc,
    fAp:settled.fAp-expectedAfferents.fApAtBasalVT,
    thetaSp:settled.thetaSp-expectedAfferents.thetaSp,
    thetaSh:settled.thetaSh-expectedAfferents.thetaSh,
    fSp:settled.fSp-expectedAutonomicAtSettledFAb.fSp,
    fSh:settled.fSh-expectedAutonomicAtSettledFAb.fSh,
    fV:settled.fV-expectedAutonomicAtSettledFAb.fV,
    heartPeriod:settled.heartPeriod-expectedEffectors.heartPeriodSec,
    EmaxLv:settled.EmaxLv-expectedEffectors.EmaxLv,
    EmaxRv:settled.EmaxRv-expectedEffectors.EmaxRv,
    Rsp:settled.Rsp-expectedEffectors.Rsp,
    Rep:settled.Rep-expectedEffectors.Rep,
    Vusv:settled.Vusv-expectedEffectors.Vusv,
    Vuev:settled.Vuev-expectedEffectors.Vuev,
    Vumv:settled.Vumv-expectedEffectors.Vumv,
  },
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-magosso-2000-basal-autonomic-operating-point.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
