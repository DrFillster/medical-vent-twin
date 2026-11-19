'use strict';

const fs=require('fs');
const {Simulation,PcAcController}=require('../../ards-twin-v1.0/src/simulation.js');
const {mechanicsParams}=require('./fit_controlled_mechanics.js');

const INPUT='/Users/philipbernard/mimic-data/derived/ps_etco2_effort_targets.json';
const OUT='/Users/philipbernard/mimic-data/derived/ps_compliance_stiffness_map.json';
const STIFFNESS=[0.4,0.5,0.6,0.75,1.0,1.25,1.5,2.0];

function modelCompliance(peep,stiffnessScale){
  const sim=new Simulation({
    params:mechanicsParams(stiffnessScale,1.0),
    controller:new PcAcController({
      fio2:0.4,peep,rr:10,pinsp:10,inspiratoryTime:1.0,inspiratoryPause:0
    }),
    dt:0.002,
    trackGas:false,
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
  });
  sim.runFor(30);
  const breaths=sim.metrics().filter(x=>Number.isFinite(x.VtInspired)&&x.VtInspired>0);
  const b=breaths[breaths.length-1];
  return b ? (b.VtInspired*1000/10) : null;
}

const events=JSON.parse(fs.readFileSync(INPUT,'utf8'));
const out=[];
for(const e of events){
  if(!(typeof e.compliance_doc==='number'&&Number.isFinite(e.compliance_doc))) continue;
  const candidates=STIFFNESS.map(s=>({
    stiffnessScale:s,
    modelCompliance:modelCompliance(e.peep,s)
  })).filter(x=>Number.isFinite(x.modelCompliance));
  for(const c of candidates){
    c.absError=Math.abs(c.modelCompliance-e.compliance_doc);
    c.relativeError=c.absError/Math.max(5,e.compliance_doc);
  }
  candidates.sort((a,b)=>a.absError-b.absError);
  out.push({
    event_id:e.event_id,
    targetCompliance:e.compliance_doc,
    peep:e.peep,
    best:candidates[0]||null,
    candidates
  });
  console.log(JSON.stringify({
    event_id:e.event_id,
    targetCompliance:e.compliance_doc,
    best:candidates[0]||null,
    modelRange:candidates.length?[
      Math.min(...candidates.map(x=>x.modelCompliance)),
      Math.max(...candidates.map(x=>x.modelCompliance))
    ]:null
  }));
}
fs.writeFileSync(OUT,JSON.stringify(out,null,2)+'\n');
