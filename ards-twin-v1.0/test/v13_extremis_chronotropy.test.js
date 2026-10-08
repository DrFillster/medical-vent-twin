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
    exposure:h.chronotropicExposureSec,
    map:h.meanArterialPressureMmHg,
    co:h.cardiacOutputMlPerMin,
    pH:g.pH,
    paco2:g.paco2MmHg,
    arrest:Boolean(d.cardiacArrest),
  });
  if(d.cardiacArrest)break;
}
const preArrest=rows.filter(r=>!r.arrest);
const peak=preArrest.reduce((a,b)=>b.hr>a.hr?b:a,preArrest[0]);
assert(peak.hr>=105 && peak.hr<=130,'extremis HR peak outside v1.3 plausibility band: '+peak.hr);
assert(peak.exposure>=90 && peak.exposure<=240,'HR peak timing outside early hypercapnic phase: '+peak.exposure);
assert(peak.sourceHr<peak.hr,'empirical bridge must remain separable from source HumMod HR');
const late=preArrest.find(r=>r.exposure>=600);
if(late) assert(late.hr<peak.hr,'HR should decline after the early tachycardic phase');
const last=rows[rows.length-1];
assert(last.arrest,'extremis scenario should still reach terminal arrest');
console.log(JSON.stringify({peak,last},null,2));
