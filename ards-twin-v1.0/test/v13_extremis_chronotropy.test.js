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
    arrest:Boolean(d.cardiacArrest),
  });
  if(d.cardiacArrest)break;
}

const preArrest=rows.filter(r=>!r.arrest);
assert(preArrest.length>0,'extremis trajectory must contain pre-arrest samples');

for(const r of preArrest){
  assert(Math.abs((r.boost||0))<1e-12,
    'source-aligned mode must not apply empirical HR boost');
  assert(Math.abs(r.hr-r.sourceHr)<1e-9,
    'effective HR must equal HumMod SA-node rate before arrest');
}

const first=preArrest[0];
const peak=preArrest.reduce((a,b)=>b.hr>a.hr?b:a,preArrest[0]);
assert(peak.hr>first.hr,
  'source HumMod autonomic response should increase HR before brain failure');

const failedBrain=preArrest.find(r=>r.brainFunction<0.1);
assert(failedBrain,'trajectory must cross native Brain-Function < 0.1 branch');
assert(Math.abs(failedBrain.sympsHz-1.5)<1e-9,
  'native brain-failure branch must reset SympsCNS firing to 1.5 Hz');
assert(Math.abs(failedBrain.hr-72)<0.2,
  'native SA-node rate should return near the HumMod baseline after brain failure');

assert(Number.isFinite(failedBrain.brainPo2) && failedBrain.brainPo2<20,
  'Brain-Function failure must occur with severe source-aligned brain hypoxia');

const last=rows[rows.length-1];
assert(last.arrest,'extremis scenario should still reach terminal arrest');
assert(last.hr===0,'displayed HR should be zero after terminal arrest');

console.log('ok - v1.3 extremis follows source HR with native brain-hypoxia failure branch');
console.log(JSON.stringify({first,peak,failedBrain,last},null,2));
