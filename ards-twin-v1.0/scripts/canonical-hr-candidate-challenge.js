#!/usr/bin/env node
'use strict';

const fs=require('node:fs');
const path=require('node:path');
const {createCanonicalHrCandidate}=
  require('../src/canonical_hr_candidate.js');

function protocol(name,segments){
  const c=createCanonicalHrCandidate();
  const rows=[];
  let time=0;
  for(const segment of segments){
    const steps=Math.round(segment.durationSec);
    for(let i=0;i<steps;i++){
      const s=c.step({
        timeSec:time,
        meanArterialPressureMmHg:segment.map,
        pao2MmHg:segment.pao2,
        paco2MmHg:segment.paco2,
        tidalVolumeL:segment.vt,
      });
      if(i===0||i===steps-1||i%10===0){
        rows.push({
          phase:segment.phase,
          timeSec:time,
          heartRatePerMin:s.heartRatePerMin,
          heartPeriodSec:s.heartPeriodSec,
          fAb:s.fAbSpikesPerSec,
          fAc:s.fAcSpikesPerSec,
          fAp:s.fApSpikesPerSec,
          fSh:s.fShSpikesPerSec,
          fV:s.fVSpikesPerSec,
          fSp:s.fSpSpikesPerSec,
          fSv:s.fSvSpikesPerSec,
          thetaSh:s.thetaSh,
          pao2:segment.pao2,
          paco2:segment.paco2,
          map:segment.map,
          vt:segment.vt,
        });
      }
      time+=1;
    }
  }
  return {name,rows};
}

const baseline={phase:'baseline',durationSec:120,map:95,pao2:95,paco2:40,vt:0.5};
const recovery={phase:'recovery',durationSec:120,map:95,pao2:95,paco2:40,vt:0.5};

const out={
  schema:'canonical-hr-candidate-challenge/v1',
  authority:'candidate-not-canonical',
  protocols:[
    protocol('isocapnic-hypoxia',[
      baseline,
      {phase:'hypoxia-70',durationSec:120,map:95,pao2:70,paco2:40,vt:0.5},
      {phase:'hypoxia-50',durationSec:120,map:95,pao2:50,paco2:40,vt:0.5},
      {phase:'hypoxia-40',durationSec:120,map:95,pao2:40,paco2:40,vt:0.5},
      recovery,
    ]),
    protocol('normoxic-hypercapnia',[
      baseline,
      {phase:'co2-50',durationSec:120,map:95,pao2:95,paco2:50,vt:0.5},
      {phase:'co2-60',durationSec:120,map:95,pao2:95,paco2:60,vt:0.5},
      recovery,
    ]),
    protocol('combined-respiratory-failure',[
      baseline,
      {phase:'combined-1',durationSec:120,map:90,pao2:65,paco2:50,vt:0.5},
      {phase:'combined-2',durationSec:120,map:80,pao2:50,paco2:60,vt:0.5},
      {phase:'combined-3',durationSec:120,map:65,pao2:40,paco2:75,vt:0.5},
      recovery,
    ]),
  ],
};

const dir=path.resolve(__dirname,'../physician-audit-results');
fs.mkdirSync(dir,{recursive:true});
const file=path.join(dir,'canonical-hr-candidate-challenge.json');
fs.writeFileSync(file,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
