#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createUrsinoMagosso2000ExpandedHypoxiaClosedLoop,
}=require('../src/ursino_magosso_2000_expanded_hypoxia_closed_loop.js');
const {
  LOCAL,
}=require('../src/ursino_magosso_2000_local_o2_candidate.js');

const DT=0.002;

function row(s){
  const l=s.localO2;
  const x=l.localState.muscle;
  const rmpNormal=l.inputs.muscleNormalResistanceMmHgSecPerMl;
  const expectedRmp=rmpNormal/(1+x);
  return {
    arterialO2MlPerMl:l.arterialO2MlPerMl,
    muscleVenousO2MlPerMl:l.venousO2MlPerMl.muscle,
    muscleNormalVenousO2MlPerMl:LOCAL.muscle.normalVenousO2MlPerMl,
    muscleTarget:l.target.muscle,
    muscleLocalState:x,
    muscleReflexNormalResistance:rmpNormal,
    muscleFinalResistance:s.vascularEffectors.Rmp,
    expectedMuscleFinalResistance:expectedRmp,
    eq42Residual:s.vascularEffectors.Rmp-expectedRmp,
    muscleFlowMlPerSec:l.inputs.muscleFlowMlPerSec,
    map:s.hemodynamics.systemicArterialPressureMmHg,
    hr:s.hemodynamics.heartRatePerMin,
    co:s.hemodynamics.leftVentricleOutflowMlPerSec,
  };
}

function mean(rows){
  const keys=Object.keys(rows[0]),out={};
  for(const k of keys) out[k]=rows.reduce((a,r)=>a+r[k],0)/rows.length;
  return out;
}

const r=createUrsinoMagosso2000ExpandedHypoxiaClosedLoop({
  dtSec:DT,pao2MmHg:95,paco2MmHg:40,
  ventilationMode:'ursino-magosso-2000-spontaneous-validation',
});

r.runFor(120);

const baselineRows=[];
for(let i=0;i<Math.round(10/DT);i++){
  baselineRows.push(row(r.snapshot()));
  r.step();
}
const baseline=mean(baselineRows);

const seconds=[];
const nsec=Math.round(1/DT);
for(let sec=0;sec<20;sec++){
  const rows=[];
  let pao2Sum=0;
  for(let i=0;i<nsec;i++){
    const t=sec+i*DT;
    const pao2=t<10?95+(28-95)*(t/10):28;
    r.setEnvironment({pao2MmHg:pao2,paco2MmHg:40});
    rows.push(row(r.snapshot()));
    pao2Sum+=pao2;
    r.step();
  }
  seconds.push({
    startSec:sec,endSec:sec+1,pao2MmHg:pao2Sum/nsec,
    ...mean(rows),
  });
}

const out={
  schema:'ursino-magosso-2000-muscle-o2-drive-trace/v1',
  authority:'diagnostic-source-equation-audit-only',
  source:{
    doi:'10.1152/ajpheart.2000.279.1.H149',
    equations:[41,42,43,44,45],
  },
  baseline,
  seconds,
  maxAbsEq42Residual:Math.max(
    Math.abs(baseline.eq42Residual),
    ...seconds.map(x=>Math.abs(x.eq42Residual))
  ),
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-magosso-2000-muscle-o2-drive-trace.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
