'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {
  createHumMod2013BaroChemoreflexSaNodeCandidate,
}=require('../src/hummod_2013_baro_chemoreflex_sa_node_candidate.js');

const csv=fs.readFileSync(
  path.join(__dirname,'fixtures','hr-reflex-continuity-extremis-trace.csv'),
  'utf8'
).trim().split(/\r?\n/);
const header=csv[0].split(',');
const rows=csv.slice(1).map(line=>{
  const cells=line.split(',');
  const row={};
  header.forEach((k,i)=>{row[k]=cells[i];});
  return row;
}).filter(row=>row.cardiacArrest!=='True');

const c=createHumMod2013BaroChemoreflexSaNodeCandidate({
  ecfvMl:15000,
  initialArterialPh:7.44,
  initialCarotidSinusPressureMmHg:87,
});

const samples=[];
let maxIntrinsic={tSec:0,hrPerMin:-Infinity};
let maxEffective={tSec:0,hrPerMin:-Infinity};

for(const row of rows){
  const tSec=Number(row.tSec);
  const map=Number(row.mapMmHg);
  const pao2=Number(row.pao2MmHg);
  const pH=Number(row.pH);
  const reserve=Number(row.chronotropicReserveMultiplier);
  let state=null;
  for(let i=0;i<100;i++){
    state=c.step({
      dtSec:0.1,
      arterialPo2MmHg:pao2,
      arterialPh:pH,
      carotidSinusPressureMmHg:map,
    });
  }
  const intrinsic=state.heartRatePerMin;
  const effective=intrinsic*reserve;
  if(intrinsic>maxIntrinsic.hrPerMin) maxIntrinsic={tSec,hrPerMin:intrinsic};
  if(effective>maxEffective.hrPerMin) maxEffective={tSec,hrPerMin:effective};
  if([100,200,300,400,500,600,700,790].includes(tSec)){
    samples.push({
      tSec,
      intrinsicHeartRatePerMin:intrinsic,
      reserve,
      effectiveHeartRatePerMin:effective,
      mapMmHg:map,
      pao2MmHg:pao2,
      paco2MmHg:Number(row.paco2MmHg),
      pH,
    });
  }
}

const byTime=Object.fromEntries(samples.map(s=>[s.tSec,s]));
assert(byTime[200].effectiveHeartRatePerMin>byTime[100].effectiveHeartRatePerMin,
  'tachycardic response should develop as gas stress worsens');
assert(byTime[300].effectiveHeartRatePerMin>160,
  'current extremis trace should produce marked tachycardia before terminal reserve loss');
assert(byTime[500].effectiveHeartRatePerMin>byTime[300].effectiveHeartRatePerMin,
  'tachycardia should continue through the compensated phase');
assert(byTime[700].effectiveHeartRatePerMin<maxEffective.hrPerMin,
  'effective HR should fall after chronotropic reserve depletion begins');
assert(byTime[790].effectiveHeartRatePerMin<100,
  'terminal reserve exhaustion should overcome the intrinsic tachycardic drive');

function near(a,b,tol=1e-9){
  assert(Math.abs(a-b)<=tol*Math.max(1,Math.abs(a),Math.abs(b)),a+' not near '+b);
}

// Independent replay regression values from the 2026-11-04 Vent trace.
// These verify deterministic port behavior; they are not fitted clinical targets.
near(byTime[200].intrinsicHeartRatePerMin,142.7637056918515);
near(byTime[300].intrinsicHeartRatePerMin,175.35755435906964);
near(byTime[600].intrinsicHeartRatePerMin,185.67771321409757);
near(byTime[700].intrinsicHeartRatePerMin,195);
near(byTime[790].intrinsicHeartRatePerMin,195);

console.log(JSON.stringify({samples,maxIntrinsic,maxEffective},null,2));
console.log('ok - current v1.5 extremis trace develops tachycardia then terminal reserve collapse');
