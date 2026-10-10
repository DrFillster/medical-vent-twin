#!/usr/bin/env node
'use strict';

/**
 * v1.5 oxygen-transport mechanism separation harness.
 *
 * The harness is diagnostic. It does not establish universal DO2crit values.
 * It separates hypoxemic, low-flow, and low-O2-capacity mechanisms so the
 * model can be compared by mechanism rather than by one global threshold.
 */

const fs=require('node:fs');
const path=require('node:path');
const {
  createBerlinLiveHumModSession,
}=require('../src/clinical_twin_live_hummod_session.js');

function finiteOrNull(v){
  return typeof v==='number'&&Number.isFinite(v)?v:null;
}

function collect(snapshot,scenarioId){
  const s=snapshot.systemic||{};
  const g=s.gasExchange||{};
  const h=s.hemodynamics||{};
  const d=s.decompensation||{};
  return {
    scenarioId,
    timeSec:finiteOrNull(snapshot.timeSec),
    pao2MmHg:finiteOrNull(g.pao2MmHg),
    paco2MmHg:finiteOrNull(g.paco2MmHg),
    arterialSaturationFraction:finiteOrNull(g.sao2Fraction),
    cardiacOutputMlPerMin:finiteOrNull(h.cardiacOutputMlPerMin),
    oxygenDeliveryMlPerMin:finiteOrNull(g.oxygenDeliveryMlPerMin),
    convectiveOxygenDeliveryMlPerMin:finiteOrNull(g.convectiveOxygenDeliveryMlPerMin),
    requestedTissueO2UseMlPerMin:finiteOrNull(g.requestedTissueO2UseMlPerMin),
    actualTissueO2UseMlPerMin:finiteOrNull(g.actualTissueO2UseMlPerMin),
    oxygenSupplyDeficitMlPerMin:finiteOrNull(g.oxygenSupplyDeficitMlPerMin),
    extractionRatio:finiteOrNull(g.globalExtractionRatio),
    oxygenDebtMl:finiteOrNull(d.oxygenDebtMl),
    stage:d.stage||null,
  };
}

const scenarios=[
  {
    id:'reference',
    ventilation:{mode:'VC_AC',fio2:0.60,peep:8,rr:20,vtL:0.42,inspiratoryFlowLps:0.70,inspiratoryPauseSec:0.20},
    durationSec:120,
  },
  {
    id:'hypoxemic-low-fio2',
    ventilation:{mode:'VC_AC',fio2:0.12,peep:8,rr:20,vtL:0.42,inspiratoryFlowLps:0.70,inspiratoryPauseSec:0.20},
    durationSec:300,
  },
];

const rows=[];
for(const scenario of scenarios){
  const session=createBerlinLiveHumModSession({
    caseId:'berlin-moderate-moderate-aspiration',
    ventilation:scenario.ventilation,
    initialRecruitmentState:{normal:1,recruitable:0.35,consolidated:0},
    dt:0.002,
    mechanicalWarmupSec:3,
  });
  session.initialize();
  for(let t=0;t<scenario.durationSec;t+=10){
    const snap=session.runFor(10);
    rows.push(collect(snap,scenario.id));
    if(snap.systemic?.decompensation?.cardiacArrest) break;
  }
}

const report={
  schema:'vent-v1.5-oxygen-transport-mechanism-suite/v1',
  authority:'diagnostic-only',
  universalCriticalDeliveryThresholdApplied:false,
  notes:[
    'Cain/Schumacker are foundational physiology sources, not universal numerical threshold sources for this harness.',
    'Anemia/low-O2-capacity and isolated low-flow variants require explicit source-valid scenario boundaries before they are added.',
    'Microcirculatory/extraction dysfunction remains a fail-closed shadow contract.',
  ],
  rows,
};

const out=process.argv[2]||path.resolve(__dirname,'../V1_5_OXYGEN_TRANSPORT_MECHANISM_SUITE.json');
fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({out,rows:rows.length},null,2));
