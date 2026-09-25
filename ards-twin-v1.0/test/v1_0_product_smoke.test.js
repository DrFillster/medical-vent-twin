'use strict';

const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const engine=fs.readFileSync(path.join(root,'web/engine.js'),'utf8');
const workerSource=fs.readFileSync(path.join(root,'web/clinical-worker.js'),'utf8');

let posted=[];
const sandbox={
  console,
  importScripts(){},
  self:{postMessage(msg){posted.push(msg);}},
};
vm.createContext(sandbox);
vm.runInContext(engine,sandbox,{filename:'engine.js'});
vm.runInContext(workerSource,sandbox,{filename:'clinical-worker.js'});

function send(data){
  posted=[];
  sandbox.self.onmessage({data});
  const err=posted.find(x=>x.type==='error');
  if(err) throw new Error(err.message);
  return posted;
}
const payload={
  caseId:'berlin-moderate-moderate-aspiration',
  ventilation:{mode:'VC_AC',fio2:0.60,peep:8,rr:20,vtL:0.42,inspiratoryFlowLps:0.70,inspiratoryPauseSec:0.20},
  initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
  dt:0.002,
};
let out=send({type:'initialize',provider:'live-reduced-hummod',payload});
if(out[0]?.type!=='initialized') throw new Error('live patient did not initialize');
const t0=out[0].snapshot.timeSec;
out=send({type:'runFor',seconds:1});
if(out[0]?.type!=='snapshot'||!(out[0].snapshot.timeSec>t0)) throw new Error('live patient did not advance');
out=send({type:'setPEEP',valueCmH2O:10});
if(out[0]?.snapshot?.ventilator?.peepCmH2O!==10) throw new Error('PEEP did not persist');
for(const v of [
  out[0].snapshot.systemic?.gasExchange?.pao2MmHg,
  out[0].snapshot.systemic?.gasExchange?.paco2MmHg,
  out[0].snapshot.systemic?.gasExchange?.pH,
  out[0].snapshot.systemic?.hemodynamics?.meanArterialPressureMmHg,
  out[0].snapshot.systemic?.hemodynamics?.cardiacOutputMlPerMin,
]) if(typeof v!=='number'||!Number.isFinite(v)) throw new Error('non-finite clinical output');
console.log('ok - v1.0 product smoke initializes, advances, persists PEEP, and returns finite cardiopulmonary outputs');
console.log(JSON.stringify({schema:'vent-v1.0-product-smoke/v1',passed:true,initialTimeSec:t0,finalTimeSec:out[0].snapshot.timeSec,peepCmH2O:10},null,2));
