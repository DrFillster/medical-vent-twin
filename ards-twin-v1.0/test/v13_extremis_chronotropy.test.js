'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function assert(cond,msg){if(!cond)throw new Error(msg||'assertion failed');}
const enginePath=path.resolve(__dirname,'../web/engine.js');
const source=fs.readFileSync(enginePath,'utf8');
const context={console,setTimeout,clearTimeout,Math,JSON,Object,Array,Number,String,Boolean,Date,Error,TypeError,RangeError};
vm.createContext(context);
vm.runInContext(source,context,{filename:enginePath});
const VENT=context.VENT;
assert(VENT,'VENT bundle missing');

const s=VENT.createBerlinLiveHumModSession({
  caseId:'berlin-moderate-moderate-aspiration',
  ventilation:{mode:'VC_AC',fio2:0.60,peep:8,rr:20,vtL:0.42,inspiratoryFlowLps:0.70,inspiratoryPauseSec:0.20},
  initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
  dt:0.002,mechanicalWarmupSec:3,
  heartRateControlMode:'hummod2013-baro-chemo',
});
s.initialize();
s.requestVentilationChange({mode:'VC_AC',fio2:0.20,peep:8,rr:4,vtL:0.10,inspiratoryFlowLps:0.20,inspiratoryPauseSec:0});

const rows=[];
for(let elapsed=0;elapsed<1200;elapsed+=10){
  const x=s.runFor(10);
  const h=x.systemic.hemodynamics,d=x.systemic.decompensation,g=x.systemic.gasExchange;
  rows.push({
    t:x.timeSec,
    hr:h.heartRatePerMin,
    sourceHr:h.sourceSaNodeHeartRatePerMin,
    selectedHr:h.selectedHeartRatePerMin,
    candidateHr:h.hummod2013HeartRateState?.heartRatePerMin ?? null,
    boost:h.empiricalChronotropicBoostPerMin,
    brainPo2:h.brainTissuePo2MmHg,
    brainFunction:h.brainFunctionEffect,
    sympsHz:h.sympatheticFiringHz,
    vagusHz:h.vagalFiringHz,
    map:h.meanArterialPressureMmHg,
    co:h.cardiacOutputMlPerMin,
    pH:g.pH,
    paco2:g.paco2MmHg,
    pao2:g.pao2MmHg,
    reserve:h.chronotropicReserveMultiplier,
    nextReserve:d.chronotropicReserveMultiplier,
    arrest:Boolean(d.cardiacArrest),
  });
  if(d.cardiacArrest)break;
}

const preArrest=rows.filter(r=>!r.arrest);
assert(preArrest.length>0,'extremis trajectory must contain pre-arrest samples');

for(const r of preArrest){
  assert(Math.abs((r.boost||0))<1e-12,
    'source-aligned mode must not apply empirical HR boost');
  assert(Number.isFinite(r.reserve) && r.reserve>=0 && r.reserve<=1,
    'chronotropic reserve must remain a bounded fraction');
  assert(Number.isFinite(r.selectedHr),
    'selected intrinsic HR must be finite');
  assert(Math.abs(r.hr-r.selectedHr*r.reserve)<1e-6,
    'effective HR must equal selected intrinsic rate times chronotropic reserve');
}

const fullReserve=preArrest.filter(r=>Math.abs(r.reserve-1)<1e-12);
assert(fullReserve.length>0,
  'extremis trajectory must contain a compensated full-reserve phase');
for(const r of fullReserve){
  assert(Math.abs(r.hr-r.selectedHr)<1e-6,
    'full reserve must preserve the selected intrinsic HR exactly');
}

const reserveLoss=preArrest.find(r=>r.reserve<0.99);
assert(reserveLoss,
  'extremis trajectory must enter pre-arrest chronotropic reserve loss');
assert(reserveLoss.hr<reserveLoss.selectedHr,
  'loss of chronotropic reserve must reduce effective HR below selected intrinsic rate');

const first=preArrest[0];
const peak=preArrest.reduce((a,b)=>b.hr>a.hr?b:a,preArrest[0]);
assert(peak.hr>first.hr,
  'source HumMod autonomic response should increase HR before brain failure');

const failedBrain=preArrest.find(r=>r.brainFunction<0.1);
assert(failedBrain,'trajectory must cross native Brain-Function < 0.1 state');
assert(Number.isFinite(failedBrain.sympsHz) && failedBrain.sympsHz>1.5,
  'Brain-Function failure must not reset active sympathetic drive to baseline');
assert(Number.isFinite(failedBrain.candidateHr),
  'HumMod 2012/2013 candidate HR must remain available through brain failure');
assert(failedBrain.selectedHr>failedBrain.sourceHr,
  'selected baro-chemoreflex HR must exceed the legacy source SA-node rate during severe gas stress');
assert(failedBrain.hr<=failedBrain.selectedHr+1e-6,
  'effective HR must not exceed selected intrinsic rate');

assert(Number.isFinite(failedBrain.brainPo2) && failedBrain.brainPo2<20,
  'Brain-Function failure must occur with severe source-aligned brain hypoxia');

const last=rows[rows.length-1];
assert(last.arrest,'extremis scenario should still reach terminal arrest');
assert(last.hr===0,'displayed HR should be zero after terminal arrest');

console.log('ok - v1.5 extremis preserves tachycardic baro-chemoreflex drive and applies terminal chronotropic reserve');
console.log(JSON.stringify({first,peak,failedBrain,last},null,2));
