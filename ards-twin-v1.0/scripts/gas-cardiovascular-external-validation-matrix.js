#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createGasCardiovascularClosedLoopCandidate,
}=require('../src/ursino_magosso_gas_closed_loop_candidate.js');

const DT=0.002;

function meanWindow(r,seconds=10){
  const n=Math.round(seconds/DT);
  const sums={
    hr:0,map:0,co:0,emaxLv:0,rsp:0,rep:0,vusv:0,vuev:0,
  };
  for(let i=0;i<n;i++){
    const s=r.snapshot();
    sums.hr+=s.hemodynamics.heartRatePerMin;
    sums.map+=s.hemodynamics.systemicArterialPressureMmHg;
    sums.co+=s.hemodynamics.leftVentricleOutflowMlPerSec;
    sums.emaxLv+=s.hemodynamics.EmaxLvMmHgPerMl;
    sums.rsp+=s.hemodynamics.splanchnicResistanceMmHgSecPerMl;
    sums.rep+=s.hemodynamics.extrasplanchnicResistanceMmHgSecPerMl;
    sums.vusv+=s.hemodynamics.splanchnicVenousUnstressedVolumeMl;
    sums.vuev+=s.hemodynamics.extrasplanchnicVenousUnstressedVolumeMl;
    r.step();
  }
  for(const k of Object.keys(sums)) sums[k]/=n;
  return sums;
}

function runCase({pao2MmHg,paco2MmHg,tidalVolumeL=0.5}){
  const r=createGasCardiovascularClosedLoopCandidate({
    dtSec:DT,pao2MmHg:100,paco2MmHg:40,tidalVolumeL,
  });
  r.runFor(120);
  const baseline=meanWindow(r,10);
  r.setEnvironment({pao2MmHg,paco2MmHg,tidalVolumeL});
  r.runFor(120);
  const response=meanWindow(r,10);
  const pct={};
  for(const k of Object.keys(baseline)){
    pct[k]=100*(response[k]-baseline[k])/baseline[k];
  }
  return {pao2MmHg,paco2MmHg,tidalVolumeL,baseline,response,pct};
}

const cases=[
  {name:'normoxic_mild_hypercapnia',pao2MmHg:100,paco2MmHg:45},
  {name:'normoxic_hypercapnia',pao2MmHg:100,paco2MmHg:50},
  {name:'normoxic_severe_hypercapnia',pao2MmHg:100,paco2MmHg:60},
  {name:'mild_isocapnic_hypoxia',pao2MmHg:60,paco2MmHg:40},
  {name:'moderate_isocapnic_hypoxia',pao2MmHg:50,paco2MmHg:40},
  {name:'severe_isocapnic_hypoxia',pao2MmHg:40,paco2MmHg:40},
  {name:'combined_50_50',pao2MmHg:50,paco2MmHg:50},
  {name:'combined_50_60',pao2MmHg:50,paco2MmHg:60},
];

const results={};
for(const c of cases) results[c.name]=runCase(c);

const out={
  schema:'gas-cardiovascular-external-validation-matrix/v1',
  authority:'candidate-not-canonical',
  coordinateWarning:'Inputs are arterial PaO2/PaCO2. Do not directly equate these values with SaO2 or end-tidal gas targets from human protocols.',
  humanQualitativeTargets:{
    isocapnicHypoxia:'substantial HR increase with sympathetic activation; MAP may rise modestly or remain near baseline depending on protocol',
    mildHypercapnia:'small HR increase with little or no MAP/MSNA change in mild hyperoxic hypercapnia',
    combinedGasStress:'hypoxia lowers the CO2 threshold for sympathetic activation versus hyperoxic hypercapnia',
  },
  results,
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'gas-cardiovascular-external-validation-matrix.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
