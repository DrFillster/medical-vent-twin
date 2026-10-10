#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createBerlinLiveHumModSession } =
  require('../src/clinical_twin_live_hummod_session.js');

function finiteOrNull(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function row(snapshot, scenarioId) {
  const sys = snapshot.systemic || {};
  const h = sys.hemodynamics || {};
  const a = h.sourceAlignedAutonomic || {};
  const sh = sys.autonomicShadow || {};
  const g = sys.gasExchange || {};
  return {
    scenarioId,
    tSec: finiteOrNull(snapshot.timeSec),
    pao2MmHg: finiteOrNull(g.pao2MmHg),
    paco2MmHg: finiteOrNull(g.paco2MmHg),
    pH: finiteOrNull(g.pH),
    ventActualTidalVolumeL: finiteOrNull(sh.tidalVolumeL),
    humModBaroreflexNa: finiteOrNull(a.baroreflexNa),
    humModSympsCnsHz: finiteOrNull(a.sympsCnsHz),
    humModVagusHz: finiteOrNull(a.vagusHz),
    humModSaNodeRatePerMin: finiteOrNull(h.sourceSaNodeHeartRatePerMin),
    humModHeartRatePerMin: finiteOrNull(h.heartRatePerMin),
    ursinoFAcSpikesPerSec: finiteOrNull(sh.fAcSpikesPerSec),
    ursinoFApSpikesPerSec: finiteOrNull(sh.fApSpikesPerSec),
    ursinoThetaSpSpikesPerSec: finiteOrNull(sh.thetaSpSpikesPerSec),
    ursinoThetaShSpikesPerSec: finiteOrNull(sh.thetaShSpikesPerSec),
    ursinoFSpSpikesPerSec: finiteOrNull(sh.fSpSpikesPerSec),
    ursinoFShSpikesPerSec: finiteOrNull(sh.fShSpikesPerSec),
    ursinoFVSpikesPerSec: finiteOrNull(sh.fVSpikesPerSec),
    ursinoFAbSpikesPerSec: finiteOrNull(sh.fAbSpikesPerSec),
    ursinoBaroreceptorFilteredPressureMmHg: finiteOrNull(sh.baroreceptor?.filteredPressureMmHg),
    baroreceptorMappingStatus: sh.baroreceptorMappingStatus || null,
  };
}

const scenarios = [
  {
    id:'baseline',
    initial:{ mode:'VC_AC', fio2:0.60, peep:8, rr:20, vtL:0.42, inspiratoryFlowLps:0.70, inspiratoryPauseSec:0.20 },
    change:null,
    durationSec:120,
  },
  {
    id:'hypoxia',
    initial:{ mode:'VC_AC', fio2:0.60, peep:8, rr:20, vtL:0.42, inspiratoryFlowLps:0.70, inspiratoryPauseSec:0.20 },
    change:{ mode:'VC_AC', fio2:0.12, peep:8, rr:20, vtL:0.42, inspiratoryFlowLps:0.70, inspiratoryPauseSec:0.20 },
    durationSec:300,
  },
  {
    id:'hypercapnia-low-ventilation',
    initial:{ mode:'VC_AC', fio2:0.60, peep:8, rr:20, vtL:0.42, inspiratoryFlowLps:0.70, inspiratoryPauseSec:0.20 },
    change:{ mode:'VC_AC', fio2:0.60, peep:8, rr:6, vtL:0.20, inspiratoryFlowLps:0.30, inspiratoryPauseSec:0 },
    durationSec:300,
  },
  {
    id:'combined-hypoxic-hypercapnic',
    initial:{ mode:'VC_AC', fio2:0.60, peep:8, rr:20, vtL:0.42, inspiratoryFlowLps:0.70, inspiratoryPauseSec:0.20 },
    change:{ mode:'VC_AC', fio2:0.14, peep:8, rr:6, vtL:0.20, inspiratoryFlowLps:0.30, inspiratoryPauseSec:0 },
    durationSec:300,
  },
  {
    id:'high-vt-stretch',
    initial:{ mode:'VC_AC', fio2:0.60, peep:8, rr:20, vtL:0.42, inspiratoryFlowLps:0.70, inspiratoryPauseSec:0.20 },
    change:{ mode:'VC_AC', fio2:0.60, peep:8, rr:20, vtL:0.70, inspiratoryFlowLps:0.90, inspiratoryPauseSec:0.10 },
    durationSec:180,
  },
];

const rows=[];
for (const scenario of scenarios) {
  const session=createBerlinLiveHumModSession({
    caseId:'berlin-moderate-moderate-aspiration',
    ventilation:scenario.initial,
    initialRecruitmentState:{ normal:1, recruitable:0.35, consolidated:0 },
    dt:0.002,
    mechanicalWarmupSec:3,
  });
  session.initialize();
  if (scenario.change) session.requestVentilationChange(scenario.change);
  for (let elapsed=0; elapsed<scenario.durationSec; elapsed+=10) {
    const snap=session.runFor(10);
    rows.push(row(snap,scenario.id));
    if (snap.systemic?.decompensation?.cardiacArrest) break;
  }
}

function extrema(group,key) {
  const xs=group.map(r=>r[key]).filter(Number.isFinite);
  return xs.length ? { min:Math.min(...xs), max:Math.max(...xs) } : null;
}

const summaries=scenarios.map(s=>{
  const group=rows.filter(r=>r.scenarioId===s.id);
  return {
    scenarioId:s.id,
    samples:group.length,
    pao2MmHg:extrema(group,'pao2MmHg'),
    paco2MmHg:extrema(group,'paco2MmHg'),
    pH:extrema(group,'pH'),
    humModHeartRatePerMin:extrema(group,'humModHeartRatePerMin'),
    humModSympsCnsHz:extrema(group,'humModSympsCnsHz'),
    humModVagusHz:extrema(group,'humModVagusHz'),
    ursinoFAcSpikesPerSec:extrema(group,'ursinoFAcSpikesPerSec'),
    ursinoFAbSpikesPerSec:extrema(group,'ursinoFAbSpikesPerSec'),
    ursinoFApSpikesPerSec:extrema(group,'ursinoFApSpikesPerSec'),
    ursinoThetaSpSpikesPerSec:extrema(group,'ursinoThetaSpSpikesPerSec'),
    ursinoThetaShSpikesPerSec:extrema(group,'ursinoThetaShSpikesPerSec'),
    ursinoEfferentsAvailable:group.some(r =>
      Number.isFinite(r.ursinoFSpSpikesPerSec) ||
      Number.isFinite(r.ursinoFShSpikesPerSec) ||
      Number.isFinite(r.ursinoFVSpikesPerSec)),
    baroreceptorMappingStatus:
      group.length ? group[group.length-1].baroreceptorMappingStatus : null,
  };
});

const report={
  schema:'vent-v1.5-autonomic-shadow-suite/v1',
  authority:'diagnostic-shadow-only',
  provenanceConstraints:{
    fAbMapping:'published Ursino pressure-to-afferent shadow; systemic arterial pressure used as documented carotid-pressure surrogate; no HumMod Baroreflex.NA reinterpretation',
    co2PeripheralInteraction:'blocked-pending-primary-source-Eq1-visual-verification',
  },
  summaries,
  rows,
};

const outPath=process.argv[2] ||
  path.resolve(__dirname,'../V1_5_AUTONOMIC_SHADOW_SUITE.json');
fs.writeFileSync(outPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({outPath,summaries},null,2));
