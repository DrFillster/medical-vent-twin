#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {
  createUrsinoMagosso2000SplitEffectorsRuntime,
}=require('../src/ursino_magosso_2000_split_effectors_runtime.js');

const DT=0.1;
const r=createUrsinoMagosso2000SplitEffectorsRuntime({
  initialVascularSympatheticSpikesPerSec:6,
  initialCardiacSympatheticSpikesPerSec:6,
  initialCardiacVagalSpikesPerSec:4,
});

function row(label){
  const s=r.snapshot();
  return {
    label,
    timeSec:s.timeSec,
    Rsp:s.absolute.Rsp,
    Rep:s.absolute.Rep,
    RmpNormal:s.absolute.RmpNormal,
    Vusv:s.absolute.Vusv,
    Vuev:s.absolute.Vuev,
    Vumv:s.absolute.Vumv,
  };
}
function stepTo(targetSec){
  while(r.snapshot().timeSec+1e-9<targetSec){
    r.step({
      dtSec:DT,
      vascularSympatheticSpikesPerSec:12,
      cardiacSympatheticSpikesPerSec:6,
      cardiacVagalSpikesPerSec:4,
    });
  }
}

const rows=[row('baseline')];
for(const t of [1.9,2.0,2.1,4.9,5.0,5.1]){
  stepTo(t);
  rows.push(row(String(t)));
}

const out={
  schema:'ursino-magosso-2000-effector-delay-audit/v1',
  authority:'candidate-not-canonical',
  sourceDelaysSec:{resistance:2,venousUnstressedVolume:5},
  perturbation:{
    vascularSympatheticSpikesPerSec:{baseline:6,challenge:12},
    cardiacSympatheticSpikesPerSec:6,
    cardiacVagalSpikesPerSec:4,
  },
  rows,
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(
  path.join(dir,'ursino-magosso-2000-effector-delay-audit.json'),
  JSON.stringify(out,null,2)+'\n'
);
console.log(JSON.stringify(out,null,2));
